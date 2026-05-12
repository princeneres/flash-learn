export type MediaKind = 'audio' | 'image';
export interface MediaRef {
  kind: MediaKind;
  ref: string;
}

const decode = (raw: string): string => {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

const MEDIA_PROTO = /^media:\/\/(.+)$/;

export const parseMediaSrc = (src: string | null | undefined): string | null => {
  if (!src) return null;
  const m = src.match(MEDIA_PROTO);
  return m ? decode(m[1]) : null;
};

export const extractHtmlMediaRefs = (html: string): MediaRef[] => {
  if (!html) return [];
  const out: MediaRef[] = [];
  const seen = new Set<string>();
  const push = (kind: MediaKind, ref: string) => {
    const key = `${kind}:${ref}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind, ref });
  };
  const doc = new DOMParser().parseFromString(
    `<div>${html}</div>`,
    'text/html'
  );
  doc.querySelectorAll('img').forEach((el) => {
    const ref = parseMediaSrc(el.getAttribute('src'));
    if (ref) push('image', ref);
  });
  doc.querySelectorAll('audio, source').forEach((el) => {
    const ref = parseMediaSrc(el.getAttribute('src'));
    if (ref) push('audio', ref);
  });
  return out;
};

export interface CardLike {
  front?: string | null;
  back?: string | null;
  frontAudio?: string | null;
  backAudio?: string | null;
}

// ============================================================
// Storage-safe ref sanitizer (Supabase Storage rejects keys
// containing characters outside `\w / ! - . * ' ( ) ` + space,
// and forbids non-ASCII entirely). Anki imports preserve the
// original filename, so we sanitize once per import and keep a
// mapping back to the original (needed to look up the file in
// the Anki zip's `media` index).
// ============================================================

export interface SanitizeContext {
  originalToSafe: Map<string, string>;
  safeToOriginal: Map<string, string>;
}

export const createSanitizeContext = (): SanitizeContext => ({
  originalToSafe: new Map(),
  safeToOriginal: new Map(),
});

const SAFE_CHAR_RE = /[^a-z0-9._-]+/gi;
const COMBINING_MARKS_RE = /[̀-ͯ]/g;

export const sanitizeMediaRef = (
  original: string,
  ctx: SanitizeContext
): string => {
  const cached = ctx.originalToSafe.get(original);
  if (cached) return cached;

  const nfkd = original.normalize('NFKD').replace(COMBINING_MARKS_RE, '');
  let base = nfkd
    .replace(SAFE_CHAR_RE, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|-+$/g, '')
    .toLowerCase();
  if (!base) base = 'file';

  let unique = base;
  let i = 1;
  while (
    ctx.safeToOriginal.has(unique) &&
    ctx.safeToOriginal.get(unique) !== original
  ) {
    const dot = base.lastIndexOf('.');
    unique =
      dot > 0
        ? `${base.slice(0, dot)}-${i}${base.slice(dot)}`
        : `${base}-${i}`;
    i++;
  }
  ctx.originalToSafe.set(original, unique);
  ctx.safeToOriginal.set(unique, original);
  return unique;
};

export const collectCardMediaRefs = (card: CardLike): MediaRef[] => {
  const refs: MediaRef[] = [];
  const seen = new Set<string>();
  const add = (kind: MediaKind, ref: string) => {
    const key = `${kind}:${ref}`;
    if (seen.has(key)) return;
    seen.add(key);
    refs.push({ kind, ref });
  };
  for (const r of extractHtmlMediaRefs(card.front ?? '')) add(r.kind, r.ref);
  for (const r of extractHtmlMediaRefs(card.back ?? '')) add(r.kind, r.ref);
  if (card.frontAudio) add('audio', card.frontAudio);
  if (card.backAudio) add('audio', card.backAudio);
  return refs;
};
