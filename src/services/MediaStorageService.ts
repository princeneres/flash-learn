import { supabase } from '../lib/supabase';
import { UserSettingsService } from './UserSettingsService';

export type MediaKind = 'audio' | 'image';

const BUCKET = 'media';
const SIGNED_URL_TTL_SEC = 60 * 60 * 24 * 7; // 7 days
const SIGNED_URL_REFRESH_THRESHOLD_MS = 60 * 60 * 24 * 1000; // refresh if < 24h left

// ============================================================
// Persistent signed-URL cache
// ============================================================

const URL_DB_NAME = 'flash-learn-url-cache';
const URL_STORE = 'urls';
let urlDbPromise: Promise<IDBDatabase> | null = null;

interface CachedUrl {
  url: string;
  expiresAt: number;
}

const openUrlDb = (): Promise<IDBDatabase> => {
  if (urlDbPromise) return urlDbPromise;
  urlDbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(URL_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(URL_STORE)) db.createObjectStore(URL_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return urlDbPromise;
};

const urlCacheGet = async (key: string): Promise<CachedUrl | null> => {
  try {
    const db = await openUrlDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(URL_STORE, 'readonly');
      const req = tx.objectStore(URL_STORE).get(key);
      req.onsuccess = () => resolve((req.result as CachedUrl | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
};

const urlCachePut = async (key: string, entry: CachedUrl): Promise<void> => {
  try {
    const db = await openUrlDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(URL_STORE, 'readwrite');
      tx.objectStore(URL_STORE).put(entry, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
};

const urlCacheDelete = async (key: string): Promise<void> => {
  try {
    const db = await openUrlDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(URL_STORE, 'readwrite');
      tx.objectStore(URL_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
};

// ============================================================
// Supabase Storage helpers
// ============================================================

const storagePath = (uid: string, kind: MediaKind, ref: string): string =>
  `${uid}/${kind}/${ref}`;

const memUrlCache = new Map<string, string>();
const memBlobCache = new Map<string, Blob>();

const cacheKey = (kind: MediaKind, ref: string) => `${kind}:${ref}`;
const urlKey = (uid: string, kind: MediaKind, ref: string) =>
  `${uid}:${kind}:${ref}`;

export const MediaStorageService = {
  put: async (kind: MediaKind, ref: string, blob: Blob): Promise<void> => {
    const uid = UserSettingsService.getCurrentUid();
    if (!uid) throw new Error('Not authenticated');
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath(uid, kind, ref), blob, {
        upsert: true,
        contentType: blob.type || undefined,
      });
    if (error) throw error;
    memBlobCache.set(cacheKey(kind, ref), blob);
    memUrlCache.delete(cacheKey(kind, ref));
    await urlCacheDelete(urlKey(uid, kind, ref));
  },

  getUrl: async (kind: MediaKind, ref: string): Promise<string | null> => {
    const k = cacheKey(kind, ref);
    const inMem = memUrlCache.get(k);
    if (inMem) return inMem;

    const uid = UserSettingsService.getCurrentUid();
    if (!uid) return null;

    const persisted = await urlCacheGet(urlKey(uid, kind, ref));
    if (
      persisted &&
      persisted.expiresAt - Date.now() > SIGNED_URL_REFRESH_THRESHOLD_MS
    ) {
      memUrlCache.set(k, persisted.url);
      return persisted.url;
    }

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath(uid, kind, ref), SIGNED_URL_TTL_SEC);
    if (error || !data) return null;
    const entry: CachedUrl = {
      url: data.signedUrl,
      expiresAt: Date.now() + SIGNED_URL_TTL_SEC * 1000,
    };
    memUrlCache.set(k, entry.url);
    await urlCachePut(urlKey(uid, kind, ref), entry);
    return entry.url;
  },

  getBlob: async (kind: MediaKind, ref: string): Promise<Blob | null> => {
    const cached = memBlobCache.get(cacheKey(kind, ref));
    if (cached) return cached;
    const uid = UserSettingsService.getCurrentUid();
    if (!uid) return null;
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(storagePath(uid, kind, ref));
    if (error || !data) return null;
    memBlobCache.set(cacheKey(kind, ref), data);
    return data;
  },

  getAudioUrl: async (ref: string): Promise<string | null> =>
    MediaStorageService.getUrl('audio', ref),

  delete: async (kind: MediaKind, ref: string): Promise<void> => {
    const uid = UserSettingsService.getCurrentUid();
    if (!uid) return;
    await supabase.storage.from(BUCKET).remove([storagePath(uid, kind, ref)]);
    memUrlCache.delete(cacheKey(kind, ref));
    memBlobCache.delete(cacheKey(kind, ref));
    await urlCacheDelete(urlKey(uid, kind, ref));
  },

  deleteMany: async (items: Array<{ kind: MediaKind; ref: string }>): Promise<void> => {
    if (items.length === 0) return;
    const uid = UserSettingsService.getCurrentUid();
    if (!uid) return;
    const paths = items.map((i) => storagePath(uid, i.kind, i.ref));
    await supabase.storage.from(BUCKET).remove(paths);
    for (const { kind, ref } of items) {
      memUrlCache.delete(cacheKey(kind, ref));
      memBlobCache.delete(cacheKey(kind, ref));
      await urlCacheDelete(urlKey(uid, kind, ref));
    }
  },
};
