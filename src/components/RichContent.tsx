import React, { useEffect, useMemo, useRef, useState } from 'react';
import katex from 'katex';
import { MediaStorageService } from '../services/MediaStorageService';
import { sanitizeRichHtml, looksLikeHtml } from '../lib/sanitize';
import { extractHtmlMediaRefs, parseMediaSrc, type MediaRef } from '../lib/media';
import { renderCloze } from '../lib/cloze';

interface Props {
  html: string;
  className?: string;
  /** Owner uid for the media refs — required when content belongs to another user. */
  ownerId?: string;
  /** When true, plays the first <audio> in the rendered content once media refs resolve. */
  autoplayFirst?: boolean;
  /**
   * Render cloze markers ({{cN::…}}) as blanks ('front') or revealed ('back').
   * Omit to leave markers untouched (e.g. in the deck card list preview).
   */
  clozeMode?: 'front' | 'back';
}

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const parseDoc = (html: string): Document =>
  new DOMParser().parseFromString(`<div id="__root">${html}</div>`, 'text/html');

const TRANSPARENT_PX = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

const renderResolved = (
  doc: Document,
  resolved: Map<string, string>,
  resolutionRan: boolean,
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

export const RichContent: React.FC<Props> = ({
  html,
  className,
  ownerId,
  autoplayFirst,
  clozeMode,
}) => {
  const isHtml = useMemo(() => looksLikeHtml(html), [html]);
  const normalized = useMemo(() => {
    if (!html) return '';
    const base = isHtml
      ? sanitizeRichHtml(html)
      : `<p>${escapeHtml(html).replace(/\n/g, '<br>')}</p>`;
    // Cloze markers are plain text in the sanitized output; expand them last so
    // the generated spans carry already-sanitized content.
    return clozeMode ? renderCloze(base, clozeMode) : base;
  }, [html, isHtml, clozeMode]);

  const refs: MediaRef[] = useMemo(() => extractHtmlMediaRefs(normalized), [normalized]);
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
          const url = await MediaStorageService.getUrl(kind, ref, ownerId);
          if (url) next.set(`${kind}:${ref}`, url);
        }),
      );
      if (!cancelled) {
        setResolved(next);
        setResolutionRan(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refs, ownerId]);

  const finalHtml = useMemo(() => {
    const cloned = parseDoc(normalized);
    return renderResolved(cloned, resolved, resolutionRan);
  }, [normalized, resolved, resolutionRan]);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const nodes = root.querySelectorAll<HTMLSpanElement>('span[data-tex]');
    nodes.forEach((node) => {
      if (node.dataset.rendered === '1') return;
      const tex = node.getAttribute('data-tex') ?? '';
      if (!tex) return;
      const display = node.classList.contains('math-display');
      try {
        node.innerHTML = katex.renderToString(tex, {
          displayMode: display,
          throwOnError: false,
          output: 'htmlAndMathml',
          strict: 'ignore',
        });
      } catch {
        node.textContent = tex;
      }
      node.dataset.rendered = '1';
    });
  }, [finalHtml]);

  useEffect(() => {
    if (!autoplayFirst || !resolutionRan) return;
    let cancelled = false;
    let pendingListener: (() => void) | null = null;
    let raf = 0;

    const tryPlay = (): boolean => {
      const audio = containerRef.current?.querySelector('audio') as HTMLAudioElement | null;
      if (!audio || !audio.getAttribute('src')) return false;
      try {
        audio.currentTime = 0;
      } catch {
        // ignore
      }
      void audio.play().catch((err) => {
        if (cancelled) return;
        if (err?.name === 'NotAllowedError' && !pendingListener) {
          pendingListener = () => {
            pendingListener = null;
            if (cancelled) return;
            tryPlay();
          };
          document.addEventListener('pointerdown', pendingListener, { once: true });
        } else {
          console.warn('[RichContent] autoplay failed:', err?.name ?? err);
        }
      });
      return true;
    };

    if (!tryPlay()) {
      // DOM may not be fully updated yet — retry on next frame.
      raf = requestAnimationFrame(() => tryPlay());
    }

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      if (pendingListener) {
        document.removeEventListener('pointerdown', pendingListener);
        pendingListener = null;
      }
    };
  }, [autoplayFirst, resolutionRan]);

  return (
    <div ref={containerRef} className={className} dangerouslySetInnerHTML={{ __html: finalHtml }} />
  );
};
