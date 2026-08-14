import type { AdapterReport } from '@wowcms/contracts';

/** The narrow slice of the platform the diagnostics endpoint needs, so the
 *  controller can be tested without booting a database. */
export interface PlatformReporter {
  report(): AdapterReport;
}

/** Explicit token. Every injection in this app names its token rather than
 *  relying on emitted design-time metadata, which keeps the build working under
 *  esbuild-based runners that do not emit it. */
export const PLATFORM_REPORTER = Symbol('PLATFORM_REPORTER');
