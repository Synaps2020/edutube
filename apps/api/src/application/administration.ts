import type { TeachingCourse } from '@edutube/contracts/teaching';
import type { Account } from '../domain/account';
import { DomainError } from '../domain/errors';
import type {
  AdminOverview,
  AdminQuery,
  AccountChange,
  AccountCreate,
  Moderation,
  AdminAccount,
  AdminCourse,
  AdminJournal,
} from '@edutube/contracts/administration';
export interface AdminContext {
  actor: Account;
  requestId: string;
}
export interface AdministrationRepository {
  overview(context: AdminContext): Promise<AdminOverview>;
  rejected(context: AdminContext, target: string, code: string): Promise<void>;
  review(context: AdminContext, id: string): Promise<TeachingCourse>;
  readMedia(context: AdminContext, target: string): Promise<void>;
  accounts(
    context: AdminContext,
    query: AdminQuery,
  ): Promise<{ items: AdminAccount[]; total: number }>;
  courses(
    context: AdminContext,
    query: AdminQuery,
  ): Promise<{ items: AdminCourse[]; total: number }>;
  journal(context: AdminContext, query: AdminQuery): Promise<AdminJournal>;
  changeAccount(context: AdminContext, id: string, input: AccountChange): Promise<AdminAccount>;
  createAccount(
    context: AdminContext,
    input: AccountCreate,
    passwordHash: string,
    tokenHash: string,
    link: string,
  ): Promise<AdminAccount>;
  moderate(context: AdminContext, id: string, input: Moderation): Promise<AdminCourse>;
}
export function requireAdministrator(account: Account, accounts = false) {
  if (account.role !== 'SUPER_ADMIN' && (accounts || account.role !== 'REGULATOR')) {
    throw new DomainError('FORBIDDEN', 'Vous ne disposez pas des droits nécessaires.');
  }
}
export class Administration {
  overview(context: AdminContext) {
    requireAdministrator(context.actor);
    return this.repository.overview(context);
  }
  rejected(context: AdminContext, target: string, code: string) {
    return this.repository.rejected(context, target, code);
  }
  constructor(
    private repository: AdministrationRepository,
    private invitation: () => Promise<{ passwordHash: string; tokenHash: string; link: string }>,
  ) {}
  review(context: AdminContext, id: string) {
    requireAdministrator(context.actor);
    return this.repository.review(context, id);
  }
  readMedia(context: AdminContext, target: string) {
    requireAdministrator(context.actor);
    return this.repository.readMedia(context, target);
  }
  accounts(context: AdminContext, query: AdminQuery) {
    requireAdministrator(context.actor, true);
    return this.repository.accounts(context, query);
  }
  courses(context: AdminContext, query: AdminQuery) {
    requireAdministrator(context.actor);
    return this.repository.courses(context, query);
  }
  journal(context: AdminContext, query: AdminQuery) {
    requireAdministrator(context.actor);
    return this.repository.journal(context, query);
  }
  changeAccount(context: AdminContext, id: string, input: AccountChange) {
    requireAdministrator(context.actor, true);
    return this.repository.changeAccount(context, id, input);
  }
  async createAccount(context: AdminContext, input: AccountCreate) {
    requireAdministrator(context.actor, true);
    const invitation = await this.invitation();
    return this.repository.createAccount(
      context,
      input,
      invitation.passwordHash,
      invitation.tokenHash,
      invitation.link,
    );
  }
  moderate(context: AdminContext, id: string, input: Moderation) {
    requireAdministrator(context.actor);
    return this.repository.moderate(context, id, input);
  }
}
