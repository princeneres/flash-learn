import JSZip from 'jszip';
import {
  AnkiImportService,
  type ParsedCard,
  type MediaBlobEntry,
} from './AnkiImportService';
import { DeckService } from './DeckService';
import { CardService, DECK_CARD_LIMIT } from './CardService';
import { MediaStorageService, type MediaKind } from './MediaStorageService';
import { collectCardMediaRefs } from '../lib/media';

export interface NativeCard {
  front: string;
  back: string;
  frontAudio?: string;
  backAudio?: string;
}

export interface NativeDeck {
  title: string;
  category?: string;
  tags?: string[];
  isPublic?: boolean;
  cards: NativeCard[];
}

export interface NativeImport {
  kind: 'native';
  decks: NativeDeck[];
  mediaBlobs: Map<string, MediaBlobEntry>;
}

export interface AnkiImport {
  kind: 'anki';
  deckName?: string;
  cards: ParsedCard[];
  mediaBlobs: Map<string, MediaBlobEntry>;
}

export type ImportResult = NativeImport | AnkiImport;

const mimeFromName = (name: string): string => {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'mp3': return 'audio/mpeg';
    case 'ogg': case 'opus': return 'audio/ogg';
    case 'wav': return 'audio/wav';
    case 'm4a': case 'mp4': return 'audio/mp4';
    case 'webm': return 'audio/webm';
    case 'aac': return 'audio/aac';
    case 'flac': return 'audio/flac';
    case 'png': return 'image/png';
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    case 'svg': return 'image/svg+xml';
    case 'bmp': return 'image/bmp';
    case 'avif': return 'image/avif';
    default: return 'application/octet-stream';
  }
};

const tryParseNative = async (file: File): Promise<NativeImport | null> => {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    return null;
  }
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) return null;
  let manifest: any;
  try {
    manifest = JSON.parse(await manifestFile.async('string'));
  } catch {
    return null;
  }
  if (manifest?.app !== 'flash-learn' || !Array.isArray(manifest.decks)) {
    return null;
  }
  const decks: NativeDeck[] = manifest.decks.map((b: any) => ({
    title: String(b?.deck?.title ?? 'Untitled'),
    category: typeof b?.deck?.category === 'string' ? b.deck.category : undefined,
    tags: Array.isArray(b?.deck?.tags) ? b.deck.tags.filter((t: unknown) => typeof t === 'string') : [],
    isPublic: !!b?.deck?.isPublic,
    cards: Array.isArray(b?.cards)
      ? b.cards.map((c: any) => ({
          front: String(c?.front ?? ''),
          back: String(c?.back ?? ''),
          frontAudio: typeof c?.frontAudio === 'string' && c.frontAudio ? c.frontAudio : undefined,
          backAudio: typeof c?.backAudio === 'string' && c.backAudio ? c.backAudio : undefined,
        }))
      : [],
  }));

  const mediaBlobs = new Map<string, MediaBlobEntry>();
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const m = path.match(/^media\/(audio|image)\/(.+)$/);
    if (!m) continue;
    const kind = m[1] as MediaKind;
    const ref = m[2];
    const bytes = await entry.async('uint8array');
    const blob = new Blob([bytes], { type: mimeFromName(ref) });
    mediaBlobs.set(ref, { blob, kind });
  }

  return { kind: 'native', decks, mediaBlobs };
};

export const DeckImportService = {
  parseFile: async (file: File): Promise<ImportResult> => {
    const name = file.name.toLowerCase();

    if (name.endsWith('.apkg') || name.endsWith('.colpkg')) {
      const r = await AnkiImportService.parseFile(file);
      return { kind: 'anki', deckName: r.deckName, cards: r.cards, mediaBlobs: r.mediaBlobs };
    }

    if (name.endsWith('.zip')) {
      const native = await tryParseNative(file);
      if (native) return native;
      // Fallback: maybe it's an Anki apkg renamed .zip
      const r = await AnkiImportService.parseFile(file);
      return { kind: 'anki', deckName: r.deckName, cards: r.cards, mediaBlobs: r.mediaBlobs };
    }

    const r = await AnkiImportService.parseFile(file);
    return { kind: 'anki', deckName: r.deckName, cards: r.cards, mediaBlobs: r.mediaBlobs };
  },

  importNative: async (
    uid: string,
    ownerName: string | undefined,
    bundle: NativeImport,
    onMediaProgress?: (done: number, total: number) => void
  ): Promise<{ decksCreated: number; cardsCreated: number }> => {
    // Truncate each deck to the limit and compute which refs survive.
    const trimmedDecks = bundle.decks.map((d) => ({
      ...d,
      cards: d.cards.slice(0, DECK_CARD_LIMIT),
    }));
    const keptRefs = new Set<string>();
    for (const d of trimmedDecks) {
      for (const c of d.cards) {
        for (const r of collectCardMediaRefs(c)) keptRefs.add(r.ref);
      }
    }
    const mediaToUpload = Array.from(bundle.mediaBlobs).filter(([ref]) =>
      keptRefs.has(ref)
    );
    if (mediaToUpload.length > 0) {
      let done = 0;
      onMediaProgress?.(0, mediaToUpload.length);
      for (const [ref, { blob, kind }] of mediaToUpload) {
        await MediaStorageService.put(kind, ref, blob);
        done++;
        onMediaProgress?.(done, mediaToUpload.length);
      }
    }
    let decksCreated = 0;
    let cardsCreated = 0;
    for (const deck of trimmedDecks) {
      const deckId = await DeckService.createDeck(uid, {
        title: deck.title,
        category: deck.category ?? 'General',
        tags: deck.tags ?? [],
        isPublic: !!deck.isPublic,
        ownerName,
      });
      decksCreated++;
      if (deck.cards.length > 0) {
        const inserted = await CardService.bulkCreateCards(
          uid,
          deckId,
          deck.cards.map((c) => ({
            front: c.front,
            back: c.back,
            frontAudio: c.frontAudio,
            backAudio: c.backAudio,
          }))
        );
        cardsCreated += inserted;
      }
    }
    return { decksCreated, cardsCreated };
  },
};
