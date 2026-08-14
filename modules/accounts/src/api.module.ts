import { Module, type DynamicModule } from '@nestjs/common';
import type { Pool } from 'mysql2/promise';
import type { FieldMap } from '@wowcms/core-adapters';
import { AccountsController, ACCOUNTS_SERVICE } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { AdapterAccountGateway } from './adapter-gateway';

/** The module builds its own NestJS wiring and receives only what the platform
 *  is willing to hand it: a pool and a field map. It never reaches into the core
 *  to find them. */
@Module({})
export class AccountsApiModule {
  static register(pool: Pool, map: FieldMap): DynamicModule {
    return {
      module: AccountsApiModule,
      controllers: [AccountsController],
      providers: [
        {
          provide: ACCOUNTS_SERVICE,
          useValue: new AccountsService(new AdapterAccountGateway(pool, map)),
        },
      ],
    };
  }
}
