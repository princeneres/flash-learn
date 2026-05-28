export type PlanErrorCode =
  | 'DECK_LIMIT_REACHED'
  | 'TOTAL_CARD_LIMIT_REACHED'
  | 'DECK_CARD_LIMIT_REACHED'
  | 'PLAN_NOT_FOUND';

export interface PlanErrorPayload {
  code: PlanErrorCode;
  limit?: number;
  current?: number;
  plan?: string;
}

export class PlanLimitError extends Error {
  payload: PlanErrorPayload;
  constructor(payload: PlanErrorPayload) {
    super(payload.code);
    this.name = 'PlanLimitError';
    this.payload = payload;
  }
}

const KNOWN_CODES: PlanErrorCode[] = [
  'DECK_LIMIT_REACHED',
  'TOTAL_CARD_LIMIT_REACHED',
  'DECK_CARD_LIMIT_REACHED',
  'PLAN_NOT_FOUND',
];

const extractJson = (msg: string): PlanErrorPayload | null => {
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
};

export const parsePlanError = (err: unknown): PlanLimitError | null => {
  if (err instanceof PlanLimitError) return err;
  if (!err || typeof err !== 'object') return null;
  const anyErr = err as { code?: unknown; message?: unknown; details?: unknown };
  const code = typeof anyErr.code === 'string' ? anyErr.code : undefined;
  if (code !== 'P0001') {
    const payloadFromMsg =
      (typeof anyErr.message === 'string' && extractJson(anyErr.message)) ||
      (typeof anyErr.details === 'string' && extractJson(anyErr.details));
    return payloadFromMsg ? new PlanLimitError(payloadFromMsg) : null;
  }
  const payload =
    (typeof anyErr.message === 'string' && extractJson(anyErr.message)) ||
    (typeof anyErr.details === 'string' && extractJson(anyErr.details));
  return payload ? new PlanLimitError(payload) : null;
};

export const throwIfPlanError = (err: unknown): never => {
  const plan = parsePlanError(err);
  if (plan) throw plan;
  throw err;
};

type Translator = (key: string, values?: Record<string, unknown>) => string;

export const planErrorTitle = (err: PlanLimitError, t: Translator): string => {
  const { code, limit, plan } = err.payload;
  const params = { limit: limit ?? 0, plan: plan ?? 'free' };
  switch (code) {
    case 'DECK_LIMIT_REACHED':       return t('errors.deckLimitReached', params);
    case 'TOTAL_CARD_LIMIT_REACHED': return t('errors.totalCardLimitReached', params);
    case 'DECK_CARD_LIMIT_REACHED':  return t('errors.deckCardLimitReached', params);
    case 'PLAN_NOT_FOUND':           return t('errors.planNotFound');
  }
};
