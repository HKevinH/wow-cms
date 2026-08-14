import { describe, expect, it, vi } from 'vitest';
import {
  AccountsService,
  InvalidCredentialsError,
  UsernameTakenError,
  type AccountGateway,
} from '../accounts.service';

function makeService(overrides: Partial<AccountGateway> = {}) {
  const gateway: AccountGateway = {
    create: vi.fn(async () => 7),
    verify: vi.fn(async () => 7 as number | null),
    findByUsername: vi.fn(async () => null as number | null),
    ...overrides,
  };
  return { service: new AccountsService(gateway), gateway };
}

describe('AccountsService.register', () => {
  it('creates the account and returns its id', async () => {
    const { service } = makeService();
    await expect(
      service.register({ username: 'kev', password: 'secret123', email: 'a@b.c' }),
    ).resolves.toEqual({ accountId: 7 });
  });

  it('rejects a username that already exists', async () => {
    const { service } = makeService({ findByUsername: vi.fn(async () => 3) });
    await expect(
      service.register({ username: 'kev', password: 'secret123', email: 'a@b.c' }),
    ).rejects.toBeInstanceOf(UsernameTakenError);
  });

  it('rejects a password shorter than 8 characters before touching the database', async () => {
    const { service, gateway } = makeService();
    await expect(
      service.register({ username: 'kev', password: 'short', email: 'a@b.c' }),
    ).rejects.toThrow(/at least 8/);
    expect(gateway.create).not.toHaveBeenCalled();
  });
});

describe('AccountsService.login', () => {
  it('returns the account id for correct credentials', async () => {
    const { service } = makeService();
    await expect(service.login('kev', 'secret123')).resolves.toEqual({ accountId: 7 });
  });

  it('throws InvalidCredentialsError for a wrong password', async () => {
    const { service } = makeService({ verify: vi.fn(async () => null) });
    await expect(service.login('kev', 'nope')).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});
