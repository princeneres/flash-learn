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

const isAudioRef = (ref: string): boolean =>
  /\.(mp3|ogg|wav|m4a|webm|aac|opus|flac)$/i.test(ref);

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
  })),
});

const buildZip = async (
  bundles: Array<{ deck: Deck; cards: Card[] }>
): Promise<Blob> => {
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

  for (const [ref, kind] of allRefs) {
    const blob = await MediaStorageService.getBlob(kind, ref);
    if (blob) {
      zip.file(`media/${kind}/${ref}`, blob);
    }
  }

  return zip.generateAsync({ type: 'blob', compression: 'STORE' });
};

const stamp = (): string => new Date().toISOString().slice(0, 10);

const sanitizeFilename = (s: string): string =>
  s.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'deck';

export const DeckExportService = {
  exportDeck: async (
    deckId: string
  ): Promise<{ blob: Blob; filename: string }> => {
    const [deck, cards] = await Promise.all([
      DeckService.getDeck(deckId),
      CardService.getDeckCards(deckId),
    ]);
    if (!deck) throw new Error('Deck not found');
    const blob = await buildZip([{ deck, cards }]);
    const filename = `${sanitizeFilename(deck.title)}-${stamp()}.fldeck.zip`;
    return { blob, filename };
  },

  exportAllDecks: async (
    uid: string
  ): Promise<{ blob: Blob; filename: string; count: number }> => {
    const decks = await DeckService.getUserDecks(uid);
    const bundles: Array<{ deck: Deck; cards: Card[] }> = [];
    for (const deck of decks) {
      const cards = await CardService.getDeckCards(deck.id);
      bundles.push({ deck, cards });
    }
    const blob = await buildZip(bundles);
    const filename = `flash-learn-decks-${stamp()}.fldeck.zip`;
    return { blob, filename, count: decks.length };
  },
};
