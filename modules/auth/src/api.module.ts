import { Module, type DynamicModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import type { Pool } from 'mysql2/promise';
import type { FieldMap } from '@wowcms/core-adapters';
import { verifyPassword } from '@wowcms/core-adapters';
import { AuthService } from './auth.service';
import { MysqlAuthStore } from './auth.repository';
import { SessionController } from './session.controller';
import { AUTH_STORE, EMULATOR_ACCESS, RolesController } from './roles.controller';
import { AUTH_SERVICE, PermissionGuard } from './guard';

export interface AuthModuleOptions {
  /** The emulator's pool, for checking passwords. */
  readonly emulatorPool: Pool;
  readonly fieldMap: FieldMap;
  /** The CMS's own pool, where roles, grants and sessions live. */
  readonly cmsPool: Pool;
}

/** Wires identity. The guard is registered globally rather than per controller so
 *  a route added later is covered by default — a permission check somebody has to
 *  remember to add is a permission check that eventually is not there. Routes
 *  without `@RequirePermission` stay public; the guard still resolves the viewer
 *  for them. */
@Module({})
export class AuthApiModule {
  static register(options: AuthModuleOptions): DynamicModule {
    const store = new MysqlAuthStore(options.cmsPool);

    const service = new AuthService(
      {
        verify: (username, password) =>
          verifyPassword(options.emulatorPool, options.fieldMap, username, password),
      },
      store,
    );

    return {
      module: AuthApiModule,
      controllers: [SessionController, RolesController],
      providers: [
        { provide: AUTH_SERVICE, useValue: service },
        { provide: AUTH_STORE, useValue: store },
        {
          provide: EMULATOR_ACCESS,
          useValue: { pool: options.emulatorPool, fieldMap: options.fieldMap },
        },
        { provide: APP_GUARD, useClass: PermissionGuard },
      ],
      exports: [AUTH_SERVICE, AUTH_STORE],
    };
  }
}
