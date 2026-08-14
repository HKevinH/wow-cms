/** Tailwind reads colours from CSS custom properties rather than holding the
 *  palette itself. That is what keeps themes swappable: a theme replaces the
 *  variables, and every utility class follows without a rebuild of any
 *  component. Hardcoding a palette here would turn this CMS back into a single
 *  site. */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        'surface-raised': 'var(--color-surface-raised)',
        text: 'var(--color-text)',
        muted: 'var(--color-text-muted)',
        border: 'var(--color-border)',
        accent: 'var(--color-accent)',
        'accent-text': 'var(--color-accent-text)',
        highlight: 'var(--color-highlight)',
        'highlight-text': 'var(--color-highlight-text)',
        danger: 'var(--color-danger)',
        success: 'var(--color-success)',
      },
      fontFamily: {
        body: 'var(--font-body)',
        display: 'var(--font-display)',
      },
      borderRadius: {
        theme: 'var(--radius)',
      },
      maxWidth: {
        measure: 'var(--measure)',
      },
      backgroundImage: {
        'page-texture': 'var(--texture-page)',
        header: 'var(--gradient-header)',
        // Artwork the active theme names. A theme that ships none leaves these at
        // the 'none' default from base.css and the surface stays flat.
        'panel-texture': 'var(--texture-panel)',
        'panel-band': 'var(--image-panel-band)',
        'faq-band': 'var(--image-faq-band)',
        'footer-band': 'var(--image-footer-band)',
      },
      boxShadow: {
        panel: 'var(--shadow-panel)',
      },
    },
  },
  plugins: [],
};
