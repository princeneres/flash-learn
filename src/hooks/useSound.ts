import { useCallback, useEffect, useState } from 'react';
import { SoundService, type SoundName } from '../services/SoundService';

const STORAGE_KEY = 'fl.soundEnabled';

function readEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  // Default on — sound makes the session feel alive; the user can mute it.
  return window.localStorage.getItem(STORAGE_KEY) !== 'false';
}

/**
 * Study sound effects with a persisted on/off preference.
 * `play` is a no-op while muted, so callers don't need to branch.
 */
export function useSound() {
  const [enabled, setEnabled] = useState<boolean>(readEnabled);

  // Keep the preference in sync across tabs.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setEnabled(readEnabled());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* ignore storage failures (private mode, etc.) */
      }
      return next;
    });
  }, []);

  const play = useCallback(
    (name: SoundName) => {
      if (enabled) SoundService.play(name);
    },
    [enabled]
  );

  return { enabled, toggle, play };
}
