import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SESSION_COOKIE, hasPermission, type Viewer } from '@wowcms/contracts';
import { AuthService } from './auth.service';

export const AUTH_SERVICE = Symbol('AUTH_SERVICE');

const PERMISSION_KEY = 'wowcms:permission';

/** Declares what a route needs. Written on the handler so the requirement is
 *  visible where the handler is, rather than in a table somewhere else that
 *  drifts as routes are added. */
export const RequirePermission = (permission: string) => SetMetadata(PERMISSION_KEY, permission);

/** A request with whatever the guard resolved. Handlers read `viewer` rather than
 *  re-resolving the cookie, so one request means one session lookup. */
export interface RequestWithViewer {
  cookies?: Record<string, string | undefined>;
  viewer?: Viewer | null;
}

/** Resolves the session on every request and enforces `@RequirePermission`.
 *
 *  It runs even on routes that declare no permission, because a public route
 *  still wants to know who is asking — the news list, for one, shows drafts to an
 *  editor and not to anyone else. */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AUTH_SERVICE) private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithViewer>();
    request.viewer = await this.auth.resolve(request.cookies?.[SESSION_COOKIE]);

    const required = this.reflector.getAllAndOverride<string | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (required === undefined) return true;

    if (request.viewer === null) {
      // 401 rather than 403: the browser should offer a login, not report that
      // this reader will never be allowed.
      throw new UnauthorizedException('Log in to continue.');
    }

    if (!hasPermission(request.viewer, required)) {
      throw new ForbiddenException(`This action needs the '${required}' permission.`);
    }

    return true;
  }
}
