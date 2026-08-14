import { describe, expect, it, vi } from 'vitest';
import { AccountsController } from './accounts.controller';
import { InvalidCredentialsError, UsernameTakenError } from './accounts.service';

describe('AccountsController', () => {
  it('returns the new account id on registration', async () => {
    const service = { register: vi.fn(async () => ({ accountId: 7 })), login: vi.fn() };
    const controller = new AccountsController(service as never);
    await expect(
      controller.register({ username: 'kev', password: 'secret123', email: 'a@b.c' }),
    ).resolves.toEqual({ accountId: 7 });
  });

  it('maps a taken username to HTTP 409 rather than a 500', async () => {
    const service = {
      register: vi.fn(async () => {
        throw new UsernameTakenError('kev');
      }),
      login: vi.fn(),
    };
    const controller = new AccountsController(service as never);
    await expect(
      controller.register({ username: 'kev', password: 'secret123', email: 'a@b.c' }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('maps bad credentials to HTTP 401', async () => {
    const service = {
      register: vi.fn(),
      login: vi.fn(async () => {
        throw new InvalidCredentialsError();
      }),
    };
    const controller = new AccountsController(service as never);
    await expect(controller.login({ username: 'kev', password: 'nope' })).rejects.toMatchObject({
      status: 401,
    });
  });
});
