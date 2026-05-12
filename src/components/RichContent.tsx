import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MediaStorageService } from '../services/MediaStorageService';
import { sanitizeRichHtml, looksLikeHtml } from '../lib/sanitize';
import { extractHtmlMediaRefs, parseMediaSrc, type MediaRef } from '../lib/media';

interface Props {
  html: string;
  className?: string;
  /** When true, plays the first <audio> in the rendered content once media refs resolve. */
  autoplayFirst?: boolean;
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const parseDoc = (html: string): Document =>
  new DOMParser().parseFromString(`<div id="__root">${html}</div>`, 'text/html');

const TRANSPARENT_PX =
  'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

const renderResolved = (
  doc: Document,
  resolved: Map<string, string>,
  resolutionRan: boolean
): string => {
  doc.querySelectorAll('img').forEach((el) => {
    const ref = parseMediaSrc(el.getAttribute('src'));
    if (!ref) return;
    const url = resolved.get(`image:${ref}`);
    if (url) {
      el.setAttribute('src', url);
    } else if (resolutionRan) {
      el.setAttribute('src', TRANSPARENT_PX);
      el.setAttribute('alt', el.getAttribute('alt') || 'missing media');
    } else {
      el.removeAttribute('src');
    }
  });
  doc.querySelectorAll('audio, source').forEach((el) => {
    const ref = parseMediaSrc(el.getAttribute('src'));
    if (!ref) return;
    const url = resolved.get(`audio:${ref}`);
    if (url) {
      el.setAttribute('src', url);
      if (el.tagName === 'AUDIO') el.setAttribute('preload', 'auto');
    } else {
      el.removeAttribute('src');
    }
  });
  const root = doc.getElementById('__root');
  return root?.innerHTML ?? '';
};

export const RichContent: React.FC<Props> = ({ html, className, autoplayFirst }) => {
  const isHtml = useMemo(() => looksLikeHtml(html), [html]);
  const normalized = useMemo(() => {
    if (!html) return '';
    if (isHtml) return sanitizeRichHtml(html);
    return `<p>${escapeHtml(html).replace(/\n/g, '<br>')}</p>`;
  }, [html, isHtml]);

  const refs: MediaRef[] = useMemo(
    () => extractHtmlMediaRefs(normalized),
    [normalized]
  );
  const [resolved, setResolved] = useState<Map<string, string>>(new Map());
  const [resolutionRan, setResolutionRan] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (refs.length === 0) {
      setResolved(new Map());
      setResolutionRan(true);
      return;
    }
    setResolutionRan(false);
    (async () => {
      const next = new Map<string, string>();
      await Promise.all(
        refs.map(async ({ ref, kind }) => {
          const url = await MediaStorageService.getUrl(kind, ref);
          if (url) next.set(`${kind}:${ref}`, url);
        })
      );
      if (!cancelled) {
        setResolved(next);
        setResolutionRan(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refs]);

  const finalHtml = useMemo(() => {
    const cloned = parseDoc(normalized);
    return renderResolved(cloned, resolved, resolutionRan);
  }, [normalized, resolved, resolutionRan]);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoplayFirst || !resolutionRan) return;
    const tryPlay = () => {
      const audio = containerRef.current?.querySelector(
        'audio'
      ) as HTMLAudioElement | null;
      if (!audio || !audio.getAttribute('src')) return false;
      try {
        audio.currentTime = 0;
      } catch {
        // ignore
      }
      void audio.play().catch((err) => {
        console.warn('[RichContent] autoplay failed:', err?.name ?? err);
      });
      return true;
    };
    if (tryPlay()) return;
    // DOM may not be fully updated yet — retry on next frame.
    const raf = requestAnimationFrame(() => {
      tryPlay();
    });
    return () => cancelAnimationFrame(raf);
  }, [autoplayFirst, resolutionRan]);

  return (
    <div
      ref={containerRef}
      className={className}
      dangerouslySetInnerHTML={{ __html: finalHtml }}
    />
  );
};
