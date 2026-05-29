import { addDays, format, parseISO, startOfDay, subDays } from 'date-fns';
import { supabase } from '../lib/supabase';
import { fromDbReviewLog, type DbReviewLog, type ReviewLog } from './_mappers';

const DAY = 'yyyy-MM-dd';

/** A card that is scheduled (due) in the future, with its deck category. */
export interface DueCard {
  nextReview: string;
  status: string;
  category: string;
}

/** Raw data fetched once; all charts are derived from this client-side. */
export interface RawStats {
  logs: ReviewLog[];
  dueCards: DueCard[];
  lifetimeReviews: number;
  serverStreak: number;
  points: number;
}

export interface DayStat {
  date: string; // yyyy-MM-dd (local)
  total: number;
  correct: number;
}
export interface CategoryStat {
  category: string;
  total: number;
  correct: number;
}
export interface DueStat {
  date: string;
  count: number;
}
export interface HourStat {
  hour: number;
  count: number;
}

export interface StatsSummary {
  hasData: boolean;
  totalReviews: number; // reviews within the window (after category filter)
  lifetimeReviews: number; // headline fallback from profiles.total_reviews
  accuracy: number; // 0..1 over the window
  accuracy30d: number; // 0..1 over the last 30 days
  currentStreak: number;
  bestStreak: number;
  studyDays: number;
  newCount: number;
  reviewCount: number;
  byDay: DayStat[]; // ascending by date
  byCategory: CategoryStat[]; // descending by total
  byHour: HourStat[]; // 24 entries, hour 0..23
  dueForecast: DueStat[]; // next 14 days including today
  dueTotal: number;
}

export const StatsService = {
  /**
   * One bounded read of personal study history plus the future due queue.
   * RLS scopes both selects to the signed-in user.
   */
  getRawStats: async (ownerId: string, windowDays = 365): Promise<RawStats> => {
    const since = subDays(startOfDay(new Date()), windowDays).toISOString();

    const [logsRes, dueRes, profileRes] = await Promise.all([
      supabase
        .from('review_logs')
        .select(
          'id, owner_id, card_id, deck_id, deck_category, quality, was_correct, prev_status, reviewed_at',
        )
        .eq('owner_id', ownerId)
        .gte('reviewed_at', since)
        .order('reviewed_at', { ascending: true }),
      supabase
        .from('cards')
        .select('next_review, status, decks(category)')
        .eq('owner_id', ownerId)
        .gte('next_review', new Date().toISOString()),
      supabase
        .from('profiles')
        .select('total_reviews, streak, points')
        .eq('id', ownerId)
        .maybeSingle(),
    ]);

    if (logsRes.error) throw logsRes.error;
    if (dueRes.error) throw dueRes.error;

    const logs = ((logsRes.data as DbReviewLog[] | null) ?? []).map(fromDbReviewLog);

    const dueCards: DueCard[] = (
      (dueRes.data as Array<{
        next_review: string;
        status: string;
        decks: { category: string | null } | { category: string | null }[] | null;
      }> | null) ?? []
    ).map((row) => {
      const deck = Array.isArray(row.decks) ? row.decks[0] : row.decks;
      return {
        nextReview: row.next_review,
        status: row.status,
        category: (deck?.category ?? '').trim(),
      };
    });

    const profile = profileRes.data as {
      total_reviews: number;
      streak: number;
      points: number;
    } | null;

    return {
      logs,
      dueCards,
      lifetimeReviews: profile?.total_reviews ?? logs.length,
      serverStreak: profile?.streak ?? 0,
      points: profile?.points ?? 0,
    };
  },

  /**
   * Pure aggregation over already-fetched data. Bucketing is by the user's
   * LOCAL day so streaks and the heatmap line up with their calendar. Pass a
   * category to scope every chart; the due forecast respects it too.
   */
  aggregate: (raw: RawStats, category: string | null = null): StatsSummary => {
    const now = new Date();
    const today = startOfDay(now);

    const logs = category ? raw.logs.filter((l) => l.deckCategory === category) : raw.logs;

    const dueCards = category ? raw.dueCards.filter((d) => d.category === category) : raw.dueCards;

    // --- Per-day buckets ---
    const dayMap = new Map<string, DayStat>();
    const daySet = new Set<string>();
    const hourCounts = new Array<number>(24).fill(0);
    let correctCount = 0;
    let newCount = 0;
    const since30 = subDays(today, 30);
    let total30 = 0;
    let correct30 = 0;

    for (const log of logs) {
      const d = parseISO(log.reviewedAt);
      const key = format(d, DAY);
      daySet.add(key);
      const bucket = dayMap.get(key) ?? { date: key, total: 0, correct: 0 };
      bucket.total += 1;
      if (log.wasCorrect) {
        bucket.correct += 1;
        correctCount += 1;
      }
      dayMap.set(key, bucket);
      hourCounts[d.getHours()] += 1;
      if (log.prevStatus === 'new' || log.prevStatus === 'learning') newCount += 1;
      if (d >= since30) {
        total30 += 1;
        if (log.wasCorrect) correct30 += 1;
      }
    }

    const byDay = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // --- Streaks (local days) ---
    let currentStreak = 0;
    let cursor = today;
    if (!daySet.has(format(today, DAY))) cursor = subDays(today, 1); // grace day
    while (daySet.has(format(cursor, DAY))) {
      currentStreak += 1;
      cursor = subDays(cursor, 1);
    }

    const sortedDays = Array.from(daySet).sort();
    let bestStreak = 0;
    let run = 0;
    let prev: Date | null = null;
    for (const key of sortedDays) {
      const d = parseISO(key);
      if (prev && Math.round((d.getTime() - prev.getTime()) / 86400000) === 1) {
        run += 1;
      } else {
        run = 1;
      }
      if (run > bestStreak) bestStreak = run;
      prev = d;
    }

    // --- Per-category ---
    const catMap = new Map<string, CategoryStat>();
    for (const log of logs) {
      const cat = log.deckCategory || '';
      const bucket = catMap.get(cat) ?? { category: cat, total: 0, correct: 0 };
      bucket.total += 1;
      if (log.wasCorrect) bucket.correct += 1;
      catMap.set(cat, bucket);
    }
    const byCategory = Array.from(catMap.values()).sort((a, b) => b.total - a.total);

    // --- Due forecast: next 14 days incl. today ---
    const dueMap = new Map<string, number>();
    for (let i = 0; i < 14; i++) {
      dueMap.set(format(addDays(today, i), DAY), 0);
    }
    for (const card of dueCards) {
      const key = format(startOfDay(parseISO(card.nextReview)), DAY);
      if (dueMap.has(key)) dueMap.set(key, (dueMap.get(key) ?? 0) + 1);
    }
    const dueForecast: DueStat[] = Array.from(dueMap.entries()).map(([date, count]) => ({
      date,
      count,
    }));

    const total = logs.length;

    return {
      hasData: raw.logs.length > 0,
      totalReviews: total,
      lifetimeReviews: raw.lifetimeReviews,
      accuracy: total > 0 ? correctCount / total : 0,
      accuracy30d: total30 > 0 ? correct30 / total30 : 0,
      currentStreak,
      bestStreak,
      studyDays: daySet.size,
      newCount,
      reviewCount: total - newCount,
      byDay,
      byCategory,
      byHour: hourCounts.map((count, hour) => ({ hour, count })),
      dueForecast,
      dueTotal: dueCards.length,
    };
  },
};
