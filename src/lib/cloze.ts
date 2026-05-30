// Cloze deletion support. A cloze card hides one or more spans of its front
// text behind blanks; the learner recalls them before revealing the answer.
//
// Syntax (Anki-compatible subset): {{c1::hidden text}} or {{c1::hidden::hint}}
// The card type is inferred from the content — no schema column needed.
//
// MVP scope: every cloze on a card is masked together on the front and revealed
// together on the back (Anki generates one card per cloze number; we don't yet).

// Non-global matcher for cheap presence checks (avoids lastIndex statefulness).
const CLOZE_DETECT = /\{\{c\d+::[\s\S]*?\}\}/;

/** True when the text contains at least one cloze marker. */
export const hasCloze = (s: string | null | undefined): boolean => !!s && CLOZE_DETECT.test(s);

const CLOZE_GLOBAL = /\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g;

/**
 * Replaces cloze markers with styled spans. Runs on already-sanitized HTML, so
 * the captured text is itself sanitized — it is reinserted verbatim.
 * - `front`: the hidden text becomes a blank (showing the hint if present).
 * - `back`: the hidden text is shown, highlighted.
 */
export const renderCloze = (html: string, mode: 'front' | 'back'): string =>
  html.replace(CLOZE_GLOBAL, (_match, _num: string, text: string, hint?: string) => {
    if (mode === 'back') {
      return `<span class="cloze cloze-revealed">${text}</span>`;
    }
    const label = hint && hint.trim() ? hint : '[&middot;&middot;&middot;]';
    return `<span class="cloze">${label}</span>`;
  });

/** Strips cloze markers to their hidden text — used for plain-text comparison. */
export const stripCloze = (s: string): string =>
  s.replace(CLOZE_GLOBAL, (_match, _num: string, text: string) => text);

/** Highest cloze index already present, so the editor can assign the next one. */
export const maxClozeIndex = (s: string): number => {
  let max = 0;
  for (const m of s.matchAll(/\{\{c(\d+)::/g)) {
    const n = Number.parseInt(m[1], 10);
    if (n > max) max = n;
  }
  return max;
};
