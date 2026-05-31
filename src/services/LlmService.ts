// Bring-your-own-key LLM integration for AI deck generation.
// The API key is stored only in the browser (localStorage, per user) and is
// sent directly to the chosen provider — it never touches our backend.

export type LlmProvider = 'anthropic' | 'openai';

export interface LlmConfig {
  provider: LlmProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
}

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
  | 'NOT_CONFIGURED'
  | 'AUTH'
  | 'RATE_LIMIT'
  | 'NETWORK'
  | 'BAD_RESPONSE'
  | 'TRUNCATED'
  | 'EMPTY'
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

export const PROVIDER_DEFAULTS: Record<LlmProvider, { baseUrl: string; model: string }> = {
  anthropic: { baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-6' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
};

// Hard ceiling per single generation, independent of plan room — keeps the
// request/response a sane size and the cost predictable.
export const MAX_CARDS_PER_GENERATION = 50;

const ANTHROPIC_VERSION = '2023-06-01';
const TOOL_NAME = 'create_flashcards';

const storageKey = (uid: string) => `flash-learn:llm-config:${uid}`;
const trimSlash = (url: string) => url.replace(/\/+$/, '');

const CARD_SCHEMA = {
  type: 'object',
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          front: { type: 'string', description: 'Question, term, or prompt' },
          back: { type: 'string', description: 'Clear, self-contained answer' },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['front', 'back'],
      },
    },
  },
  required: ['cards'],
} as const;

const buildPrompt = (opts: GenerateOptions): string => {
  const lines = [
    `You are an expert educator building study flashcards.`,
    `Create exactly ${opts.count} high-quality flashcards about: "${opts.theme}".`,
    `Write every flashcard in this language: ${opts.language}.`,
    `Target difficulty: ${opts.difficulty}.`,
    `Each flashcard has a "front" (a concise question, term, or prompt) and a "back" (a clear, correct, self-contained answer).`,
    `Optionally add 1-3 short topical "tags" per card.`,
    `Avoid duplicates and keep each side focused. Do not wrap content in markdown code fences.`,
  ];
  if (opts.instructions?.trim()) {
    lines.push(`Additional instructions from the user: ${opts.instructions.trim()}`);
  }
  return lines.join('\n');
};

const httpErrorCode = (status: number): LlmErrorCode => {
  if (status === 401 || status === 403) return 'AUTH';
  if (status === 429) return 'RATE_LIMIT';
  return 'UNKNOWN';
};

const coerceCards = (input: unknown): GeneratedCard[] => {
  const arr = Array.isArray(input)
    ? input
    : input && typeof input === 'object' && Array.isArray((input as { cards?: unknown }).cards)
      ? (input as { cards: unknown[] }).cards
      : null;
  if (!arr) throw new LlmError('BAD_RESPONSE');

  const out: GeneratedCard[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const front = typeof rec.front === 'string' ? rec.front.trim() : '';
    const back = typeof rec.back === 'string' ? rec.back.trim() : '';
    if (!front || !back) continue;
    const tags = Array.isArray(rec.tags)
      ? rec.tags
          .filter((x): x is string => typeof x === 'string')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 5)
      : [];
    out.push({ front, back, tags });
  }
  if (out.length === 0) throw new LlmError('EMPTY');
  return out;
};

const doFetch = async (url: string, init: RequestInit): Promise<Response> => {
  try {
    return await fetch(url, init);
  } catch {
    throw new LlmError('NETWORK');
  }
};

