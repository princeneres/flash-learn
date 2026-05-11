import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject, getBlob } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { UserSettingsService } from './UserSettingsService';
import { LocalDirectoryService } from './LocalDirectoryService';

const DB_NAME = 'flash-learn-media';
const DB_VERSION = 2;
const STORE_AUDIO = 'audio';
const STORE_IMAGE = 'images';

export type MediaKind = 'audio' | 'image';

let dbPromise: Promise<IDBDatabase> | null = null;

const openDb = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_AUDIO)) {
        db.createObjectStore(STORE_AUDIO);
      }
      if (!db.objectStoreNames.contains(STORE_IMAGE)) {
        db.createObjectStore(STORE_IMAGE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
};

const storeFor = (kind: MediaKind): string =>
  kind === 'audio' ? STORE_AUDIO : STORE_IMAGE;

const idbPut = async (kind: MediaKind, ref: string, blob: Blob): Promise<void> => {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeFor(kind), 'readwrite');
    tx.objectStore(storeFor(kind)).put(blob, ref);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
};

const idbGet = async (kind: MediaKind, ref: string): Promise<Blob | null> => {
  const db = await openDb();
  return new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(storeFor(kind), 'readonly');
    const req = tx.objectStore(storeFor(kind)).get(ref);
    req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
};

const idbDelete = async (kind: MediaKind, ref: string): Promise<void> => {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeFor(kind), 'readwrite');
    tx.objectStore(storeFor(kind)).delete(ref);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const idbListAll = async (kind: MediaKind): Promise<Array<{ ref: string; blob: Blob }>> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const out: Array<{ ref: string; blob: Blob }> = [];
    const tx = db.transaction(storeFor(kind), 'readonly');
    const cursorReq = tx.objectStore(storeFor(kind)).openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        out.push({ ref: String(cursor.key), blob: cursor.value as Blob });
        cursor.continue();
      }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
    tx.oncomplete = () => resolve(out);
    tx.onerror = () => reject(tx.error);
  });
};

