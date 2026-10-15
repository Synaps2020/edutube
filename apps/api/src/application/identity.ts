import type { Profile, ProfileInput } from '@edutube/contracts/identity';
import type { PasswordHasher, TokenGenerator } from './ports';
export interface IdentityRepository {
  profile(accountId: string): Promise<Profile>;
  saveProfile(accountId: string, input: ProfileInput): Promise<Profile>;
  requestLink(
    target: { accountId?: string; email?: string },
    purpose: 'VERIFY' | 'RESET',
    tokenHash: string,
    link: string,
  ): Promise<void>;
  consume(tokenHash: string, purpose: 'VERIFY' | 'RESET', passwordHash?: string): Promise<void>;
}
export class Identity {
  constructor(
    private repository: IdentityRepository,
    private passwords: PasswordHasher,
    private tokens: TokenGenerator,
    private origin: string,
  ) {}
  welcome() {
    const token = this.tokens.create();
    return {
      tokenHash: this.tokens.digest(token),
      link: `${this.origin}/verifier-email#token=${token}`,
    };
  }
  profile(accountId: string) {
    return this.repository.profile(accountId);
  }
  saveProfile(accountId: string, input: ProfileInput) {
    return this.repository.saveProfile(accountId, input);
  }
  async request(target: { accountId?: string; email?: string }, purpose: 'VERIFY' | 'RESET') {
    const token = this.tokens.create();
    const page = purpose === 'VERIFY' ? 'verifier-email' : 'nouveau-mot-de-passe';
    await this.repository.requestLink(
      target,
      purpose,
      this.tokens.digest(token),
      `${this.origin}/${page}#token=${token}`,
    );
    return {
      message:
        purpose === 'VERIFY'
          ? 'Un lien de vérification a été envoyé si nécessaire. Consultez votre messagerie.'
          : 'Si cette adresse possède un compte, un lien a été envoyé. Consultez votre messagerie.',
    };
  }
  async verify(token: string) {
    await this.repository.consume(this.tokens.digest(token), 'VERIFY');
    return { message: 'Votre adresse e-mail est vérifiée.' };
  }
  async reset(token: string, password: string) {
    await this.repository.consume(
      this.tokens.digest(token),
      'RESET',
      await this.passwords.hash(password),
    );
    return { message: 'Votre mot de passe a été modifié. Connectez-vous à nouveau.' };
  }
}
