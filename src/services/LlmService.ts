// AI deck generation client.
//
// Generation runs entirely server-side: the `ai-generate` edge function spends
// one AI credit, calls OpenAI with our key, and returns the cards. No API key is
// ever stored in or sent from the browser.

import { ApiError, callApi } from '../lib/api';

export interface GeneratedCard {
  front: string;
  back: string;
  tags: string[];
}

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface GenerateOptions {
  theme: string;
  count: number;
  language: string;
  difficulty: Difficulty;
  instructions?: string;
}

export type LlmErrorCode =
  | 'NO_CREDITS'
  | 'RATE_LIMIT'
  | 'NETWORK'
  | 'BAD_RESPONSE'
  | 'TRUNCATED'
  | 'EMPTY'
  | 'NOT_CONFIGURED'
  | 'UNKNOWN';

export class LlmError extends Error {
  code: LlmErrorCode;
  constructor(code: LlmErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'LlmError';
    this.code = code;
  }
}

export const llmErrorKey = (err: unknown): string => {
  const code: LlmErrorCode = err instanceof LlmError ? err.code : 'UNKNOWN';
  return `ai.errors.${code}`;
};

// Hard ceiling per single generation — mirrors the edge function.
export const MAX_CARDS_PER_GENERATION = 50;

const isCode = (v: unknown): v is LlmErrorCode =>
  typeof v === 'string' &&
  [
    'NO_CREDITS',
    'RATE_LIMIT',
    'NETWORK',
    'BAD_RESPONSE',
    'TRUNCATED',
    'EMPTY',
    'NOT_CONFIGURED',
    'UNKNOWN',
  ].includes(v);

export const LlmService = {
  generateCards: async (opts: GenerateOptions): Promise<GeneratedCard[]> => {
    let data: { cards?: GeneratedCard[] } | null;
    try {
      data = await callApi<{ cards?: GeneratedCard[] }>('ai-generate', {
        theme: opts.theme,
        count: opts.count,
        language: opts.language,
        difficulty: opts.difficulty,
        instructions: opts.instructions,
      });
    } catch (error) {
      // The server function returns a JSON body with a `code` even on non-2xx.
      const code = error instanceof ApiError ? error.body?.code : 'NETWORK';
      throw new LlmError(isCode(code) ? code : 'UNKNOWN');
    }

    const cards = data?.cards;
    if (!Array.isArray(cards) || cards.length === 0) throw new LlmError('EMPTY');
    return cards;
  },
};
