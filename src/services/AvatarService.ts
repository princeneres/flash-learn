import { callApi } from '../lib/api';
import { downscaleImage } from '../lib/image';

const BUCKET = 'avatars';
// One object per user, overwritten on each upload. The public URL is therefore
// stable, so we append a cache-busting query string when we hand it back.
const objectPath = (uid: string) => `${uid}/avatar`;

export const AvatarService = {
  /**
   * Downscale, upload to the public avatars bucket (overwriting any previous
   * avatar), and return a cache-busted public URL ready to store on the
   * profile. The leaderboard reads these straight from `profiles.photo_url`.
   */
  upload: async (uid: string, file: File): Promise<string> => {
    const blob = await downscaleImage(file, { maxSize: 512, quality: 0.85 });
    const path = objectPath(uid);
    const contentType = blob.type || file.type || 'image/jpeg';
    const { url, publicUrl } = await callApi<{ url: string; publicUrl: string }>('storage', {
      action: 'upload-url',
      bucket: BUCKET,
      path,
      contentType,
    });
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: blob,
    });
    if (!res.ok) throw new Error(`Avatar upload failed (${res.status})`);
    return `${publicUrl}?t=${Date.now()}`;
  },
};
