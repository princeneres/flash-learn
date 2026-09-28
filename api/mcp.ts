// Backend for the MCP server (mcp-server/). Authenticated with a personal token
// (`Authorization: Bearer flmcp_…`, issued by api/mcp-token), it runs one tool
// per request as the database owner, so every ownership rule RLS used to give us
// is checked explicitly here. Plan quotas still come from the database triggers:
// their P0001 messages are passed through for the client to render.

import { randomUUID } from 'node:crypto';
import { hashMcpToken, json, pgErrorMessage, readJson, sql } from './_lib/server.js';

const MAX_TEXT = 20_000;
const MAX_CARDS = 500;
const MAX_QUESTIONS = 200;

class BadRequest extends Error {}

const str = (v: unknown, field: string, { optional = false, max = 500 } = {}) => {
  if (v === undefined || v === null) {
    if (optional) return null;
    throw new BadRequest(`${field} is required`);
  }
  if (typeof v !== 'string' || !v.trim() || v.length > max) {
    throw new BadRequest(`${field} must be a non-empty string up to ${max} chars`);
  }
  return v;
};

const uuid = (v: unknown, field: string) => {
  if (typeof v !== 'string' || !/^[0-9a-f-]{36}$/i.test(v))
    throw new BadRequest(`${field} must be a uuid`);
  return v;
};

const tags = (v: unknown) =>
  Array.isArray(v) ? v.filter((t): t is string => typeof t === 'string').slice(0, 20) : [];

const int = (v: unknown, fallback: number | null) =>
  typeof v === 'number' && Number.isInteger(v) ? v : fallback;

const list = <T>(
  v: unknown,
  field: string,
  max: number,
  map: (item: Record<string, unknown>) => T,
) => {
  if (!Array.isArray(v) || v.length === 0)
    throw new BadRequest(`${field} must be a non-empty array`);
  if (v.length > max) throw new BadRequest(`${field} accepts at most ${max} items`);
  return v.map((item) => map((item ?? {}) as Record<string, unknown>));
};

async function userFromToken(req: Request): Promise<string | null> {
  const header = req.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer flmcp_')) return null;
  const rows = (await sql`
    update public.mcp_tokens set last_used_at = now()
    where token_hash = ${hashMcpToken(header.slice('Bearer '.length))} and revoked_at is null
    returning user_id
  `) as Array<{ user_id: string }>;
  return rows[0]?.user_id ?? null;
}

async function assertOwns(table: 'decks' | 'collections' | 'quizzes', id: string, userId: string) {
  const rows =
    table === 'decks'
      ? await sql`select 1 from public.decks where id = ${id} and owner_id = ${userId}`
      : table === 'collections'
        ? await sql`select 1 from public.collections where id = ${id} and owner_id = ${userId}`
        : await sql`select 1 from public.quizzes where id = ${id} and owner_id = ${userId}`;
  if (rows.length === 0) throw new BadRequest(`${table.slice(0, -1)} ${id} not found`);
}

type Card = { front: string; back: string; tags: string[] };

const parseCards = (v: unknown): Card[] =>
  list(v, 'cards', MAX_CARDS, (c) => ({
    front: str(c.front, 'card.front', { max: MAX_TEXT })!,
    back: str(c.back, 'card.back', { max: MAX_TEXT })!,
    tags: tags(c.tags),
  }));

// One statement per batch: atomic, and the quota triggers run for every row.
const insertCards = async (deckId: string, userId: string, cards: Card[]) => {
  await sql`
    insert into public.cards (deck_id, owner_id, front, back, tags)
    select ${deckId}, ${userId}, c.front, c.back, coalesce(c.tags, '{}')
    from jsonb_to_recordset(${JSON.stringify(cards)}::jsonb) as c(front text, back text, tags text[])
  `;
  return cards.length;
};

