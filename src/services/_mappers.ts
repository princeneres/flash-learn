import type { Deck } from './DeckService';
import type { Card } from './CardService';
import type { Collection } from './CollectionService';
import type {
  Quiz,
  QuizQuestion,
  QuizOption,
  QuizQuestionKind,
  QuizAttempt,
  QuizAnswer,
} from './QuizService';
import { normalizeSrsSettings, type SrsSettings } from './srsAlgorithm';

export interface DbDeck {
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
  srs_settings?: Partial<SrsSettings> | null;
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
  srsSettings: normalizeSrsSettings(r.srs_settings),
});

export const toDbDeck = (
  d: Partial<Deck> & { ownerId: string },
): Partial<DbDeck> & { owner_id: string } => ({
  owner_id: d.ownerId,
  title: d.title ?? '',
  category: d.category ?? null,
  tags: d.tags ?? [],
  is_public: d.isPublic ?? false,
  ...(d.srsSettings ? { srs_settings: d.srsSettings } : {}),
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

// ============================================================
// Collections
// ============================================================

export interface DbCollection {
  id: string;
  owner_id: string;
  owner_name?: string | null;
  title: string;
  description: string | null;
  category: string | null;
  tags: string[];
  is_public: boolean;
  cover_color: string | null;
  deck_count: number;
  created_at: string;
}

export const fromDbCollection = (r: DbCollection): Collection => ({
  id: r.id,
  ownerId: r.owner_id,
  ownerName: r.owner_name ?? undefined,
  title: r.title,
  description: r.description ?? '',
  category: r.category ?? '',
  tags: r.tags ?? [],
  isPublic: r.is_public,
  coverColor: r.cover_color ?? undefined,
  deckCount: r.deck_count,
  createdAt: r.created_at,
});

export const toDbCollection = (
  c: Partial<Collection> & { ownerId: string },
): Partial<DbCollection> & { owner_id: string } => ({
  owner_id: c.ownerId,
  title: c.title ?? '',
  description: c.description ?? null,
  category: c.category ?? null,
  tags: c.tags ?? [],
  is_public: c.isPublic ?? false,
  cover_color: c.coverColor ?? null,
});

// ============================================================
// Quizzes
// ============================================================

export interface DbQuiz {
  id: string;
  owner_id: string;
  collection_id: string;
  title: string;
  description: string | null;
  question_count: number;
  pass_threshold: number | null;
  order_index: number;
  created_at: string;
}

export const fromDbQuiz = (r: DbQuiz): Quiz => ({
  id: r.id,
  ownerId: r.owner_id,
  collectionId: r.collection_id,
  title: r.title,
  description: r.description ?? '',
  questionCount: r.question_count,
  passThreshold: r.pass_threshold ?? undefined,
  orderIndex: r.order_index,
  createdAt: r.created_at,
});

export const toDbQuiz = (
  q: Partial<Quiz> & { ownerId: string },
): Partial<DbQuiz> & { owner_id: string; collection_id: string } => ({
  owner_id: q.ownerId,
  collection_id: q.collectionId ?? '',
  title: q.title ?? '',
  description: q.description ?? null,
  pass_threshold: q.passThreshold ?? null,
  order_index: q.orderIndex ?? 0,
});

export interface DbQuizQuestion {
  id: string;
  quiz_id: string;
  owner_id: string;
  prompt: string;
  kind: string;
  options: unknown;
  explanation: string | null;
  order_index: number;
  created_at: string;
}

export const fromDbQuizQuestion = (r: DbQuizQuestion): QuizQuestion => ({
  id: r.id,
  quizId: r.quiz_id,
  ownerId: r.owner_id,
  prompt: r.prompt,
  kind: (r.kind as QuizQuestionKind) ?? 'single',
  options: Array.isArray(r.options) ? (r.options as QuizOption[]) : [],
  explanation: r.explanation ?? undefined,
  orderIndex: r.order_index,
  createdAt: r.created_at,
});

export const toDbQuizQuestion = (
  q: Partial<QuizQuestion> & { ownerId: string; quizId: string },
): Partial<DbQuizQuestion> & { owner_id: string; quiz_id: string } => ({
  owner_id: q.ownerId,
  quiz_id: q.quizId,
  prompt: q.prompt ?? '',
  kind: q.kind ?? 'single',
  options: q.options ?? [],
  explanation: q.explanation ?? null,
  order_index: q.orderIndex ?? 0,
});

export interface DbQuizAttempt {
  id: string;
  owner_id: string;
  quiz_id: string | null;
  collection_id: string | null;
  score: number;
  total: number;
  answers: unknown;
  completed_at: string;
}

export const fromDbQuizAttempt = (r: DbQuizAttempt): QuizAttempt => ({
  id: r.id,
  ownerId: r.owner_id,
  quizId: r.quiz_id,
  collectionId: r.collection_id,
  score: r.score,
  total: r.total,
  answers: Array.isArray(r.answers) ? (r.answers as QuizAnswer[]) : [],
  completedAt: r.completed_at,
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
