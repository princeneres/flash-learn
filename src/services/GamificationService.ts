import { supabase } from '../lib/supabase';
import { toast } from '../components/ui/use-toast';
import i18n from '../i18n';

const todayKey = (d: Date = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const dayDiff = (a: string, b: string) => {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
};

export interface LeaderboardEntry {
  id: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  points: number;
  stats: { totalReviews: number; streak: number };
}

export const GamificationService = {
  awardPoints: async (userId: string, points: number) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('points, total_reviews')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) return;
    await supabase
      .from('profiles')
      .update({
        points: data.points + points,
        total_reviews: data.total_reviews + 1,
      })
      .eq('id', userId);
  },

  updateStreak: async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('streak, last_study_date')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) return { streak: 0, changed: false };

    const today = todayKey();
    const last: string | null = data.last_study_date;
    const prev: number = data.streak ?? 0;

    if (last === today) {
      return { streak: prev, changed: false };
    }

    const next = last && dayDiff(last, today) === 1 ? prev + 1 : 1;

    await supabase
      .from('profiles')
      .update({ streak: next, last_study_date: today })
      .eq('id', userId);
    return { streak: next, changed: true };
  },

  checkAchievements: async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('total_reviews')
      .eq('id', userId)
      .maybeSingle();
    if (!data) return;
    const reviews = data.total_reviews ?? 0;
    if (reviews === 10) {
      await GamificationService.unlockAchievement(
        userId,
        'first_10_reviews',
        'Rookie Reviewer'
      );
    }
    if (reviews === 100) {
      await GamificationService.unlockAchievement(
        userId,
        '100_reviews',
        'Centurion'
      );
    }
  },

  unlockAchievement: async (
    userId: string,
    key: string,
    title: string
  ): Promise<void> => {
    const { data: existing } = await supabase
      .from('achievements')
      .select('id')
      .eq('owner_id', userId)
      .eq('key', key)
      .maybeSingle();
    if (existing) return;
    const { error } = await supabase
      .from('achievements')
      .insert({ owner_id: userId, key });
    if (error) {
      // Unique violation = already unlocked; ignore.
      if (error.code !== '23505') console.error(error);
      return;
    }
    toast({ title: i18n.t('gamification.achievement', { title }) });
  },

  getLeaderboard: async (): Promise<LeaderboardEntry[]> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, email, photo_url, points, total_reviews, streak')
      .order('points', { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      displayName: r.display_name,
      email: r.email,
      photoURL: r.photo_url,
      points: r.points,
      stats: { totalReviews: r.total_reviews, streak: r.streak },
    }));
  },
};
