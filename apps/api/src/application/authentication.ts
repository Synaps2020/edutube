import { randomUUID } from 'node:crypto';
import type { AccountRepository, PasswordHasher, TokenGenerator, RegistrationMail } from './ports';
import { normalizeEmail, type Session } from '../domain/account';
import type { SchoolLevel } from '../domain/catalog';
import { DomainError } from '../domain/errors';
export class Authentication {
  private absentAccountHash: Promise<string>;
  constructor(
    private repository: AccountRepository,
    private passwords: PasswordHasher,
    private tokens: TokenGenerator,
    private now: () => Date = () => new Date(),
    private newId: () => string = randomUUID,
    private welcome?: (accountId: string) => RegistrationMail,
  ) {
    this.absentAccountHash = passwords.hash('authentification-invalide');
  }
  async register(input: {
    email: string;
    password: string;
    displayName: string;
    schoolLevel?: SchoolLevel | null;
  }) {
    const email = normalizeEmail(input.email);
    const account = {
      id: this.newId(),
      role: 'LEARNER' as const,
      email,
      displayName: input.displayName,
      schoolLevel: input.schoolLevel ?? null,
      passwordHash: await this.passwords.hash(input.password),
    };
    await this.repository.create(account, this.welcome?.(account.id));
    return this.issue(account);
  }
  async login(email: string, password: string) {
    const account = await this.repository.findByEmail(normalizeEmail(email));
    const valid = await this.passwords.verify(
      password,
      account?.passwordHash ?? (await this.absentAccountHash),
    );
    if (!account || !valid) {
      throw new DomainError('UNAUTHENTICATED', 'Adresse e-mail ou mot de passe incorrect.');
    }
    return this.issue(account);
  }
  async session(token?: string) {
    if (!token) {
      return null;
    }
    const session = await this.repository.findSession(this.tokens.digest(token));
    return session && new Date(session.expiresAt) > this.now() ? session : null;
  }
  async logout(token: string) {
    await this.repository.deleteSession(this.tokens.digest(token));
  }
  private async issue(account: Session['account']) {
    const token = this.tokens.create();
    const session = {
      tokenHash: this.tokens.digest(token),
      account,
      csrfToken: this.tokens.create(),
      expiresAt: new Date(this.now().getTime() + 7 * 86400000).toISOString(),
    };
    await this.repository.saveSession(session);
    return { token, session };
  }
}
