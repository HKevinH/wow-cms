/** Themes are resolved by name so a deployment can ship its own without editing
 *  any component. Adding one means adding a stylesheet and an entry here. */
export const THEMES = ['pandaria', 'blizzard', 'minimal'] as const;

export type ThemeName = (typeof THEMES)[number];

export const DEFAULT_THEME: ThemeName = 'pandaria';

/** Which theme this site runs. Read once here rather than in every layout, so
 *  there is a single place to change when it becomes a database setting. */
export function resolveTheme(): ThemeName {
  const configured = import.meta.env.PUBLIC_THEME;
  return THEMES.includes(configured as ThemeName) ? (configured as ThemeName) : DEFAULT_THEME;
}
