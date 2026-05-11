import JSZip from 'jszip';
import { MediaStorageService } from './MediaStorageService';

const MANIFEST = 'manifest.json';
const AUDIO_DIR = 'audio/';

interface BundleManifest {
  version: 1;
  exportedAt: string;
  count: number;
  refs: string[];
}

export const MediaSyncService = {
  /** Build a zip with all locally stored audio + manifest. */
  exportBundle: async (): Promise<{ blob: Blob; count: number }> => {
    const entries = await MediaStorageService.listAll('audio');
    const zip = new JSZip();
    const refs: string[] = [];

    for (const { ref, blob } of entries) {
      zip.file(`${AUDIO_DIR}${ref}`, blob);
      refs.push(ref);
    }

    const manifest: BundleManifest = {
      version: 1,
      exportedAt: new Date().toISOString(),
      count: entries.length,
      refs,
    };
    zip.file(MANIFEST, JSON.stringify(manifest, null, 2));

    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'STORE', // audio is already compressed
    });
    return { blob, count: entries.length };
  },

  /** Restore a zip bundle into IndexedDB. Skips refs already present unless overwrite. */
  importBundle: async (
    file: File | Blob,
    onProgress?: (done: number, total: number) => void
  ): Promise<{ added: number; skipped: number }> => {
    const zip = await JSZip.loadAsync(file);
    const audioFiles = Object.values(zip.files).filter(
      (f) => !f.dir && f.name.startsWith(AUDIO_DIR)
    );
    const total = audioFiles.length;
    let added = 0;
    let skipped = 0;

    for (let i = 0; i < audioFiles.length; i++) {
      const f = audioFiles[i];
      const ref = f.name.slice(AUDIO_DIR.length);
      if (!ref) {
        skipped++;
        continue;
      }
      const existing = await MediaStorageService.hasAudio(ref);
      if (existing) {
        skipped++;
      } else {
        const blob = await f.async('blob');
        await MediaStorageService.putAudio(ref, blob);
        added++;
      }
      onProgress?.(i + 1, total);
    }
    return { added, skipped };
  },
};
