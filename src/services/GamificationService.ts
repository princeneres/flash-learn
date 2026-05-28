import { supabase } from '../lib/supabase';
import { toast } from '../components/ui/use-toast';
import i18n from '../i18n';

export interface LeaderboardEntry {
  id: string;
  displayName: string | null;
  photoURL: string | null;
  points: number;
  stats: { totalReviews: number; streak: number };
}

// Milestone keys map to display titles for the unlock toast. Points, streak,
// and the unlock decision are all enforced server-side by record_review.
const ACHIEVEMENT_TITLES: Record<string, string> = {
  first_10_reviews: 'Rookie Reviewer',
  '100_reviews': 'Centurion',
};

export const GamificationService = {
  // Awards points, advances the streak, and unlocks achievements for a review,
  // enforced server-side so scores can't be forged from the client.
  recordReview: async (cardId: string, quality: number): Promise<void> => {
    const { data, error } = await supabase.rpc('record_review', {
      p_card_id: cardId,
      p_quality: quality,
    });
    if (error) {
      console.error('record_review failed', error);
      return;
    }
    const key = (data as { achievement?: string | null })?.achievement ?? null;
    if (key) {
      const title = ACHIEVEMENT_TITLES[key] ?? key;
      toast({ title: i18n.t('gamification.achievement', { title }) });
    }
  },

  getLeaderboard: async (): Promise<LeaderboardEntry[]> => {
    const { data, error } = await supabase.rpc('get_leaderboard');
    if (error) throw error;
    return (
      (data as Array<{
        id: string;
        display_name: string | null;
        photo_url: string | null;
        points: number;
        total_reviews: number;
        streak: number;
      }> | null) ?? []
    ).map((r) => ({
      id: r.id,
      displayName: r.display_name,
      photoURL: r.photo_url,
      points: r.points,
      stats: { totalReviews: r.total_reviews, streak: r.streak },
    }));
  },
};
