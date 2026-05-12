import { supabase } from '../lib/supabase';
import { calculateReview } from './srsAlgorithm';
import { GamificationService } from './GamificationService';
import { MediaStorageService } from './MediaStorageService';
import { collectCardMediaRefs } from '../lib/media';
import { fromDbCard } from './_mappers';

export interface Card {
  id: string;
  deckId: string;
  ownerId: string;
  front: string;
  back: string;
  frontAudio?: string;
  backAudio?: string;
  nextReview: string;
  interval: number;
  easeFactor: number;
  repetitions: number;
  status: 'new' | 'learning' | 'review' | 'relearning';
  createdAt: string;
}

const TABLE = 'cards';

export const DECK_CARD_LIMIT = 100;

export class DeckLimitError extends Error {
  current: number;
  attempting: number;
  limit: number;
  constructor(current: number, attempting: number, limit: number) {
    super(`Deck card limit reached (${current}+${attempting}>${limit})`);
    this.name = 'DeckLimitError';
    this.current = current;
    this.attempting = attempting;
    this.limit = limit;
  }
}

interface BulkInput {
  front: string;
  back: string;
  frontAudio?: string;
  backAudio?: string;
}

const getDeckCardCount = async (deckId: string): Promise<number> => {
  const { data } = await supabase
    .from('decks')
    .select('card_count')
    .eq('id', deckId)
    .maybeSingle();
  return (data?.card_count as number | undefined) ?? 0;
};

export const CardService = {
  createCard: async (
    ownerId: string,
    deckId: string,
    card: Partial<Card>
  ): Promise<string> => {
    const current = await getDeckCardCount(deckId);
    if (current >= DECK_CARD_LIMIT) {
      throw new DeckLimitError(current, 1, DECK_CARD_LIMIT);
    }
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        deck_id: deckId,
        owner_id: ownerId,
        front: card.front ?? '',
        back: card.back ?? '',
        front_audio: card.frontAudio ?? null,
        back_audio: card.backAudio ?? null,
      })
      .select('id')
      .single();
    if (error) throw error;
    return data.id as string;
  },

  bulkCreateCards: async (
    ownerId: string,
    deckId: string,
    cards: BulkInput[]
  ): Promise<number> => {
    if (cards.length === 0) return 0;
    const current = await getDeckCardCount(deckId);
    const room = DECK_CARD_LIMIT - current;
    if (room <= 0) {
      throw new DeckLimitError(current, cards.length, DECK_CARD_LIMIT);
    }
    const toInsert = cards.length > room ? cards.slice(0, room) : cards;
    const CHUNK = 500;
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const slice = toInsert.slice(i, i + CHUNK);
      const rows = slice.map((c) => ({
        deck_id: deckId,
        owner_id: ownerId,
        front: c.front,
        back: c.back,
        front_audio: c.frontAudio ?? null,
        back_audio: c.backAudio ?? null,
      }));
      const { error } = await supabase.from(TABLE).insert(rows);
      if (error) throw error;
      inserted += slice.length;
    }
    return inserted;
  },

  getDeckCards: async (deckId: string): Promise<Card[]> => {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('deck_id', deckId);
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

  getDueCards: async (deckId: string): Promise<Card[]> => {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('deck_id', deckId)
      .lte('next_review', nowIso);
    if (error) throw error;
    return (data ?? []).map(fromDbCard);
  },

  processReview: async (card: Card, quality: number) => {
    const result = calculateReview(
      quality,
      card.interval,
      card.easeFactor,
      card.repetitions
    );

    const { error } = await supabase
      .from(TABLE)
      .update({
        next_review: result.nextReview.toISOString(),
        interval: result.interval,
        ease_factor: result.easeFactor,
        repetitions: result.repetitions,
        status: quality < 3 ? 'relearning' : 'review',
      })
      .eq('id', card.id);
    if (error) throw error;

    const points = quality >= 3 ? 10 : 1;
    await GamificationService.awardPoints(card.ownerId, points);
    await GamificationService.updateStreak(card.ownerId);
    await GamificationService.checkAchievements(card.ownerId);

    return result;
  },
};
