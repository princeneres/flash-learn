// Per-deck daily limit on how many *new* cards a study session introduces.
// Stored client-side (localStorage) so it ships without a schema change; the
// reader/writer shape mirrors what a future `decks.daily_new_limit` column would
// expose, so moving it server-side later is a drop-in swap.

/** Default number of new cards introduced per day when a deck has no override. */
export const DEFAULT_NEW_LIMIT = 20;

/** Upper bound for the configurable limit (a sane ceiling for the input UI). */
export const MAX_NEW_LIMIT = 999;

const keyFor = (deckId: string): string => `fl.dailyNewLimit.${deckId}`;

/** Reads a deck's daily new-card limit, falling back to the global default. */
export function getNewLimit(deckId: string): number {
  if (typeof window === 'undefined') return DEFAULT_NEW_LIMIT;
  const raw = window.localStorage.getItem(keyFor(deckId));
  if (raw === null) return DEFAULT_NEW_LIMIT;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_NEW_LIMIT;
  return Math.min(n, MAX_NEW_LIMIT);
}

/** Persists a deck's daily new-card limit. Clamped to [0, MAX_NEW_LIMIT]. */
export function setNewLimit(deckId: string, limit: number): void {
  if (typeof window === 'undefined') return;
  const clamped = Math.max(0, Math.min(Math.round(limit), MAX_NEW_LIMIT));
  try {
    window.localStorage.setItem(keyFor(deckId), String(clamped));
  } catch {
    /* ignore storage failures (private mode, quota, etc.) */
  }
}

const typeAnswerKeyFor = (deckId: string): string => `fl.typeAnswer.${deckId}`;

/**
 * Whether a deck prompts the learner to type the answer before revealing it
 * (active recall). Off by default. Cloze cards ignore this — they have their
 * own reveal flow.
 */
export function getTypeAnswer(deckId: string): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(typeAnswerKeyFor(deckId)) === 'true';
}

/** Persists a deck's "type the answer" study preference. */
export function setTypeAnswer(deckId: string, enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(typeAnswerKeyFor(deckId), String(enabled));
  } catch {
    /* ignore storage failures (private mode, quota, etc.) */
  }
}
