import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';

export default defineConfig({
  // Hybrid rather than one or the other. Public pages are the same for every
  // visitor and are prerendered; the administration area and the account pages
  // hold a session and opt out with `export const prerender = false`. Fully
  // static leaves nowhere for a session to live; fully server-rendered re-renders
  // a news list that last changed on Tuesday, for every request.
  output: 'hybrid',
  adapter: node({ mode: 'standalone' }),
  site: process.env.PUBLIC_SITE_URL ?? 'http://localhost:4321',
  // The base stylesheet is imported by BaseLayout instead, so theme variables are
  // guaranteed to load before any utility class uses them.
  integrations: [tailwind({ applyBaseStyles: false })],
});
