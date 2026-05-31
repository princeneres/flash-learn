// Edge Function: ai-generate
//
// The single server-side path for AI deck generation. Validates the caller's
// JWT, spends one AI credit atomically, then calls OpenAI with OUR secret key.
// If OpenAI fails after the debit, the credit is refunded so a user never loses
// a credit to our error.
//
// Required secrets (set with `supabase secrets set ...`):
//   OPENAI_API_KEY  - our OpenAI API key (never exposed to the browser)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

const OPENAI_BASE = 'https://api.openai.com/v1';
const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini';
const MAX_CARDS_PER_GENERATION = 50;

type Difficulty = 'beginner' | 'intermediate' | 'advanced';

interface GenerateOptions {
  theme: string;
  count: number;
  language: string;
  difficulty: Difficulty;
  instructions?: string;
}

interface GeneratedCard {
  front: string;
  back: string;
  tags: string[];
}

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

const coerceCards = (input: unknown): GeneratedCard[] => {
  const arr =
    input && typeof input === 'object' && Array.isArray((input as { cards?: unknown }).cards)
      ? (input as { cards: unknown[] }).cards
      : null;
  if (!arr) throw new Error('BAD_RESPONSE');

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
  if (out.length === 0) throw new Error('EMPTY');
  return out;
};

const callOpenAi = async (prompt: string, maxTokens: number): Promise<unknown> => {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('NOT_CONFIGURED');

  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
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
  if (!res.ok) {
    if (res.status === 429) throw new Error('RATE_LIMIT');
    throw new Error('UNKNOWN');
  }

  const data = (await res.json()) as {
    choices?: Array<{ finish_reason?: string; message?: { content?: string } }>;
  };
  const choice = data.choices?.[0];
  const content = choice?.message?.content;
  if (!content) throw new Error('BAD_RESPONSE');
  if (choice?.finish_reason === 'length') throw new Error('TRUNCATED');
  try {
    return JSON.parse(content);
  } catch {
    throw new Error('BAD_RESPONSE');
  }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  const token = authHeader.replace('Bearer ', '');
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401);
  const user = userData.user;

  let body: Partial<GenerateOptions>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const theme = (body.theme ?? '').trim();
  if (!theme) return json({ code: 'BAD_RESPONSE', error: 'Theme is required' }, 400);
  const count = Math.max(1, Math.min(Number(body.count) || 1, MAX_CARDS_PER_GENERATION));
  const language = (body.language ?? 'English').trim() || 'English';
  const difficulty: Difficulty = (['beginner', 'intermediate', 'advanced'] as const).includes(
    body.difficulty as Difficulty,
  )
    ? (body.difficulty as Difficulty)
    : 'intermediate';

  // Spend one credit up front. If the user has none, stop before touching OpenAI.
  const { error: debitErr } = await admin.rpc('debit_ai_credit', { p_user: user.id });
  if (debitErr) {
    if ((debitErr.message ?? '').includes('INSUFFICIENT_CREDITS')) {
      return json({ code: 'NO_CREDITS', error: 'No AI credits' }, 402);
    }
    console.error('debit failed', debitErr);
    return json({ code: 'UNKNOWN', error: 'Could not reserve credit' }, 500);
  }

  const prompt = buildPrompt({
    theme,
    count,
    language,
    difficulty,
    instructions: body.instructions,
  });
  // Budget for the JSON answer with generous headroom (reasoning models spend
  // thinking tokens out of the same budget).
  const answerTokens = 600 + count * 200;
  const maxTokens = Math.min(32768, answerTokens + 4000);

  try {
    const raw = await callOpenAi(prompt, maxTokens);
    const cards = coerceCards(raw).slice(0, count);
    return json({ cards });
  } catch (err) {
    // Generation failed after we debited — refund the credit.
    const code = err instanceof Error ? err.message : 'UNKNOWN';
    const { error: refundErr } = await admin.rpc('credit_ai', {
      p_user: user.id,
      p_amount: 1,
      p_reason: 'refund',
      p_abacate_id: null,
    });
    if (refundErr) console.error('refund failed', refundErr);
    console.error('generation failed', code);
    return json({ code, error: 'Generation failed' }, 502);
  }
});
