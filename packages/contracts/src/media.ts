export type MediaId = number;

export const MEDIA_KINDS = ['image', 'video', 'other'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

/** One entry in the media library. Two sources are possible and both are first
 *  class: a file this install stores, and a URL it merely points at. A CMS that
 *  only understood uploads would have no way to describe artwork served from a
 *  CDN, which is most of what a realm site shows. */
export interface MediaAsset {
  readonly id: MediaId;
  readonly kind: MediaKind;
  /** What the admin sees in the picker. */
  readonly title: string;
  /** What a page puts in src. Absolute for remote entries, site-rooted for
   *  uploads. */
  readonly url: string;
  readonly mimeType: string;
  /** Null for remote entries: we do not download something to measure it. */
  readonly bytes: number | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly uploadedAt: string;
}

export interface MediaQuery {
  readonly kind?: MediaKind;
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface MediaPage {
  readonly items: readonly MediaAsset[];
  readonly total: number;
}

/** Registering something already hosted elsewhere. Uploads go through multipart
 *  and never through this shape. */
export interface RemoteMediaInput {
  readonly title: string;
  readonly url: string;
}

/** Kept in step with what the upload endpoint accepts. A type not on this list is
 *  refused before a byte is written, because "store whatever arrives" is how an
 *  upload form becomes a file host. */
export const ALLOWED_UPLOAD_TYPES: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export function kindForMimeType(mimeType: string): MediaKind {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'other';
}
