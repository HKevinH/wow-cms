const API_BASE = import.meta.env.PUBLIC_API_BASE ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiRequest extends RequestInit {
  /** Forwarded from an SSR page so the API sees the reader's session. A browser
   *  attaches the cookie itself; a server rendering on their behalf has to be
   *  handed it. */
  cookie?: string | null;
}

/** One door to the API, so error handling is written once rather than per page. */
export async function apiFetch<T>(path: string, init: ApiRequest = {}): Promise<T> {
  const { cookie, ...rest } = init;

  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    // The session lives in an HttpOnly cookie on the API's origin, so every call
    // has to carry credentials or an authenticated page renders as anonymous.
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { cookie } : {}),
      ...rest.headers,
    },
  });

  const body: unknown = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof body === 'object' && body !== null && 'message' in body
        ? String((body as { message: unknown }).message)
        : `Request failed with status ${response.status}`;
    throw new ApiError(response.status, message);
  }

  return body as T;
}
