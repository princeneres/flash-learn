import React, { useEffect, useMemo, useState } from 'react';
import { MediaStorageService } from '../services/MediaStorageService';
import { sanitizeRichHtml, looksLikeHtml } from '../lib/sanitize';

interface Props {
  html: string;
  className?: string;
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const decodeRef = (raw: string): string => {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

type RefEntry = { ref: string; kind: 'audio' | 'image' };

const parseDoc = (html: string): Document =>
  new DOMParser().parseFromString(`<div id="__root">${html}</div>`, 'text/html');

const extractRefs = (doc: Document): RefEntry[] => {
  const refs: RefEntry[] = [];
  const seen = new Set<string>();
  const push = (kind: 'audio' | 'image', ref: string) => {
    const key = `${kind}:${ref}`;
    if (seen.has(key)) return;
    seen.add(key);
    refs.push({ ref, kind });
  };
  doc.querySelectorAll('img').forEach((el) => {
    const src = el.getAttribute('src') ?? '';
    const m = src.match(/^media:\/\/(.+)$/);
    if (m) push('image', decodeRef(m[1]));
  });
  doc.querySelectorAll('audio, source').forEach((el) => {
    const src = el.getAttribute('src') ?? '';
    const m = src.match(/^media:\/\/(.+)$/);
    if (m) push('audio', decodeRef(m[1]));
  });
  return refs;
};

const renderResolved = (
  doc: Document,
  resolved: Map<string, string>
): string => {
  doc.querySelectorAll('img').forEach((el) => {
    const src = el.getAttribute('src') ?? '';
    const m = src.match(/^media:\/\/(.+)$/);
    if (!m) return;
    const url = resolved.get(`image:${decodeRef(m[1])}`);
    if (url) el.setAttribute('src', url);
  });
  doc.querySelectorAll('audio, source').forEach((el) => {
    const src = el.getAttribute('src') ?? '';
    const m = src.match(/^media:\/\/(.+)$/);
    if (!m) return;
    const url = resolved.get(`audio:${decodeRef(m[1])}`);
    if (url) el.setAttribute('src', url);
  });
  const root = doc.getElementById('__root');
  return root?.innerHTML ?? '';
};

export const RichContent: React.FC<Props> = ({ html, className }) => {
  const isHtml = useMemo(() => looksLikeHtml(html), [html]);
  const normalized = useMemo(() => {
    if (!html) return '';
    if (isHtml) return sanitizeRichHtml(html);
    return `<p>${escapeHtml(html).replace(/\n/g, '<br>')}</p>`;
  }, [html, isHtml]);

  const doc = useMemo(() => parseDoc(normalized), [normalized]);
  const refs = useMemo(() => extractRefs(doc), [doc]);
  const [resolved, setResolved] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    if (refs.length === 0) {
      setResolved(new Map());
      return;
    }
    (async () => {
      const next = new Map<string, string>();
      await Promise.all(
        refs.map(async ({ ref, kind }) => {
          const url = await MediaStorageService.getUrl(kind, ref);
          if (url) next.set(`${kind}:${ref}`, url);
        })
      );
      if (!cancelled) setResolved(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [refs]);

  const finalHtml = useMemo(() => {
    const cloned = parseDoc(normalized);
    return renderResolved(cloned, resolved);
  }, [normalized, resolved]);

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: finalHtml }}
    />
  );
};
