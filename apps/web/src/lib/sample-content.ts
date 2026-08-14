import type { ContentLocale, NewsPost } from '@wowcms/contracts';

/** Posts shown when the content API has nothing to say — either because it is not
 *  running yet or because this is a fresh install with an empty database.
 *
 *  A CMS whose front page is blank on the day it is installed looks broken, and
 *  the person installing it cannot tell a working deployment from a broken one.
 *  These are clearly about this software rather than pretending to be a realm's
 *  real announcements, so nobody ships them by accident and calls it content. */
export const SAMPLE_POSTS: readonly NewsPost[] = [
  {
    id: -1,
    slug: 'el-reino-esta-abierto',
    locale: 'es',
    title: 'El reino está abierto',
    excerpt:
      'Mists of Pandaria 5.4.8, con el continente entero disponible desde el primer día. Crea tu cuenta y apunta el cliente hacia aquí.',
    category: 'Anuncio',
    publishedAt: '2026-08-13T10:00:00.000Z',
    coverUrl: '/media/remote/cards/launch.jpg',
    updatedAt: '2026-08-13T10:00:00.000Z',
    body: [
      'El reino ya acepta conexiones. Esta entrada es contenido de ejemplo: en cuanto publiques la primera noticia real desde el panel de administración, desaparece.',
      '',
      '## Qué encontrarás',
      '',
      '- Las seis zonas de Pandaria, de Bosque de Jade a Vega de Kun-Lai',
      '- Escenarios, modos desafío y duelos de mascotas',
      '- La Isla Intemporal del parche 5.4',
      '',
      'Si algo no funciona como debería, cuéntanoslo.',
    ].join('\n'),
  },
  {
    id: -2,
    slug: 'como-publicar-tu-primera-noticia',
    locale: 'es',
    title: 'Cómo publicar tu primera noticia',
    excerpt:
      'Entra en el panel con tu cuenta de juego, abre Noticias y escribe. El texto es Markdown y se renderiza al leerlo.',
    category: 'Guía',
    publishedAt: '2026-08-12T10:00:00.000Z',
    coverUrl: '/media/remote/cards/level-cap.jpg',
    updatedAt: '2026-08-12T10:00:00.000Z',
    body: [
      'La primera cuenta que entra en `/admin` se queda con el rol de propietario, así que empieza por ahí.',
      '',
      '1. Entra en `/admin` con tu usuario y contraseña del juego',
      '2. Abre **Noticias** y pulsa en crear',
      '3. Escribe el cuerpo en Markdown y publícalo',
      '',
      'En cuanto exista una noticia publicada, estas de ejemplo dejan de mostrarse.',
    ].join('\n'),
  },
  {
    id: -3,
    slug: 'the-realm-is-open',
    locale: 'en',
    title: 'The realm is open',
    excerpt:
      'Mists of Pandaria 5.4.8, with the whole continent available from day one. Make an account and point your client here.',
    category: 'Announcement',
    publishedAt: '2026-08-13T10:00:00.000Z',
    coverUrl: '/media/remote/cards/launch.jpg',
    updatedAt: '2026-08-13T10:00:00.000Z',
    body: [
      'The realm is accepting connections. This entry is sample content: it disappears the moment you publish a real post from the administration area.',
      '',
      '## What is here',
      '',
      '- All six Pandaria zones, from the Jade Forest to the Vale of Eternal Blossoms',
      '- Scenarios, challenge modes and pet battles',
      '- The Timeless Isle from patch 5.4',
      '',
      'If something is not behaving, tell us.',
    ].join('\n'),
  },
  {
    id: -4,
    slug: 'publishing-your-first-post',
    locale: 'en',
    title: 'Publishing your first post',
    excerpt:
      'Log into the dashboard with your game account, open News and write. Bodies are Markdown, rendered at read time.',
    category: 'Guide',
    publishedAt: '2026-08-12T10:00:00.000Z',
    coverUrl: '/media/remote/cards/level-cap.jpg',
    updatedAt: '2026-08-12T10:00:00.000Z',
    body: [
      'The first account to log into `/admin` is granted the owner role, so start there.',
      '',
      '1. Log into `/admin` with your in-game username and password',
      '2. Open **News** and create a post',
      '3. Write the body in Markdown and publish it',
      '',
      'Once one real post exists, these samples stop being shown.',
    ].join('\n'),
  },
];

export function samplePosts(locale: ContentLocale): NewsPost[] {
  return SAMPLE_POSTS.filter((post) => post.locale === locale);
}
