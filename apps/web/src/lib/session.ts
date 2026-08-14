import type { APIContext } from 'astro';
import { hasPermission, type SessionResponse, type Viewer } from '@wowcms/contracts';
import { apiFetch } from './api';

/** Resolves who is reading a server-rendered page.
 *
 *  The session cookie is set by the API on its own origin, so the browser sends
 *  it to the API but the Astro server only sees it because it is on the incoming
 *  request. Forwarding it by hand is the whole job here; without it every SSR
 *  page renders as anonymous while the browser is plainly logged in. */
export async function getViewer(context: APIContext): Promise<Viewer | null> {
  const cookie = context.request.headers.get('cookie');
  if (!cookie) return null;

  try {
    const session = await apiFetch<SessionResponse>('/api/session', { cookie });
    return session.viewer;
  } catch {
    // An expired or invalid session is not an error to show anyone: it means
    // logged out, which every caller already knows how to render.
    return null;
  }
}

/** Guards a page. Returns a redirect for the caller to return, or null when the
 *  viewer may stay — written this way because an Astro page has to `return` the
 *  Response itself and cannot be redirected from inside a helper. */
export function requirePermission(
  context: APIContext,
  viewer: Viewer | null,
  permission: string,
  loginPath = '/admin/login',
): Response | null {
  if (hasPermission(viewer, permission)) return null;

  if (viewer === null) {
    // Round-trips the reader back to what they asked for once they are in.
    const next = encodeURIComponent(context.url.pathname + context.url.search);
    return context.redirect(`${loginPath}?next=${next}`);
  }

  // Logged in but not allowed: a redirect to login would loop, so this is a 403.
  return new Response('Forbidden', { status: 403 });
}
