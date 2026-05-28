import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'code',
  'pre',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'blockquote',
  'a',
  'img',
  'audio',
  'source',
  'span',
  'div',
  'hr',
];

const ALLOWED_ATTR = [
  'href',
  'target',
  'rel',
  'src',
  'alt',
  'title',
  'controls',
  'type',
  'class',
  'data-tex',
];

const URI_REGEX = /^(?:(?:https?|mailto|tel|media):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;

let configured = false;
const ensureConfig = () => {
  if (configured) return;
  configured = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
      const existing = node.getAttribute('class') ?? '';
      if (!existing.includes('rich-link')) {
        node.setAttribute('class', `${existing} rich-link`.trim());
      }
    }
  });
};

export const sanitizeRichHtml = (html: string): string => {
  ensureConfig();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: URI_REGEX,
  });
};

/** Returns true if string contains HTML-looking content. */
export const looksLikeHtml = (s: string): boolean =>
  /<\/?[a-z][\s\S]*>/i.test(s);
