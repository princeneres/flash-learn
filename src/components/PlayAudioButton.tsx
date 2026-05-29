import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Pause, AudioLines } from 'lucide-react';
import { clsx } from 'clsx';
import { MediaStorageService } from '../services/MediaStorageService';

interface Props {
  /** Filename ref stored on the card. */
  audioRef: string;
  /** Owner uid that wrote the file — required when not the viewer. */
  ownerId?: string;
  className?: string;
  size?: 'sm' | 'md';
  ariaLabel?: string;
  /** When true, plays automatically as soon as the URL resolves. */
  autoplay?: boolean;
}

export const PlayAudioButton: React.FC<Props> = ({
  audioRef,
  ownerId,
  className,
  size = 'md',
  ariaLabel,
  autoplay,
}) => {
  const { t } = useTranslation();
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setResolved(false);
    setUrl(null);
    MediaStorageService.getAudioUrl(audioRef, ownerId)
      .then((u) => {
        if (cancelled) return;
        setUrl(u);
        setResolved(true);
      })
      .catch(() => {
        if (cancelled) return;
        setResolved(true);
      });
    return () => {
      cancelled = true;
      audioElRef.current?.pause();
      audioElRef.current = null;
    };
  }, [audioRef, ownerId]);

  const ensureAudioEl = (src: string): HTMLAudioElement => {
    if (!audioElRef.current) {
      const audio = new Audio(src);
      audio.addEventListener('ended', () => setPlaying(false));
      audio.addEventListener('pause', () => setPlaying(false));
      audio.addEventListener('play', () => setPlaying(true));
      audio.addEventListener('error', () => setPlaying(false));
      audioElRef.current = audio;
    }
    return audioElRef.current;
  };

  useEffect(() => {
    if (!autoplay || !url) return;
    let cancelled = false;
    let pendingListener: (() => void) | null = null;

    const play = () => {
      const audio = ensureAudioEl(url);
      audio.currentTime = 0;
      void audio.play().catch((err) => {
        setPlaying(false);
        if (cancelled) return;
        if (err?.name === 'NotAllowedError' && !pendingListener) {
          pendingListener = () => {
            pendingListener = null;
            if (cancelled) return;
            play();
          };
          document.addEventListener('pointerdown', pendingListener, { once: true });
        }
      });
    };
    play();

    return () => {
      cancelled = true;
      if (pendingListener) {
        document.removeEventListener('pointerdown', pendingListener);
        pendingListener = null;
      }
    };
    // intentional: re-run on url + autoplay changes only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, url]);

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!url) return;
    const audio = ensureAudioEl(url);
    if (playing) {
      audio.pause();
      audio.currentTime = 0;
    } else {
      audio.currentTime = 0;
      void audio.play().catch(() => setPlaying(false));
    }
  };

  const sizeCls = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9';
  const iconCls = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const missing = resolved && !url;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel ?? (playing ? t('audio.pause') : t('audio.play'))}
      title={missing ? t('audio.notStored') : undefined}
      disabled={!url}
      className={clsx(
        'inline-flex items-center justify-center rounded-full border transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        sizeCls,
        missing
          ? 'border-border/40 bg-muted/20 text-muted-foreground/50 cursor-not-allowed'
          : 'border-border/60 bg-muted/40 text-foreground/80 hover:bg-primary/20 hover:text-primary',
        className
      )}
    >
      {missing ? (
        <AudioLines className={iconCls} />
      ) : playing ? (
        <Pause className={iconCls} />
      ) : (
        <Play className={iconCls} />
      )}
    </button>
  );
};
