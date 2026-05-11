import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, AudioLines } from 'lucide-react';
import { clsx } from 'clsx';
import { MediaStorageService } from '../services/MediaStorageService';

interface Props {
  /** Filename ref stored on the card (resolved against IndexedDB). */
  audioRef: string;
  className?: string;
  size?: 'sm' | 'md';
  ariaLabel?: string;
}

export const PlayAudioButton: React.FC<Props> = ({
  audioRef,
  className,
  size = 'md',
  ariaLabel = 'Play audio',
}) => {
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setResolved(false);
    setUrl(null);
    MediaStorageService.getAudioUrl(audioRef)
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
  }, [audioRef]);

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!url) return;
    if (!audioElRef.current) {
      const audio = new Audio(url);
      audio.addEventListener('ended', () => setPlaying(false));
      audio.addEventListener('pause', () => setPlaying(false));
      audio.addEventListener('play', () => setPlaying(true));
      audio.addEventListener('error', () => setPlaying(false));
      audioElRef.current = audio;
    }
    if (playing) {
      audioElRef.current.pause();
      audioElRef.current.currentTime = 0;
    } else {
      audioElRef.current.currentTime = 0;
      void audioElRef.current.play().catch(() => setPlaying(false));
    }
  };

  const sizeCls = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9';
  const iconCls = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const missing = resolved && !url;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel}
      title={missing ? 'Audio not stored on this device' : undefined}
      disabled={!url}
      className={clsx(
        'inline-flex items-center justify-center rounded-full border transition active:scale-95',
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
