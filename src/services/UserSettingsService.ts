import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type MediaBackend = 'local' | 'cloud';

export interface UserSettings {
  language?: string;
  mediaBackend?: MediaBackend;
}

const cache = new Map<string, UserSettings>();
const listeners = new Set<(s: UserSettings) => void>();
let currentUid: string | null = null;

const STORAGE_KEY = 'flashlearn-media-backend';

const loadCached = (): MediaBackend => {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'cloud' ? 'cloud' : 'local';
};

let currentBackend: MediaBackend = loadCached();

export const UserSettingsService = {
  init: async (uid: string): Promise<UserSettings> => {
    currentUid = uid;
    const cached = cache.get(uid);
    if (cached) {
      if (cached.mediaBackend) {
        currentBackend = cached.mediaBackend;
        localStorage.setItem(STORAGE_KEY, currentBackend);
      }
      return cached;
    }
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    const data = snap.exists() ? (snap.data().settings ?? {}) : {};
    const settings: UserSettings = {
      language: data.language,
      mediaBackend: data.mediaBackend === 'cloud' ? 'cloud' : 'local',
    };
    cache.set(uid, settings);
    currentBackend = settings.mediaBackend ?? 'local';
    localStorage.setItem(STORAGE_KEY, currentBackend);
    return settings;
  },

  getMediaBackendSync: (): MediaBackend => currentBackend,

  getMediaBackend: async (uid: string): Promise<MediaBackend> => {
    const s = cache.get(uid) ?? (await UserSettingsService.init(uid));
    return s.mediaBackend ?? 'local';
  },

  setMediaBackend: async (uid: string, backend: MediaBackend): Promise<void> => {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, { 'settings.mediaBackend': backend });
    } else {
      await setDoc(ref, { settings: { mediaBackend: backend } }, { merge: true });
    }
    const existing = cache.get(uid) ?? {};
    const next = { ...existing, mediaBackend: backend };
    cache.set(uid, next);
    currentBackend = backend;
    localStorage.setItem(STORAGE_KEY, backend);
    listeners.forEach((fn) => fn(next));
  },

  subscribe: (fn: (s: UserSettings) => void): (() => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  getCurrentUid: (): string | null => currentUid,
};
