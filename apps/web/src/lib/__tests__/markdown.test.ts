import { describe, expect, it } from 'vitest';
import { plainExcerpt, renderMarkdown } from '../markdown';

describe('renderMarkdown', () => {
  it('renders the markdown a post body actually uses', () => {
    const html = renderMarkdown('## Título\n\n- uno\n- dos\n\nTexto con **énfasis**.');
    expect(html).toContain('<h2>Título</h2>');
    expect(html).toContain('<li>uno</li>');
    expect(html).toContain('<strong>énfasis</strong>');
  });

  it('escapes raw HTML instead of passing it through', () => {
    // Writing a post needs only content.write. If script survived this, an editor
    // could take the owner's session from the front page.
    const html = renderMarkdown('Hola <script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes an event handler smuggled into a tag', () => {
    const html = renderMarkdown('<img src=x onerror="alert(1)">');
    expect(html).not.toContain('<img');
  });

  it('still renders a markdown link, which is the point of allowing markdown', () => {
    expect(renderMarkdown('[el reino](/noticias)')).toContain('href="/noticias"');
  });
});

describe('plainExcerpt', () => {
  it('takes the first paragraph and strips the syntax', () => {
    expect(plainExcerpt('El **reino** ya está abierto.\n\nSegundo párrafo.')).toBe(
      'El reino ya está abierto.',
    );
  });

  it('truncates on a budget and marks that it did', () => {
    const excerpt = plainExcerpt('palabra '.repeat(80), 40);
    expect(excerpt.length).toBeLessThanOrEqual(40);
    expect(excerpt.endsWith('…')).toBe(true);
  });

  it('survives an empty body', () => {
    expect(plainExcerpt('')).toBe('');
  });
});
