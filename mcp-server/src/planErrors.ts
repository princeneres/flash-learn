/**
 * Mirrors src/lib/planErrors.ts. The plan-quota triggers raise a P0001 exception
 * whose message embeds a JSON payload like:
 *   { "code": "DECK_LIMIT_REACHED", "limit": 10, "current": 10, "plan": "free" }
 * We turn that into a friendly message for the MCP client instead of leaking a
 * raw Postgres error.
 */

export type PlanErrorCode =
  | 'DECK_LIMIT_REACHED'
  | 'TOTAL_CARD_LIMIT_REACHED'
  | 'DECK_CARD_LIMIT_REACHED'
  | 'PLAN_NOT_FOUND';

interface PlanErrorPayload {
  code: PlanErrorCode;
  limit?: number;
  current?: number;
  plan?: string;
}

const KNOWN_CODES: PlanErrorCode[] = [
  'DECK_LIMIT_REACHED',
  'TOTAL_CARD_LIMIT_REACHED',
  'DECK_CARD_LIMIT_REACHED',
  'PLAN_NOT_FOUND',
];

function extractJson(msg: string): PlanErrorPayload | null {
  if (!msg) return null;
  const start = msg.indexOf('{');
  const end = msg.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  try {
    const parsed = JSON.parse(msg.slice(start, end + 1));
    if (parsed && typeof parsed.code === 'string' && KNOWN_CODES.includes(parsed.code)) {
      return parsed as PlanErrorPayload;
    }
  } catch {
    return null;
  }
  return null;
}

function parsePlanError(err: unknown): PlanErrorPayload | null {
  if (!err || typeof err !== 'object') return null;
  const anyErr = err as { message?: unknown; details?: unknown };
  return (
    (typeof anyErr.message === 'string' && extractJson(anyErr.message)) ||
    (typeof anyErr.details === 'string' && extractJson(anyErr.details)) ||
    null
  );
}

function friendlyPlanMessage(p: PlanErrorPayload): string {
  const plan = p.plan ?? 'free';
  const limit = p.limit ?? 0;
  switch (p.code) {
    case 'DECK_LIMIT_REACHED':
      return `Limite de decks do plano "${plan}" atingido (${limit}). Faça upgrade para o Pro para criar mais.`;
    case 'TOTAL_CARD_LIMIT_REACHED':
      return `Limite total de cards do plano "${plan}" atingido (${limit}). Faça upgrade para o Pro.`;
    case 'DECK_CARD_LIMIT_REACHED':
      return `Limite de cards por deck do plano "${plan}" atingido (${limit}). Faça upgrade para o Pro.`;
    case 'PLAN_NOT_FOUND':
      return 'Não foi possível determinar seu plano. Contate o suporte.';
  }
}

/**
 * Throws a clean Error if `err` is a plan-quota violation; otherwise rethrows
 * the original error. Always throws.
 */
export function rethrowFriendly(err: unknown): never {
  const plan = parsePlanError(err);
  if (plan) throw new Error(friendlyPlanMessage(plan));
  const message =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message: unknown }).message)
      : String(err);
  throw new Error(message);
}
