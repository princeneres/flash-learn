import {
  Atom,
  Book,
  BookOpen,
  Brain,
  Calculator,
  Code2,
  Dumbbell,
  Globe2,
  HeartPulse,
  Landmark,
  Languages,
  Leaf,
  Music,
  Palette,
  Scale,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

export interface DeckVisual {
  /** Icon that represents the deck's subject. */
  Icon: LucideIcon;
  /** Tailwind classes for the icon tile background + icon color. */
  tile: string;
  /** Tailwind classes for a subtle top accent / ring tint. */
  accent: string;
}

/**
 * Stable accent palette — each deck gets a consistent colour so the grid reads
 * as a set of distinct subjects rather than a wall of identical blue cards.
 */
const PALETTE: { tile: string; accent: string }[] = [
  { tile: 'bg-blue-500/12 text-blue-500 dark:text-blue-400', accent: 'from-blue-500/40' },
  { tile: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', accent: 'from-amber-500/40' },
  {
    tile: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
    accent: 'from-emerald-500/40',
  },
  { tile: 'bg-sky-500/12 text-sky-600 dark:text-sky-400', accent: 'from-sky-500/40' },
  { tile: 'bg-rose-500/12 text-rose-500 dark:text-rose-400', accent: 'from-rose-500/40' },
  { tile: 'bg-cyan-500/12 text-cyan-600 dark:text-cyan-400', accent: 'from-cyan-500/40' },
  { tile: 'bg-orange-500/12 text-orange-600 dark:text-orange-400', accent: 'from-orange-500/40' },
  { tile: 'bg-teal-500/12 text-teal-600 dark:text-teal-400', accent: 'from-teal-500/40' },
];

/** Keyword → icon map. Matches PT and EN subject names (substring, lowercased). */
const ICON_KEYWORDS: { match: string[]; Icon: LucideIcon }[] = [
  { match: ['math', 'matemát', 'calcul', 'álgebra', 'algebra', 'geometr'], Icon: Calculator },
  {
    match: [
      'idioma',
      'inglês',
      'ingles',
      'english',
      'spanish',
      'espanhol',
      'french',
      'francês',
      'language',
      'vocab',
    ],
    Icon: Languages,
  },
  { match: ['hist', 'históri'], Icon: Landmark },
  { match: ['bio', 'biolog', 'botân', 'ecolog'], Icon: Leaf },
  { match: ['quím', 'quim', 'chemis', 'física', 'fisica', 'physic', 'átom', 'atom'], Icon: Atom },
  { match: ['ciênc', 'cienc', 'scien'], Icon: Sparkles },
  { match: ['code', 'program', 'cód', 'cod', 'dev', 'software', 'comput'], Icon: Code2 },
  { match: ['music', 'músic', 'musi'], Icon: Music },
  { match: ['art', 'arte', 'desenh', 'design', 'pint'], Icon: Palette },
  { match: ['saúde', 'saude', 'health', 'medic', 'medic', 'anatom', 'enferm'], Icon: HeartPulse },
  { match: ['geo', 'geograf', 'país', 'pais', 'world', 'mundo'], Icon: Globe2 },
  { match: ['direito', 'law', 'jurí', 'juri', 'legal'], Icon: Scale },
  { match: ['fitness', 'exerc', 'sport', 'esport', 'treino'], Icon: Dumbbell },
  { match: ['liter', 'leitura', 'reading', 'book', 'livro'], Icon: BookOpen },
  { match: ['psico', 'mente', 'mind', 'memor', 'brain', 'lógic', 'logic'], Icon: Brain },
];

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/**
 * Resolve a deterministic icon + colour for a deck from its category (falling
 * back to its title). Same input always yields the same visual.
 */
export function getDeckVisual(category?: string | null, title?: string | null): DeckVisual {
  const key = (category || title || '').toLowerCase().trim();
  const Icon =
    ICON_KEYWORDS.find((entry) => entry.match.some((m) => key.includes(m)))?.Icon ?? Book;
  const palette = PALETTE[hash(key || 'deck') % PALETTE.length];
  return { Icon, tile: palette.tile, accent: palette.accent };
}
