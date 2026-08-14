import { Marked } from 'marked';

/** Renders a post body to HTML.
 *
 *  Raw HTML is escaped before parsing rather than passed through. Writing a post
 *  needs only `content.write`, which is a lower privilege than administering the
 *  site — so if raw HTML survived, an editor could put a script tag on the front
 *  page and take the owner's session. Markdown syntax still works; a literal '<'
 *  renders as a '<'. That is the trade, and it is the right way round. */
const marked = new Marked({ gfm: true, breaks: false });

function escapeHtml(source: string): string {
  return source.replace(/</g, '&lt;');
}

export function renderMarkdown(body: string): string {
  return marked.parse(escapeHtml(body), { async: false });
}

/** First paragraph, flattened, for a meta description or a generated excerpt. */
export function plainExcerpt(body: string, maxLength = 200): string {
  const firstParagraph = body.split(/\n\s*\n/)[0] ?? '';
  const text = firstParagraph
    .replace(/[#>*_`[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text;
}
