/* eslint-disable @typescript-eslint/no-explicit-any */
const DB_NAME = 'flash-learn-dir';
const DB_VERSION = 1;
const STORE = 'config';
const HANDLE_KEY = 'directory-handle';

type Kind = 'audio' | 'image';

let dbPromise: Promise<IDBDatabase> | null = null;
let handleCache: any | null = null;

const openDb = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
};

const idbGetHandle = async (): Promise<any | null> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(HANDLE_KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
};

const idbPutHandle = async (h: any | null): Promise<void> => {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    if (h) store.put(h, HANDLE_KEY);
    else store.delete(HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const queryPerm = async (h: any): Promise<PermissionState> => {
  if (typeof h.queryPermission === 'function') {
    return h.queryPermission({ mode: 'readwrite' });
  }
  return 'prompt';
};

const requestPerm = async (h: any): Promise<PermissionState> => {
  if (typeof h.requestPermission === 'function') {
    return h.requestPermission({ mode: 'readwrite' });
  }
  return 'denied';
};

export const LocalDirectoryService = {
  isSupported: (): boolean =>
    typeof window !== 'undefined' &&
    typeof (window as any).showDirectoryPicker === 'function',

  loadCached: async (): Promise<any | null> => {
    if (handleCache) return handleCache;
    handleCache = await idbGetHandle();
    return handleCache;
  },

  pick: async (): Promise<any | null> => {
    if (!LocalDirectoryService.isSupported()) return null;
    const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
    handleCache = handle;
    await idbPutHandle(handle);
    return handle;
  },

  clear: async (): Promise<void> => {
    handleCache = null;
    await idbPutHandle(null);
  },

  /**
   * Resolve an active, permission-granted handle.
   * If user gesture is required (perm === 'prompt'), pass requestIfNeeded=true.
   */
  getActive: async (requestIfNeeded = false): Promise<any | null> => {
    const h = await LocalDirectoryService.loadCached();
    if (!h) return null;
    const perm = await queryPerm(h);
    if (perm === 'granted') return h;
    if (perm === 'prompt' && requestIfNeeded) {
      const next = await requestPerm(h);
      if (next === 'granted') return h;
    }
    return null;
  },

  /** Returns the configured directory's name even if permission isn't currently granted. */
  getName: async (): Promise<string | null> => {
    const h = await LocalDirectoryService.loadCached();
    return h?.name ?? null;
  },

  /** Returns permission state without prompting. */
  getPermissionState: async (): Promise<'none' | 'granted' | 'prompt' | 'denied'> => {
    const h = await LocalDirectoryService.loadCached();
    if (!h) return 'none';
    const p = await queryPerm(h);
    return p;
  },

  /** Request permission (must be invoked from a user gesture). */
  reconnect: async (): Promise<boolean> => {
    const h = await LocalDirectoryService.loadCached();
    if (!h) return false;
    const p = await requestPerm(h);
    return p === 'granted';
  },

  putFile: async (kind: Kind, ref: string, blob: Blob): Promise<boolean> => {
    const h = await LocalDirectoryService.getActive();
    if (!h) return false;
    try {
      const sub = await h.getDirectoryHandle(kind, { create: true });
      const file = await sub.getFileHandle(ref, { create: true });
      const writable = await file.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (err) {
      console.error('LocalDirectoryService.putFile failed', err);
      return false;
    }
  },

  getFile: async (kind: Kind, ref: string): Promise<Blob | null> => {
    const h = await LocalDirectoryService.getActive();
    if (!h) return null;
    try {
      const sub = await h.getDirectoryHandle(kind);
      const fileHandle = await sub.getFileHandle(ref);
      const f = await fileHandle.getFile();
      return f;
    } catch {
      return null;
    }
  },

  deleteFile: async (kind: Kind, ref: string): Promise<void> => {
    const h = await LocalDirectoryService.getActive();
    if (!h) return;
    try {
      const sub = await h.getDirectoryHandle(kind);
      await sub.removeEntry(ref);
    } catch {
      // ignore
    }
  },
};
