// Single source of truth for deck categorization (one free-form category per
// deck + free tags). Categories are plain strings stored on decks.category;
// the presets below are only translated *suggestions* surfaced in the UI.

export const CATEGORY_PRESET_KEYS = [
  'english',
  'programming',
  'math',
  'languages',
  'science',
  'history',
] as const;

export type CategoryPresetKey = (typeof CATEGORY_PRESET_KEYS)[number];

/** Sentinel for "no category" — decks store an empty string. */
export const UNCATEGORIZED = '';

/** Trim a raw category value; empty/whitespace collapses to UNCATEGORIZED. */
export const normalizeCategory = (raw?: string | null): string => (raw ?? '').trim();

/** Lower-cases, trims, and de-duplicates tags while preserving first-seen order. */
export const normalizeTags = (tags?: Array<string | null | undefined> | null): string[] => {
  if (!tags) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const clean = (raw ?? '').trim().toLowerCase();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      out.push(clean);
    }
  }
  return out;
};

/** Split free text (comma / newline separated) into normalized tags. */
export const parseTagInput = (input: string): string[] => normalizeTags(input.split(/[,\n]/));

/** Distinct, sorted list of categories actually used across the given decks. */
export const collectCategories = (decks: Array<{ category?: string | null }>): string[] => {
  const set = new Set<string>();
  for (const d of decks) {
    const c = normalizeCategory(d.category);
    if (c) set.add(c);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
};
