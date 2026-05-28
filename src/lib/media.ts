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
