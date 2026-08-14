import { Module, type DynamicModule } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import type { Pool } from 'mysql2/promise';
import type { AdapterReport } from '@wowcms/contracts';
import type { FieldMap } from '@wowcms/core-adapters';
import { AccountsApiModule } from '@wowcms/module-accounts';
import { AuthApiModule } from '@wowcms/module-auth';
import { ContentApiModule } from '@wowcms/module-content';
import { MediaApiModule } from '@wowcms/module-media';
import { SettingsApiModule } from '@wowcms/module-settings';
import { DiagnosticsController } from './diagnostics/diagnostics.controller';
import { PLATFORM_REPORTER } from './platform/platform.service';
import { InstallerController } from './installer/installer.controller';

export interface AppOptions {
  readonly pool: Pool;
  readonly cmsPool: Pool;
  readonly fieldMap: FieldMap;
  readonly report: AdapterReport;
}

@Module({})
export class AppModule {
  static registerInstaller(): DynamicModule {
    return { module: AppModule, controllers: [InstallerController] };
  }

  static register(options: AppOptions): DynamicModule {
    const accounts = AccountsApiModule.register(options.pool, options.fieldMap);
    const auth = AuthApiModule.register({ emulatorPool: options.pool, fieldMap: options.fieldMap, cmsPool: options.cmsPool });
    const content = ContentApiModule.register(options.cmsPool);
    const media = MediaApiModule.register(options.cmsPool);
    const settings = SettingsApiModule.register(options.cmsPool);

    return {
      module: AppModule,
      imports: [
        accounts,
        auth,
        content,
        media,
        settings,
        // Every module is namespaced by its id, so two modules can never collide.
        RouterModule.register([
          { path: 'api/m/accounts', module: AccountsApiModule },
          { path: 'api', module: AuthApiModule },
          { path: 'api/m/content', module: ContentApiModule },
          { path: 'api/m/media', module: MediaApiModule },
          { path: 'api/m/settings', module: SettingsApiModule },
        ]),
      ],
      controllers: [DiagnosticsController],
      providers: [{ provide: PLATFORM_REPORTER, useValue: { report: () => options.report } }],
    };
  }
}
