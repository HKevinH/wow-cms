import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  type SessionResponse,
} from '@wowcms/contracts';
import { AuthService, InvalidCredentialsError } from './auth.service';
import { AUTH_SERVICE, type RequestWithViewer } from './guard';

/** The minimum a cookie-setting reply has to be able to do. Typed structurally so
 *  this controller does not depend on Fastify's types, which would drag the whole
 *  platform adapter into a module. */
interface CookieReply {
  setCookie(name: string, value: string, options: Record<string, unknown>): unknown;
  clearCookie(name: string, options: Record<string, unknown>): unknown;
}

/** Mounted at /api/session by the platform rather than under /api/m/, because
 *  identity is not a module's business: every module depends on it, and a client
 *  should not have to know which module happens to implement it. */
@Controller('session')
export class SessionController {
  constructor(@Inject(AUTH_SERVICE) private readonly auth: AuthService) {}

  /** Who is asking. 401 rather than a null body, so a caller cannot mistake
   *  "logged out" for "the request failed". */
  @Get()
  session(@Req() request: RequestWithViewer): SessionResponse {
    const viewer = request.viewer;
    if (!viewer) {
      throw new UnauthorizedException('No session.');
    }
    return {
      viewer,
      expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString(),
    };
  }

  @Post()
  async login(
    @Body() body: { username?: string; password?: string },
    @Res({ passthrough: true }) reply: CookieReply,
  ): Promise<SessionResponse> {
    try {
      const { token, session } = await this.auth.login(body.username ?? '', body.password ?? '');

      reply.setCookie(SESSION_COOKIE, token, {
        path: '/',
        // Script must never be able to read this: an XSS anywhere on the site
        // would otherwise be a session theft.
        httpOnly: true,
        sameSite: 'lax',
        // Set only over TLS in production; a dev install on http would otherwise
        // never receive the cookie at all.
        secure: process.env.NODE_ENV === 'production',
        maxAge: SESSION_TTL_SECONDS,
      });

      const viewer = await this.auth.resolve(token);
      if (viewer === null) {
        throw new Error('Session was created but could not be read back.');
      }

      return { viewer, expiresAt: session.expiresAt.toISOString() };
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }
  }

  @Delete()
  async logout(
    @Req() request: RequestWithViewer,
    @Res({ passthrough: true }) reply: CookieReply,
  ): Promise<{ ok: true }> {
    await this.auth.logout(request.cookies?.[SESSION_COOKIE]);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  }
}
