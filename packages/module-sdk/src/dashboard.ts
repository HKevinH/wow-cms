import { hasPermission, type Viewer } from '@wowcms/contracts';
import type { DashboardSection, WowCmsModule } from './module';

/** A section as the sidebar renders it, with the module it came from attached so
 *  the shell can group or badge by module without matching on path prefixes. */
export interface ResolvedDashboardSection extends DashboardSection {
  readonly moduleId: string;
}

/** The administration navigation, built from the modules that are actually
 *  enabled and filtered to what this viewer may open.
 *
 *  Filtering happens here rather than in the layout for one reason: a link to a
 *  page that answers 403 is worse than no link, and the layout is the wrong place
 *  to be making authorisation decisions. The endpoints still check for
 *  themselves — this only decides what is worth showing. */
export function resolveDashboard(
  modules: readonly WowCmsModule[],
  viewer: Viewer | null,
): ResolvedDashboardSection[] {
  const sections = modules.flatMap((module) =>
    (module.dashboard ?? []).map((section) => ({ ...section, moduleId: module.id })),
  );

  return sections
    .filter((section) => hasPermission(viewer, section.permission))
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}

/** Every permission key the installed modules declare, for the role editor. A
 *  role can only grant something a module has actually defined; free text here
 *  would produce grants that silently match nothing. */
export function declaredPermissions(
  modules: readonly WowCmsModule[],
  core: readonly string[] = [],
): string[] {
  const keys = new Set(core);
  for (const module of modules) {
    for (const permission of module.permissions ?? []) keys.add(permission.key);
  }
  return [...keys].sort();
}
