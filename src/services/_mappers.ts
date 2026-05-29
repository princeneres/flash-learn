import type { Deck } from './DeckService';
import type { Card } from './CardService';

interface DbDeck {
  id: string;
  owner_id: string;
  // Derived at read time from profiles via get_public_decks(); never stored.
  owner_name?: string | null;
  title: string;
  category: string | null;
  tags: string[];
  is_public: boolean;
  card_count: number;
  created_at: string;
}

interface DbCard {
  id: string;
  deck_id: string;
  owner_id: string;
  front: string;
  back: string;
  front_audio: string | null;
  back_audio: string | null;
  tags: string[] | null;
  next_review: string;
  interval: number;
  ease_factor: number | string;
  repetitions: number;
  status: 'new' | 'learning' | 'review' | 'relearning';
  created_at: string;
}

export const fromDbDeck = (r: DbDeck): Deck => ({
  id: r.id,
  ownerId: r.owner_id,
  ownerName: r.owner_name ?? undefined,
  title: r.title,
  category: r.category ?? '',
  tags: r.tags ?? [],
  isPublic: r.is_public,
  cardCount: r.card_count,
  createdAt: r.created_at,
});

export const toDbDeck = (
  d: Partial<Deck> & { ownerId: string },
): Partial<DbDeck> & { owner_id: string } => ({
  owner_id: d.ownerId,
  title: d.title ?? '',
  category: d.category ?? null,
  tags: d.tags ?? [],
  is_public: d.isPublic ?? false,
});

export const fromDbCard = (r: DbCard): Card => ({
  id: r.id,
  deckId: r.deck_id,
  ownerId: r.owner_id,
  front: r.front,
  back: r.back,
  frontAudio: r.front_audio ?? undefined,
  backAudio: r.back_audio ?? undefined,
  tags: r.tags ?? [],
  nextReview: r.next_review,
  interval: r.interval,
  easeFactor: typeof r.ease_factor === 'string' ? parseFloat(r.ease_factor) : r.ease_factor,
  repetitions: r.repetitions,
  status: r.status,
  createdAt: r.created_at,
});

export interface DbReviewLog {
  id: string;
  owner_id: string;
  card_id: string | null;
  deck_id: string | null;
  deck_category: string | null;
  quality: number;
  was_correct: boolean;
  prev_status: string | null;
  reviewed_at: string;
}

export interface ReviewLog {
  id: string;
  cardId: string | null;
  deckId: string | null;
  deckCategory: string;
  quality: number;
  wasCorrect: boolean;
  prevStatus: string | null;
  reviewedAt: string;
}

export const fromDbReviewLog = (r: DbReviewLog): ReviewLog => ({
  id: r.id,
  cardId: r.card_id,
  deckId: r.deck_id,
  deckCategory: r.deck_category ?? '',
  quality: r.quality,
  wasCorrect: r.was_correct,
  prevStatus: r.prev_status,
  reviewedAt: r.reviewed_at,
});

export interface DbProfile {
  id: string;
  display_name: string | null;
  email: string | null;
  photo_url: string | null;
  provider: string | null;
  points: number;
  total_reviews: number;
  streak: number;
  last_study_date: string | null;
  language: string;
  sound_enabled: boolean;
  created_at: string;
}
