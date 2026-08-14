import { describe, expect, it, vi } from 'vitest';
import { apiFetch, ApiError } from '../api';

describe('apiFetch', () => {
  it('returns the parsed body on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
    await expect(apiFetch<{ ok: boolean }>('/api/diagnostics')).resolves.toEqual({ ok: true });
  });

  it('raises ApiError carrying the status and server message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ message: 'Username taken' }), { status: 409 })),
    );

    await expect(apiFetch('/api/m/accounts/register', { method: 'POST' })).rejects.toMatchObject({
      status: 409,
      message: 'Username taken',
    });
    await expect(apiFetch('/api/m/accounts/register', { method: 'POST' })).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});
