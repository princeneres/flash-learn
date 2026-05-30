// Helpers for the "type the answer" study mode: turn rich card content into
// comparable plain text and check a typed answer against it leniently.

/** Strips HTML tags and decodes entities to readable plain text. */
export const toPlainText = (html: string): string => {
  if (typeof document === 'undefined') {
    return html.replace(/<[^>]+>/g, ' ');
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent ?? '';
};

/**
 * Normalizes an answer for comparison: lowercased, trimmed, whitespace
 * collapsed, and diacritics removed — so "Café " matches "cafe".
 */
export const normalizeAnswer = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Lenient equality between a typed answer and the expected card back. */
export const answersMatch = (typed: string, expectedHtml: string): boolean => {
  const a = normalizeAnswer(typed);
  if (!a) return false;
  return a === normalizeAnswer(toPlainText(expectedHtml));
};