const callAnthropic = async (
  cfg: LlmConfig,
  prompt: string,
  maxTokens: number,
): Promise<unknown> => {
  const res = await doFetch(`${trimSlash(cfg.baseUrl)}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: maxTokens,
      tools: [
        {
          name: TOOL_NAME,
          description: 'Return the generated flashcards.',
          input_schema: CARD_SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: TOOL_NAME },
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new LlmError(httpErrorCode(res.status), `Anthropic ${res.status}`);

  const data = (await res.json()) as {
    stop_reason?: string;
    content?: Array<{ type?: string; name?: string; input?: unknown }>;
  };
  if (data.stop_reason === 'max_tokens') throw new LlmError('TRUNCATED');
  const toolBlock = data.content?.find((b) => b.type === 'tool_use' && b.name === TOOL_NAME);
  if (!toolBlock) throw new LlmError('BAD_RESPONSE');
  return toolBlock.input;
};

const callOpenAi = async (cfg: LlmConfig, prompt: string, maxTokens: number): Promise<unknown> => {
  const res = await doFetch(`${trimSlash(cfg.baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You output only a single JSON object of the form ' +
            '{"cards":[{"front":"...","back":"...","tags":["..."]}]} and nothing else.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new LlmError(httpErrorCode(res.status), `OpenAI ${res.status}`);

  const data = (await res.json()) as {
    choices?: Array<{ finish_reason?: string; message?: { content?: string } }>;
  };
  const choice = data.choices?.[0];
  const content = choice?.message?.content;
  if (!content) throw new LlmError('BAD_RESPONSE');
  // Response cut off before the JSON could close — the token budget ran out
  // (often eaten by a reasoning model's thinking tokens). Asking for fewer
  // cards or a model with a larger output window resolves it.
  if (choice?.finish_reason === 'length') throw new LlmError('TRUNCATED');
  try {
    return JSON.parse(content);
  } catch {
    throw new LlmError('BAD_RESPONSE');
  }
};

export const LlmService = {
  getConfig: (uid: string): LlmConfig | null => {
    try {
      const raw = localStorage.getItem(storageKey(uid));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<LlmConfig>;
      if (
        (parsed.provider !== 'anthropic' && parsed.provider !== 'openai') ||
        typeof parsed.apiKey !== 'string' ||
        typeof parsed.model !== 'string'
      ) {
        return null;
      }
      return {
        provider: parsed.provider,
        apiKey: parsed.apiKey,
        model: parsed.model,
        baseUrl: parsed.baseUrl || PROVIDER_DEFAULTS[parsed.provider].baseUrl,
      };
    } catch {
      return null;
    }
  },

  saveConfig: (uid: string, cfg: LlmConfig): void => {
    const normalized: LlmConfig = {
      provider: cfg.provider,
      apiKey: cfg.apiKey.trim(),
      model: cfg.model.trim() || PROVIDER_DEFAULTS[cfg.provider].model,
      baseUrl: trimSlash(cfg.baseUrl.trim() || PROVIDER_DEFAULTS[cfg.provider].baseUrl),
    };
    localStorage.setItem(storageKey(uid), JSON.stringify(normalized));
  },

  clearConfig: (uid: string): void => {
    localStorage.removeItem(storageKey(uid));
  },

  isConfigured: (uid: string): boolean => {
    const cfg = LlmService.getConfig(uid);
    return !!cfg && cfg.apiKey.length > 0;
  },

  testConnection: async (cfg: LlmConfig): Promise<void> => {
    if (!cfg.apiKey.trim()) throw new LlmError('NOT_CONFIGURED');
    if (cfg.provider === 'anthropic') {
      const res = await doFetch(`${trimSlash(cfg.baseUrl)}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': cfg.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: cfg.model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      });
      if (!res.ok) throw new LlmError(httpErrorCode(res.status), `Anthropic ${res.status}`);
      return;
    }
    const res = await doFetch(`${trimSlash(cfg.baseUrl)}/models`, {
      method: 'GET',
      headers: { authorization: `Bearer ${cfg.apiKey}` },
    });
    if (!res.ok) throw new LlmError(httpErrorCode(res.status), `OpenAI ${res.status}`);
  },

  generateCards: async (uid: string, opts: GenerateOptions): Promise<GeneratedCard[]> => {
    const cfg = LlmService.getConfig(uid);
    if (!cfg || !cfg.apiKey) throw new LlmError('NOT_CONFIGURED');

    const count = Math.max(1, Math.min(opts.count, MAX_CARDS_PER_GENERATION));
    const prompt = buildPrompt({ ...opts, count });
    // Roughly budget tokens by card count, with generous headroom.
    // Budget for the JSON answer. OpenAI-compatible reasoning models
    // (e.g. gemini-2.5-flash, o-series) spend "thinking" tokens out of the same
    // max_tokens budget without them showing up in the content, so the answer
    // gets truncated (finish_reason: "length") unless we leave generous
    // headroom on that path.
    const answerTokens = 600 + count * 200;
    const maxTokens =
      cfg.provider === 'anthropic'
        ? Math.min(8192, answerTokens)
        : Math.min(32768, answerTokens + 4000);

    const raw =
      cfg.provider === 'anthropic'
        ? await callAnthropic(cfg, prompt, maxTokens)
        : await callOpenAi(cfg, prompt, maxTokens);

    return coerceCards(raw).slice(0, count);
  },
};
