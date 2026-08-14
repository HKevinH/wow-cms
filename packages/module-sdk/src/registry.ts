import type { AdapterCapability } from '@wowcms/contracts';
import type { WowCmsModule } from './module';

export interface DisabledModule {
  readonly module: WowCmsModule;
  readonly reason: string;
}

export interface ResolvedModules {
  readonly enabled: readonly WowCmsModule[];
  readonly disabled: readonly DisabledModule[];
}

/** Decides at startup which modules can run against the detected core. A module
 *  that cannot is disabled and reported, never left to fail on a page nobody
 *  opens for a month. */
export function resolveModules(
  modules: readonly WowCmsModule[],
  available: readonly AdapterCapability[],
): ResolvedModules {
  const seen = new Set<string>();
  for (const module of modules) {
    if (seen.has(module.id)) {
      throw new Error(`Duplicate module id: ${module.id}`);
    }
    seen.add(module.id);
  }

  const capabilities = new Set<string>(available);
  const enabled: WowCmsModule[] = [];
  const disabled: DisabledModule[] = [];
  const enabledIds = new Set<string>();

  for (const module of modules) {
    const missingCapability = module.requires?.capabilities?.find((c) => !capabilities.has(c));
    if (missingCapability !== undefined) {
      disabled.push({
        module,
        reason: `The detected core does not provide the '${missingCapability}' capability.`,
      });
      continue;
    }

    const missingModule = module.requires?.modules?.find(
      (id) => !enabledIds.has(id) && !modules.some((m) => m.id === id),
    );
    if (missingModule !== undefined) {
      disabled.push({
        module,
        reason: `Requires module '${missingModule}', which is not installed.`,
      });
      continue;
    }

    enabled.push(module);
    enabledIds.add(module.id);
  }

  return { enabled, disabled };
}
