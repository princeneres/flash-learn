import JSZip from 'jszip';
import { DeckService, type Deck } from './DeckService';
import { CardService, type Card } from './CardService';
import { MediaStorageService, type MediaKind } from './MediaStorageService';

const MEDIA_RE = /\bmedia:\/\/([^"'\s>)]+)/g;

interface ExportedCard {
  front: string;
  back: string;
  frontAudio?: string;
  backAudio?: string;
  tags?: string[];
}

interface DeckBundle {
  deck: {
    title: string;
    category?: string;
    tags?: string[];
    isPublic?: boolean;
  };
  cards: ExportedCard[];
}

interface ManifestV1 {
  version: 1;
  exportedAt: string;
  app: 'flash-learn';
  decks: DeckBundle[];
}

export type ExportPhase = 'collecting' | 'media' | 'packaging';

export interface ExportProgress {
  phase: ExportPhase;
  done: number;
  total: number;
}

interface ExportOptions {
  signal?: AbortSignal;
  onProgress?: (progress: ExportProgress) => void;
}

export class ExportCancelledError extends Error {
  constructor() {
    super('Export cancelled');
    this.name = 'ExportCancelledError';
  }
}

const throwIfAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) throw new ExportCancelledError();
};

const isAudioRef = (ref: string): boolean => /\.(mp3|ogg|wav|m4a|webm|aac|opus|flac)$/i.test(ref);

const collectMediaRefs = (cards: Card[]): Map<string, MediaKind> => {
  const out = new Map<string, MediaKind>();
  for (const c of cards) {
    if (c.frontAudio) out.set(c.frontAudio, 'audio');
    if (c.backAudio) out.set(c.backAudio, 'audio');
    for (const html of [c.front, c.back]) {
      if (!html) continue;
      let m: RegExpExecArray | null;
      const re = new RegExp(MEDIA_RE.source, 'g');
      while ((m = re.exec(html))) {
        const ref = m[1];
        if (out.has(ref)) continue;
        out.set(ref, isAudioRef(ref) ? 'audio' : 'image');
      }
    }
  }
  return out;
};

const toBundle = (deck: Deck, cards: Card[]): DeckBundle => ({
  deck: {
    title: deck.title,
    category: deck.category,
    tags: deck.tags,
    isPublic: deck.isPublic,
  },
  cards: cards.map((c) => ({
    front: c.front,
    back: c.back,
    frontAudio: c.frontAudio,
    backAudio: c.backAudio,
    tags: c.tags && c.tags.length ? c.tags : undefined,
  })),
});

const buildZip = async (
  bundles: Array<{ deck: Deck; cards: Card[] }>,
  options: ExportOptions = {},
): Promise<Blob> => {
  const { signal, onProgress } = options;
  const zip = new JSZip();
  const allRefs = new Map<string, MediaKind>();
  const manifest: ManifestV1 = {
    version: 1,
    exportedAt: new Date().toISOString(),
    app: 'flash-learn',
    decks: bundles.map(({ deck, cards }) => {
      collectMediaRefs(cards).forEach((kind, ref) => allRefs.set(ref, kind));
      return toBundle(deck, cards);
    }),
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  const refs = [...allRefs];
  let mediaDone = 0;
  onProgress?.({ phase: 'media', done: mediaDone, total: refs.length });
  for (const [ref, kind] of refs) {
    throwIfAborted(signal);
    const blob = await MediaStorageService.getBlob(kind, ref);
    if (blob) {
      zip.file(`media/${kind}/${ref}`, blob);
    }
    mediaDone += 1;
    onProgress?.({ phase: 'media', done: mediaDone, total: refs.length });
  }

  throwIfAborted(signal);
  onProgress?.({ phase: 'packaging', done: 0, total: 1 });
  const out = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  onProgress?.({ phase: 'packaging', done: 1, total: 1 });
  return out;
};

const stamp = (): string => new Date().toISOString().slice(0, 10);

const sanitizeFilename = (s: string): string =>
  s
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'deck';

export const DeckExportService = {
  exportDeck: async (deckId: string): Promise<{ blob: Blob; filename: string }> => {
    const [deck, cards] = await Promise.all([
      DeckService.getDeck(deckId),
      CardService.getDeckCards(deckId),
    ]);
    if (!deck) throw new Error('Deck not found');
    const blob = await buildZip([{ deck, cards }]);
    const filename = `${sanitizeFilename(deck.title)}-${stamp()}.fldeck.zip`;
    return { blob, filename };
  },

  exportDecks: async (
    deckIds: string[],
    options: ExportOptions = {},
  ): Promise<{ blob: Blob; filename: string; count: number }> => {
    const { signal, onProgress } = options;
    const bundles: Array<{ deck: Deck; cards: Card[] }> = [];
    onProgress?.({ phase: 'collecting', done: 0, total: deckIds.length });
    for (let i = 0; i < deckIds.length; i += 1) {
      throwIfAborted(signal);
      const [deck, cards] = await Promise.all([
        DeckService.getDeck(deckIds[i]),
        CardService.getDeckCards(deckIds[i]),
      ]);
      if (deck) bundles.push({ deck, cards });
      onProgress?.({ phase: 'collecting', done: i + 1, total: deckIds.length });
    }

    const blob = await buildZip(bundles, { signal, onProgress });
    const count = bundles.length;
    const filename =
      count === 1
        ? `${sanitizeFilename(bundles[0].deck.title)}-${stamp()}.fldeck.zip`
        : `flash-learn-decks-${stamp()}.fldeck.zip`;
    return { blob, filename, count };
  },
};
