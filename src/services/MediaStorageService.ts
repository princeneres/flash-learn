import { callApi } from '../lib/api';
import { UserSettingsService } from './UserSettingsService';

export type MediaKind = 'audio' | 'image';

const BUCKET = 'media';
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
// Object storage helpers (presigned URLs from /api/storage)
// ============================================================

const storagePath = (uid: string, kind: MediaKind, ref: string): string =>
  `${uid}/${kind}/${ref}`;

const signedDownloadUrl = async (
  path: string
): Promise<{ url: string; expiresIn: number } | null> => {
  try {
    return await callApi('storage', { action: 'download-url', bucket: BUCKET, path });
  } catch {
    return null;
  }
};

const removePaths = (paths: string[]) =>
  callApi('storage', { action: 'delete', bucket: BUCKET, paths });

const memUrlCache = new Map<string, string>();
const memBlobCache = new Map<string, Blob>();

const cacheKey = (uid: string, kind: MediaKind, ref: string) =>
  `${uid}:${kind}:${ref}`;
const urlKey = (uid: string, kind: MediaKind, ref: string) =>
  `${uid}:${kind}:${ref}`;

export const MediaStorageService = {
  put: async (kind: MediaKind, ref: string, blob: Blob): Promise<void> => {
    const uid = UserSettingsService.getCurrentUid();
    if (!uid) throw new Error('Not authenticated');
    const contentType = blob.type || 'application/octet-stream';
    const { url } = await callApi<{ url: string }>('storage', {
      action: 'upload-url',
      bucket: BUCKET,
      path: storagePath(uid, kind, ref),
      contentType,
    });
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: blob,
    });
    if (!res.ok) throw new Error(`Media upload failed (${res.status})`);
    memBlobCache.set(cacheKey(uid, kind, ref), blob);
    memUrlCache.delete(cacheKey(uid, kind, ref));
    await urlCacheDelete(urlKey(uid, kind, ref));
  },

  getUrl: async (
    kind: MediaKind,
    ref: string,
    ownerId?: string
  ): Promise<string | null> => {
    const uid = ownerId ?? UserSettingsService.getCurrentUid();
    if (!uid) return null;
    const k = cacheKey(uid, kind, ref);
    const inMem = memUrlCache.get(k);
    if (inMem) return inMem;

    const persisted = await urlCacheGet(urlKey(uid, kind, ref));
    if (
      persisted &&
      persisted.expiresAt - Date.now() > SIGNED_URL_REFRESH_THRESHOLD_MS
    ) {
      memUrlCache.set(k, persisted.url);
      return persisted.url;
    }

    const signed = await signedDownloadUrl(storagePath(uid, kind, ref));
    if (!signed) return null;
    const entry: CachedUrl = {
      url: signed.url,
      expiresAt: Date.now() + signed.expiresIn * 1000,
    };
    memUrlCache.set(k, entry.url);
    await urlCachePut(urlKey(uid, kind, ref), entry);
    return entry.url;
  },

  getBlob: async (
    kind: MediaKind,
    ref: string,
    ownerId?: string
  ): Promise<Blob | null> => {
    const uid = ownerId ?? UserSettingsService.getCurrentUid();
    if (!uid) return null;
    const cached = memBlobCache.get(cacheKey(uid, kind, ref));
    if (cached) return cached;
    const signed = await signedDownloadUrl(storagePath(uid, kind, ref));
    if (!signed) return null;
    const res = await fetch(signed.url);
    if (!res.ok) return null;
    const data = await res.blob();
    memBlobCache.set(cacheKey(uid, kind, ref), data);
    return data;
  },

  getAudioUrl: async (ref: string, ownerId?: string): Promise<string | null> =>
    MediaStorageService.getUrl('audio', ref, ownerId),

  delete: async (kind: MediaKind, ref: string): Promise<void> => {
    const uid = UserSettingsService.getCurrentUid();
    if (!uid) return;
    await removePaths([storagePath(uid, kind, ref)]);
    memUrlCache.delete(cacheKey(uid, kind, ref));
    memBlobCache.delete(cacheKey(uid, kind, ref));
    await urlCacheDelete(urlKey(uid, kind, ref));
  },

  deleteMany: async (items: Array<{ kind: MediaKind; ref: string }>): Promise<void> => {
    if (items.length === 0) return;
    const uid = UserSettingsService.getCurrentUid();
    if (!uid) return;
    const paths = items.map((i) => storagePath(uid, i.kind, i.ref));
    await removePaths(paths);
    for (const { kind, ref } of items) {
      memUrlCache.delete(cacheKey(uid, kind, ref));
      memBlobCache.delete(cacheKey(uid, kind, ref));
      await urlCacheDelete(urlKey(uid, kind, ref));
    }
  },
};
