import { neon } from '../lib/neon';
import {
  fromDbQuiz,
  toDbQuiz,
  fromDbQuizQuestion,
  toDbQuizQuestion,
  fromDbQuizAttempt,
} from './_mappers';

export type QuizQuestionKind = 'single' | 'multiple' | 'boolean';

export interface QuizOption {
  id: string;
  text: string;
  correct: boolean;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  ownerId: string;
  prompt: string;
  kind: QuizQuestionKind;
  options: QuizOption[];
  explanation?: string;
  orderIndex: number;
  createdAt: string;
}

export interface Quiz {
  id: string;
  ownerId: string;
  collectionId: string;
  title: string;
  description: string;
  questionCount: number;
  /** Percent correct needed to pass; undefined means no gate. */
  passThreshold?: number;
  orderIndex: number;
  createdAt: string;
}

export interface QuizAnswer {
  questionId: string;
  selected: string[];
  correct: boolean;
}

export interface QuizAttempt {
  id: string;
  ownerId: string;
  quizId: string | null;
  collectionId: string | null;
  score: number;
  total: number;
  answers: QuizAnswer[];
  completedAt: string;
}

const TABLE = 'quizzes';

export const QuizService = {
  createQuiz: async (ownerId: string, quiz: Partial<Quiz>): Promise<string> => {
    const payload = toDbQuiz({ ...quiz, ownerId });
    const { data, error } = await neon.from(TABLE).insert(payload).select('id').single();
    if (error) throw error;
    return data.id as string;
  },

  getCollectionQuizzes: async (collectionId: string): Promise<Quiz[]> => {
    const { data, error } = await neon.rpc('get_collection_quizzes', {
      p_collection_id: collectionId,
    });
    if (error) throw error;
    return (data ?? []).map(fromDbQuiz);
  },

  getQuiz: async (quizId: string): Promise<Quiz | null> => {
    const { data, error } = await neon.from(TABLE).select('*').eq('id', quizId).maybeSingle();
    if (error) throw error;
    return data ? fromDbQuiz(data) : null;
  },

  updateQuiz: async (quizId: string, patch: Partial<Quiz>): Promise<void> => {
    const payload: Record<string, unknown> = {};
    if (patch.title !== undefined) payload.title = patch.title;
    if (patch.description !== undefined) payload.description = patch.description;
    if (patch.passThreshold !== undefined) payload.pass_threshold = patch.passThreshold ?? null;
    if (patch.orderIndex !== undefined) payload.order_index = patch.orderIndex;
    const { error } = await neon.from(TABLE).update(payload).eq('id', quizId);
    if (error) throw error;
  },

  deleteQuiz: async (quizId: string): Promise<void> => {
    const { error } = await neon.from(TABLE).delete().eq('id', quizId);
    if (error) throw error;
  },

  // --- Questions ----------------------------------------------------------

  getQuizQuestions: async (quizId: string): Promise<QuizQuestion[]> => {
    const { data, error } = await neon
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(fromDbQuizQuestion);
  },

  createQuestion: async (
    ownerId: string,
    quizId: string,
    question: Partial<QuizQuestion>,
  ): Promise<string> => {
    const payload = toDbQuizQuestion({ ...question, ownerId, quizId });
    const { data, error } = await neon
      .from('quiz_questions')
      .insert(payload)
      .select('id')
      .single();
    if (error) throw error;
    return data.id as string;
  },

  updateQuestion: async (questionId: string, patch: Partial<QuizQuestion>): Promise<void> => {
    const payload: Record<string, unknown> = {};
    if (patch.prompt !== undefined) payload.prompt = patch.prompt;
    if (patch.kind !== undefined) payload.kind = patch.kind;
    if (patch.options !== undefined) payload.options = patch.options;
    if (patch.explanation !== undefined) payload.explanation = patch.explanation ?? null;
    if (patch.orderIndex !== undefined) payload.order_index = patch.orderIndex;
    const { error } = await neon.from('quiz_questions').update(payload).eq('id', questionId);
    if (error) throw error;
  },

  deleteQuestion: async (questionId: string): Promise<void> => {
    const { error } = await neon.from('quiz_questions').delete().eq('id', questionId);
    if (error) throw error;
  },

  // --- Attempts (analytics, mirrors review_logs) --------------------------

  recordAttempt: async (
    ownerId: string,
    attempt: Omit<QuizAttempt, 'id' | 'ownerId' | 'completedAt'>,
  ): Promise<void> => {
    const { error } = await neon.from('quiz_attempts').insert({
      owner_id: ownerId,
      quiz_id: attempt.quizId,
      collection_id: attempt.collectionId,
      score: attempt.score,
      total: attempt.total,
      answers: attempt.answers,
    });
    if (error) throw error;
  },

  getAttempts: async (quizId: string): Promise<QuizAttempt[]> => {
    const { data, error } = await neon
      .from('quiz_attempts')
      .select('*')
      .eq('quiz_id', quizId)
      .order('completed_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(fromDbQuizAttempt);
  },
};
