import { startOfDay } from 'date-fns';
import { supabase } from '../lib/supabase';
import { calculateReview, type SrsSettings } from './srsAlgorithm';
import { GamificationService } from './GamificationService';
import { MediaStorageService } from './MediaStorageService';
import { collectCardMediaRefs } from '../lib/media';
import { fromDbCard } from './_mappers';
import { parsePlanError } from '../lib/planErrors';

export interface Card {
  id: string;
  deckId: string;
  ownerId: string;
  front: string;
  back: string;
  frontAudio?: string;
  backAudio?: string;
  tags: string[];
  nextReview: string;
  interval: number;
  easeFactor: number;
  repetitions: number;
  status: 'new' | 'learning' | 'review' | 'relearning';
  createdAt: string;
}

const TABLE = 'cards';

// UI fallback only — backend triggers are the source of truth.
export const DECK_CARD_LIMIT = 100;

interface BulkInput {
  front: string;
  back: string;
  frontAudio?: string;
  backAudio?: string;
  tags?: string[];
}

const rethrow = (err: unknown): never => {
  const plan = parsePlanError(err);
  if (plan) throw plan;
  throw err;
};

export const CardService = {
  createCard: async (ownerId: string, deckId: string, card: Partial<Card>): Promise<string> => {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        deck_id: deckId,
        owner_id: ownerId,
        front: card.front ?? '',
        back: card.back ?? '',
        front_audio: card.frontAudio ?? null,
        back_audio: card.backAudio ?? null,
        tags: card.tags ?? [],
      })
      .select('id')
      .single();
    if (error) rethrow(error);
    return data!.id as string;
  },

  bulkCreateCards: async (ownerId: string, deckId: string, cards: BulkInput[]): Promise<number> => {
    if (cards.length === 0) return 0;
    const CHUNK = 500;
    let inserted = 0;
    for (let i = 0; i < cards.length; i += CHUNK) {
      const slice = cards.slice(i, i + CHUNK);
      const rows = slice.map((c) => ({
        deck_id: deckId,
        owner_id: ownerId,
        front: c.front,
        back: c.back,
        front_audio: c.frontAudio ?? null,
        back_audio: c.backAudio ?? null,
        tags: c.tags ?? [],
      }));
      const { error } = await supabase.from(TABLE).insert(rows);
      if (error) rethrow(error);
      inserted += slice.length;
    }
    return inserted;
  },

  getDeckCards: async (deckId: string): Promise<Card[]> => {
    const { data, error } = await supabase.from(TABLE).select('*').eq('deck_id', deckId);
    if (error) throw error;
    return (data ?? []).map(fromDbCard);
  },

  updateCard: async (cardId: string, patch: Partial<Card>): Promise<void> => {
    const payload: Record<string, unknown> = {};
    if (patch.front !== undefined) payload.front = patch.front;
    if (patch.back !== undefined) payload.back = patch.back;
    if (patch.frontAudio !== undefined) payload.front_audio = patch.frontAudio ?? null;
    if (patch.backAudio !== undefined) payload.back_audio = patch.backAudio ?? null;
    const { error } = await supabase.from(TABLE).update(payload).eq('id', cardId);
    if (error) throw error;
  },

  deleteCard: async (_deckId: string, cardId: string): Promise<void> => {
    const { data } = await supabase
      .from(TABLE)
      .select('front, back, front_audio, back_audio')
      .eq('id', cardId)
      .maybeSingle();
    if (data) {
      const refs = collectCardMediaRefs({
        front: data.front,
        back: data.back,
        frontAudio: data.front_audio,
        backAudio: data.back_audio,
      });
      if (refs.length > 0) {
        try {
          await MediaStorageService.deleteMany(refs);
        } catch (err) {
          console.error('Failed to delete card media', err);
        }
      }
    }
    const { error } = await supabase.from(TABLE).delete().eq('id', cardId);
    if (error) throw error;
  },

  // How many brand-new cards have already been introduced today, counted from
  // the review log (prev_status 'new' marks a card's first-ever review) so the
  // tally survives reloads and several sessions across the same day.
  countNewStudiedToday: async (deckId: string): Promise<number> => {
    const since = startOfDay(new Date()).toISOString();
    const { count, error } = await supabase
      .from('review_logs')
      .select('*', { count: 'exact', head: true })
      .eq('deck_id', deckId)
      .eq('prev_status', 'new')
      .gte('reviewed_at', since);
    if (error) {
      // Non-fatal: fall back to "none studied" so the session still starts.
      console.error('Failed to count new cards studied today', error);
      return 0;
    }
    return count ?? 0;
  },

  // Due cards for a study session. Review/learning cards are always returned;
  // brand-new cards are capped so at most `newLimit` are introduced per day
  // (counting any already studied earlier today). Pass Infinity to disable the
  // cap. Reviews come first, then the day's remaining allotment of new cards.
  getDueCards: async (deckId: string, newLimit: number = Infinity): Promise<Card[]> => {
    const nowIso = new Date().toISOString();

    const { data: reviewRows, error: reviewError } = await supabase
      .from(TABLE)
      .select('*')
      .eq('deck_id', deckId)
      .neq('status', 'new')
      .lte('next_review', nowIso)
      .order('next_review', { ascending: true });
    if (reviewError) throw reviewError;
    const reviewCards = (reviewRows ?? []).map(fromDbCard);

    if (newLimit <= 0) return reviewCards;

    const studiedNew = Number.isFinite(newLimit)
      ? await CardService.countNewStudiedToday(deckId)
      : 0;
    const remainingNew = newLimit - studiedNew;
    if (remainingNew <= 0) return reviewCards;

    let newQuery = supabase
      .from(TABLE)
      .select('*')
      .eq('deck_id', deckId)
      .eq('status', 'new')
      .lte('next_review', nowIso)
      .order('created_at', { ascending: true });
    if (Number.isFinite(remainingNew)) newQuery = newQuery.limit(remainingNew);
    const { data: newRows, error: newError } = await newQuery;
    if (newError) throw newError;

    return [...reviewCards, ...(newRows ?? []).map(fromDbCard)];
  },

  processReview: async (
    card: Card,
    quality: number,
    deckCategory?: string,
    settings?: SrsSettings,
  ) => {
    const result = calculateReview(
      quality,
      card.interval,
      card.easeFactor,
      card.repetitions,
      card.status,
      settings,
    );

    // Captured before the update so the stats "new vs review" split is accurate.
    const prevStatus = card.status;

    const { error } = await supabase
      .from(TABLE)
      .update({
        next_review: result.nextReview.toISOString(),
        interval: result.interval,
        ease_factor: result.easeFactor,
        repetitions: result.repetitions,
        status: result.status,
      })
      .eq('id', card.id);
    if (error) throw error;

    await GamificationService.recordReview(card.id, quality);

    // Personal study history for the Stats page. Fire-and-forget: a logging
    // failure must never break the study session (mirrors recordReview).
    try {
      const { error: logError } = await supabase.from('review_logs').insert({
        owner_id: card.ownerId,
        card_id: card.id,
        deck_id: card.deckId,
        deck_category: deckCategory ?? null,
        quality,
        was_correct: quality >= 3,
        prev_status: prevStatus,
      });
      if (logError) console.error('Failed to record review log', logError);
    } catch (logError) {
      console.error('Failed to record review log', logError);
    }

    return result;
  },
};
