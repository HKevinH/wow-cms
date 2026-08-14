import type { AccountBalances, AccountId, AccountSummary, NewAccount } from '@wowcms/contracts';

export class UsernameTakenError extends Error {
  constructor(username: string) {
    super(`Username '${username}' is already registered.`);
    this.name = 'UsernameTakenError';
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Username or password is incorrect.');
    this.name = 'InvalidCredentialsError';
  }
}

/** The account operations this module needs. The adapter supplies them, which is
 *  why nothing here knows how a password is hashed or which table it lands in. */
export interface AccountGateway {
  create(input: NewAccount): Promise<AccountId>;
  verify(username: string, password: string): Promise<AccountId | null>;
  findByUsername(username: string): Promise<AccountId | null>;
  list?(query: { search?: string; field?: 'username' | 'email'; limit: number; offset: number }): Promise<{ items: AccountSummary[]; total: number }>;
  balances?(accountId: AccountId): Promise<AccountBalances>;
}

const MINIMUM_PASSWORD_LENGTH = 8;

export class AccountsService {
  constructor(private readonly accounts: AccountGateway) {}

  async register(input: NewAccount): Promise<{ accountId: AccountId }> {
    if (input.password.length < MINIMUM_PASSWORD_LENGTH) {
      throw new Error(`Password must be at least ${MINIMUM_PASSWORD_LENGTH} characters.`);
    }

    if ((await this.accounts.findByUsername(input.username)) !== null) {
      throw new UsernameTakenError(input.username);
    }

    return { accountId: await this.accounts.create(input) };
  }

  async login(username: string, password: string): Promise<{ accountId: AccountId }> {
    const accountId = await this.accounts.verify(username, password);
    if (accountId === null) {
      throw new InvalidCredentialsError();
    }
    return { accountId };
  }

  async list(query: { search?: string; field?: 'username' | 'email'; limit?: number; offset?: number }) {
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
    const offset = Math.max(0, Number(query.offset) || 0);
    if (!this.accounts.list) return { items: [], total: 0, limit, offset };
    const page = await this.accounts.list({ search: query.search?.trim(), field: query.field, limit, offset });
    return { ...page, limit, offset };
  }

  async balances(accountId: AccountId): Promise<AccountBalances> {
    return this.accounts.balances ? this.accounts.balances(accountId) : { donorPoints: 0, votePoints: 0 };
  }
}