const tools: Record<string, (args: Record<string, unknown>, userId: string) => Promise<unknown>> = {
  async create_deck(args, userId) {
    const cards = args.cards === undefined ? [] : parseCards(args.cards);
    const [deck] = (await sql`
      insert into public.decks (owner_id, title, category, tags, is_public)
      values (${userId}, ${str(args.title, 'title')}, ${str(args.category, 'category', { optional: true })},
              ${tags(args.tags)}, ${args.isPublic === true})
      returning id
    `) as Array<{ id: string }>;
    const cardsInserted = cards.length ? await insertCards(deck.id, userId, cards) : 0;
    return { id: deck.id, cardsInserted };
  },

  async add_cards(args, userId) {
    const deckId = uuid(args.deckId, 'deckId');
    const cards = parseCards(args.cards);
    await assertOwns('decks', deckId, userId);
    return { inserted: await insertCards(deckId, userId, cards) };
  },

  async list_decks(args, userId) {
    const limit = Math.min(Math.max(int(args.limit, 50)!, 1), 200);
    return sql`
      select id, title, category, is_public, card_count, created_at
      from public.decks where owner_id = ${userId}
      order by created_at desc limit ${limit}
    `;
  },

  async create_collection(args, userId) {
    const [row] = (await sql`
      insert into public.collections (owner_id, title, description, category, tags, is_public, cover_color)
      values (${userId}, ${str(args.title, 'title')},
              ${str(args.description, 'description', { optional: true, max: 2000 })},
              ${str(args.category, 'category', { optional: true })}, ${tags(args.tags)},
              ${args.isPublic === true}, ${str(args.coverColor, 'coverColor', { optional: true, max: 40 })})
      returning id
    `) as Array<{ id: string }>;
    return { id: row.id };
  },

  async add_deck_to_collection(args, userId) {
    const collectionId = uuid(args.collectionId, 'collectionId');
    const deckId = uuid(args.deckId, 'deckId');
    await assertOwns('collections', collectionId, userId);
    await assertOwns('decks', deckId, userId);
    await sql`
      insert into public.deck_collections (collection_id, deck_id, owner_id, order_index)
      values (${collectionId}, ${deckId}, ${userId}, ${int(args.orderIndex, 0)})
      on conflict (collection_id, deck_id) do update set order_index = excluded.order_index
    `;
    return { ok: true };
  },

  async list_collections(args, userId) {
    const limit = Math.min(Math.max(int(args.limit, 50)!, 1), 200);
    return sql`
      select id, title, description, is_public, deck_count, created_at
      from public.collections where owner_id = ${userId}
      order by created_at desc limit ${limit}
    `;
  },

  async create_quiz(args, userId) {
    const collectionId = uuid(args.collectionId, 'collectionId');
    await assertOwns('collections', collectionId, userId);
    const [row] = (await sql`
      insert into public.quizzes (owner_id, collection_id, title, description, pass_threshold, order_index)
      values (${userId}, ${collectionId}, ${str(args.title, 'title')},
              ${str(args.description, 'description', { optional: true, max: 2000 })},
              ${int(args.passThreshold, null)}, ${int(args.orderIndex, 0)})
      returning id
    `) as Array<{ id: string }>;
    return { id: row.id };
  },

  async add_quiz_questions(args, userId) {
    const quizId = uuid(args.quizId, 'quizId');
    const questions = list(args.questions, 'questions', MAX_QUESTIONS, (q) => {
      const options = list(q.options, 'question.options', 20, (o) => ({
        id: randomUUID(),
        text: str(o.text, 'option.text', { max: 2000 })!,
        correct: o.correct === true,
      }));
      if (options.length < 2 || !options.some((o) => o.correct)) {
        throw new BadRequest('each question needs at least 2 options and one correct');
      }
      const kind = ['single', 'multiple', 'boolean'].includes(q.kind as string) ? q.kind : 'single';
      return {
        prompt: str(q.prompt, 'question.prompt', { max: MAX_TEXT }),
        kind,
        options,
        explanation: str(q.explanation, 'question.explanation', { optional: true, max: MAX_TEXT }),
      };
    });
    await assertOwns('quizzes', quizId, userId);
    const rows = questions.map((q, i) => ({ ...q, order_index: i }));
    await sql`
      insert into public.quiz_questions (quiz_id, owner_id, prompt, kind, options, explanation, order_index)
      select ${quizId}, ${userId}, q.prompt, q.kind, q.options, q.explanation, q.order_index
      from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
        as q(prompt text, kind text, options jsonb, explanation text, order_index int)
    `;
    return { inserted: rows.length };
  },
};

export async function POST(req: Request) {
  const userId = await userFromToken(req);
  if (!userId) return json({ error: 'Invalid or revoked MCP token' }, 401);

  const body = await readJson<{ tool?: string; args?: Record<string, unknown> }>(req);
  const tool = body?.tool && Object.hasOwn(tools, body.tool) ? tools[body.tool] : undefined;
  if (!tool) return json({ error: 'Unknown tool' }, 400);

  try {
    return json({ result: await tool(body?.args ?? {}, userId) });
  } catch (err) {
    if (err instanceof BadRequest) return json({ error: err.message }, 400);
    // P0001 messages carry the plan-quota JSON; the MCP client renders them.
    const message = pgErrorMessage(err);
    console.error('mcp tool failed', body?.tool, message);
    return json({ error: message }, 422);
  }
}
