import { supabase } from '../lib/supabase';
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
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
      upsert: true,
      contentType: blob.type || file.type || 'image/jpeg',
    });
    if (error) throw error;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return `${data.publicUrl}?t=${Date.now()}`;
  },
};
