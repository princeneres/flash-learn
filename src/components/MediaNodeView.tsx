import React, { useEffect, useState } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { AudioLines, Loader2 } from 'lucide-react';
import { MediaStorageService } from '../services/MediaStorageService';

const decode = (raw: string): string => {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

const resolveSrc = async (
  src: string | null | undefined,
  kind: 'image' | 'audio'
): Promise<string | null> => {
  if (!src) return null;
  const m = src.match(/^media:\/\/(.+)$/);
  if (!m) return src;
  return MediaStorageService.getUrl(kind, decode(m[1]));
};

export const ImageNodeView: React.FC<NodeViewProps> = ({ node }) => {
  const src = (node.attrs.src as string | null) ?? null;
  const alt = (node.attrs.alt as string | null) ?? '';
  const [resolved, setResolved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    resolveSrc(src, 'image').then((url) => {
      if (active) {
        setResolved(url);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [src]);

  return (
    <NodeViewWrapper as="span" className="inline-block align-middle">
      {loading && (
        <span className="inline-flex items-center gap-2 rounded border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          loading…
        </span>
      )}
      {!loading && resolved && (
        <img
          src={resolved}
          alt={alt}
          className="max-h-72 rounded"
          draggable={false}
        />
      )}
      {!loading && !resolved && (
        <span className="inline-flex items-center gap-2 rounded border border-dashed border-red-500/50 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-300">
          missing image
        </span>
      )}
    </NodeViewWrapper>
  );
};

export const AudioNodeView: React.FC<NodeViewProps> = ({ node }) => {
  const src = (node.attrs.src as string | null) ?? null;
  const [resolved, setResolved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    resolveSrc(src, 'audio').then((url) => {
      if (active) {
        setResolved(url);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [src]);

  return (
    <NodeViewWrapper className="my-2">
      {loading && (
        <span className="inline-flex items-center gap-2 rounded border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          loading…
        </span>
      )}
      {!loading && resolved && (
        <span className="inline-flex items-center gap-2">
          <AudioLines className="h-4 w-4 text-primary" />
          <audio controls src={resolved} className="h-8" />
        </span>
      )}
      {!loading && !resolved && (
        <span className="inline-flex items-center gap-2 rounded border border-dashed border-red-500/50 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-300">
          missing audio
        </span>
      )}
    </NodeViewWrapper>
  );
};
