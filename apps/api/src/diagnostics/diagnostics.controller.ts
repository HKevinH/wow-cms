import { Controller, Get, Inject } from '@nestjs/common';
import type { AdapterReport } from '@wowcms/contracts';
import { PLATFORM_REPORTER, type PlatformReporter } from '../platform/platform.service';

/** Turns "it does not work" into a readable report: which adapter won, how
 *  confident it was, and what is missing for the capabilities that are off. */
@Controller('api/diagnostics')
export class DiagnosticsController {
  constructor(@Inject(PLATFORM_REPORTER) private readonly platform: PlatformReporter) {}

  @Get()
  get(): AdapterReport {
    return this.platform.report();
  }
}