const idbCount = async (kind: MediaKind): Promise<number> => {
  const db = await openDb();
  return new Promise<number>((resolve, reject) => {
    const tx = db.transaction(storeFor(kind), 'readonly');
    const req = tx.objectStore(storeFor(kind)).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

// Cloud helpers
const cloudPath = (uid: string, kind: MediaKind, ref: string): string =>
  `users/${uid}/${kind}/${ref}`;

const cloudPut = async (
  uid: string,
  kind: MediaKind,
  ref: string,
  blob: Blob
): Promise<void> => {
  const r = storageRef(storage, cloudPath(uid, kind, ref));
  await uploadBytes(r, blob, { contentType: blob.type || undefined });
};

const cloudGetUrl = async (
  uid: string,
  kind: MediaKind,
  ref: string
): Promise<string | null> => {
  try {
    const r = storageRef(storage, cloudPath(uid, kind, ref));
    return await getDownloadURL(r);
  } catch {
    return null;
  }
};

const cloudGetBlob = async (
  uid: string,
  kind: MediaKind,
  ref: string
): Promise<Blob | null> => {
  try {
    const r = storageRef(storage, cloudPath(uid, kind, ref));
    return await getBlob(r);
  } catch {
    return null;
  }
};

const cloudDelete = async (
  uid: string,
  kind: MediaKind,
  ref: string
): Promise<void> => {
  try {
    const r = storageRef(storage, cloudPath(uid, kind, ref));
    await deleteObject(r);
  } catch {
    // ignore
  }
};

// Resolved URL cache (object URLs for local, download URLs for cloud)
const urlCache = new Map<string, string>();
const objectUrls = new Set<string>();

const cacheKey = (kind: MediaKind, ref: string) => `${kind}:${ref}`;

const revokeCachedObjectUrl = (kind: MediaKind, ref: string) => {
  const key = cacheKey(kind, ref);
  const cached = urlCache.get(key);
  if (cached && objectUrls.has(cached)) {
    URL.revokeObjectURL(cached);
    objectUrls.delete(cached);
  }
  urlCache.delete(key);
};

export interface MediaEntry {
  ref: string;
  blob: Blob;
}

export const MediaStorageService = {
  /** Store a media blob. Prefers user-chosen directory when active, else IDB. */
  put: async (kind: MediaKind, ref: string, blob: Blob): Promise<void> => {
    const backend = UserSettingsService.getMediaBackendSync();
    const uid = UserSettingsService.getCurrentUid();
    if (backend === 'cloud' && uid) {
      await cloudPut(uid, kind, ref, blob);
      await idbPut(kind, ref, blob);
    } else {
      const wroteToDir = await LocalDirectoryService.putFile(kind, ref, blob);
      if (!wroteToDir) {
        await idbPut(kind, ref, blob);
      }
    }
    revokeCachedObjectUrl(kind, ref);
  },

  /** Get a resolvable URL. Tries cache → directory → IDB → cloud. */
  getUrl: async (kind: MediaKind, ref: string): Promise<string | null> => {
    const key = cacheKey(kind, ref);
    const cached = urlCache.get(key);
    if (cached) return cached;

    const dirBlob = await LocalDirectoryService.getFile(kind, ref);
    if (dirBlob) {
      const url = URL.createObjectURL(dirBlob);
      urlCache.set(key, url);
      objectUrls.add(url);
      return url;
    }

    const localBlob = await idbGet(kind, ref);
    if (localBlob) {
      const url = URL.createObjectURL(localBlob);
      urlCache.set(key, url);
      objectUrls.add(url);
      return url;
    }

    const uid = UserSettingsService.getCurrentUid();
    if (uid) {
      const url = await cloudGetUrl(uid, kind, ref);
      if (url) {
        urlCache.set(key, url);
        return url;
      }
    }
    return null;
  },

  /** Retrieve blob (for export). Tries directory → IDB → cloud. */
  getBlob: async (kind: MediaKind, ref: string): Promise<Blob | null> => {
    const dir = await LocalDirectoryService.getFile(kind, ref);
    if (dir) return dir;
    const local = await idbGet(kind, ref);
    if (local) return local;
    const uid = UserSettingsService.getCurrentUid();
    if (uid) return cloudGetBlob(uid, kind, ref);
    return null;
  },

  has: async (kind: MediaKind, ref: string): Promise<boolean> => {
    const local = await idbGet(kind, ref);
    return local !== null;
  },

  delete: async (kind: MediaKind, ref: string): Promise<void> => {
    const uid = UserSettingsService.getCurrentUid();
    await Promise.all([
      idbDelete(kind, ref),
      LocalDirectoryService.deleteFile(kind, ref),
    ]);
    if (uid) await cloudDelete(uid, kind, ref);
    revokeCachedObjectUrl(kind, ref);
  },

  listAll: async (kind: MediaKind): Promise<MediaEntry[]> => idbListAll(kind),

  count: async (kind?: MediaKind): Promise<number> => {
    if (kind) return idbCount(kind);
    const [a, i] = await Promise.all([idbCount('audio'), idbCount('image')]);
    return a + i;
  },

  /** Migrate all local media to cloud (used when switching to cloud backend). */
  migrateLocalToCloud: async (
    uid: string,
    onProgress?: (done: number, total: number) => void
  ): Promise<{ uploaded: number; failed: number }> => {
    const [audio, images] = await Promise.all([
      idbListAll('audio'),
      idbListAll('image'),
    ]);
    const all: Array<{ kind: MediaKind; ref: string; blob: Blob }> = [
      ...audio.map((e) => ({ kind: 'audio' as const, ref: e.ref, blob: e.blob })),
      ...images.map((e) => ({ kind: 'image' as const, ref: e.ref, blob: e.blob })),
    ];
    let uploaded = 0;
    let failed = 0;
    for (let i = 0; i < all.length; i++) {
      const { kind, ref, blob } = all[i];
      try {
        await cloudPut(uid, kind, ref, blob);
        uploaded++;
      } catch (err) {
        console.error('migrate failed for', ref, err);
        failed++;
      }
      onProgress?.(i + 1, all.length);
    }
    return { uploaded, failed };
  },

  // === Backwards-compatible audio-only API (used by PlayAudioButton, MediaSyncService) ===
  putAudio: async (ref: string, blob: Blob): Promise<void> => {
    await idbPut('audio', ref, blob);
    revokeCachedObjectUrl('audio', ref);
  },

  getAudioBlob: async (ref: string): Promise<Blob | null> => idbGet('audio', ref),

  getAudioUrl: async (ref: string): Promise<string | null> =>
    MediaStorageService.getUrl('audio', ref),

  hasAudio: async (ref: string): Promise<boolean> => {
    const b = await idbGet('audio', ref);
    return b !== null;
  },

  deleteAudio: async (ref: string): Promise<void> => {
    await idbDelete('audio', ref);
    revokeCachedObjectUrl('audio', ref);
  },
};

export type AudioEntry = MediaEntry;
