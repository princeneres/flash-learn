import { z } from 'zod';

/**
 * Zod input schemas for the tools. These mirror the domain interfaces in
 * src/services/* and provide shape validation (the database still enforces
 * ownership and plan quotas). `owner_id` is intentionally NOT accepted from the
 * caller — it is always derived from the authenticated session.
 */

export const cardSchema = z.object({
  front: z.string().min(1, 'front é obrigatório'),
  back: z.string().min(1, 'back é obrigatório'),
  tags: z.array(z.string()).optional(),
});

export const createDeckSchema = {
  title: z.string().min(1).describe('Título do deck'),
  category: z.string().optional().describe('Categoria opcional'),
  tags: z.array(z.string()).optional().describe('Tags opcionais'),
  isPublic: z.boolean().optional().describe('Se o deck é público (default false)'),
  cards: z
    .array(cardSchema)
    .optional()
    .describe('Cards iniciais opcionais para criar junto com o deck'),
};

export const addCardsSchema = {
  deckId: z.string().uuid().describe('ID do deck (deve pertencer a você)'),
  cards: z.array(cardSchema).min(1).describe('Cards a adicionar'),
};

export const listDecksSchema = {
  limit: z.number().int().min(1).max(200).optional().describe('Máximo de decks (default 50)'),
};

export const createCollectionSchema = {
  title: z.string().min(1).describe('Título da collection'),
  description: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional().describe('Se a collection é pública (default false)'),
  coverColor: z.string().optional().describe('Cor de capa opcional (hex/nome)'),
};

export const addDeckToCollectionSchema = {
  collectionId: z.string().uuid().describe('ID da collection (sua)'),
  deckId: z.string().uuid().describe('ID do deck (seu)'),
  orderIndex: z.number().int().min(0).optional().describe('Posição dentro da collection'),
};

export const createQuizSchema = {
  collectionId: z.string().uuid().describe('ID da collection à qual o quiz pertence (sua)'),
  title: z.string().min(1),
  description: z.string().optional(),
  passThreshold: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .describe('% de acerto para aprovação; omitir = sem gate'),
  orderIndex: z.number().int().min(0).optional(),
};

export const quizOptionSchema = z.object({
  text: z.string().min(1),
  correct: z.boolean(),
});

export const quizQuestionSchema = z
  .object({
    prompt: z.string().min(1),
    kind: z.enum(['single', 'multiple', 'boolean']).default('single'),
    options: z.array(quizOptionSchema).min(2, 'forneça ao menos 2 opções'),
    explanation: z.string().optional(),
  })
  .refine((q) => q.options.some((o) => o.correct), {
    message: 'ao menos uma opção deve estar correta',
  });

export const addQuizQuestionsSchema = {
  quizId: z.string().uuid().describe('ID do quiz (seu)'),
  questions: z.array(quizQuestionSchema).min(1),
};

export const listCollectionsSchema = {
  limit: z.number().int().min(1).max(200).optional().describe('Máximo de collections (default 50)'),
};
