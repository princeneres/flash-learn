import { supabase } from '../lib/supabase';

export interface UserSettings {
  language?: string;
  soundEnabled?: boolean;
}

const cache = new Map<string, UserSettings>();
let currentUid: string | null = null;

export const UserSettingsService = {
  init: async (uid: string): Promise<UserSettings> => {
    currentUid = uid;
    const cached = cache.get(uid);
    if (cached) return cached;
    const { data } = await supabase
      .from('profiles')
      .select('language, sound_enabled')
      .eq('id', uid)
      .maybeSingle();
    const settings: UserSettings = {
      language: data?.language ?? 'en',
      soundEnabled: data?.sound_enabled ?? true,
    };
    cache.set(uid, settings);
    return settings;
  },

  getCurrentUid: (): string | null => currentUid,

  clear: (): void => {
    currentUid = null;
    cache.clear();
  },
};
