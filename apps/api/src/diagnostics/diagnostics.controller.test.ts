import { describe, expect, it } from 'vitest';
import { DiagnosticsController } from './diagnostics.controller';
import type { AdapterReport } from '@wowcms/contracts';

const report: AdapterReport = {
  adapterId: 'trinity-5.4.8',
  score: 100,
  capabilities: ['accounts'],
  missing: ['guilds: no guild_member table'],
};

describe('DiagnosticsController', () => {
  it('returns what the platform detected at startup', () => {
    const controller = new DiagnosticsController({ report: () => report });
    expect(controller.get()).toEqual(report);
  });
});
