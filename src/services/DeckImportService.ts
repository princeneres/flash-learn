import JSZip from 'jszip';
import { DeckService } from './DeckService';
import { CardService } from './CardService';
import { MediaStorageService, type MediaKind } from './MediaStorageService';
import { collectCardMediaRefs } from '../lib/media';

export interface NativeCard {
  front: string;
  back: string;
  frontAudio?: string;
  backAudio?: string;
  tags?: string[];
}

export interface NativeDeck {
  title: string;
  category?: string;
  tags?: string[];
  isPublic?: boolean;
  cards: NativeCard[];
}

export interface MediaBlobEntry {
  blob: Blob;
  kind: MediaKind;
}

export interface ImportBundle {
  decks: NativeDeck[];
  mediaBlobs: Map<string, MediaBlobEntry>;
}

const mimeFromName = (name: string): string => {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'mp3':
      return 'audio/mpeg';
    case 'ogg':
    case 'opus':
      return 'audio/ogg';
    case 'wav':
      return 'audio/wav';
    case 'm4a':
    case 'mp4':
      return 'audio/mp4';
    case 'webm':
      return 'audio/webm';
    case 'aac':
      return 'audio/aac';
    case 'flac':
      return 'audio/flac';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    case 'bmp':
      return 'image/bmp';
    case 'avif':
      return 'image/avif';
    default:
      return 'application/octet-stream';
  }
};

export class UnsupportedImportError extends Error {
  constructor() {
    super('Not a Flash Learn deck export.');
    this.name = 'UnsupportedImportError';
  }
}

const parseNative = async (file: File): Promise<ImportBundle> => {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new UnsupportedImportError();
  }

  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) throw new UnsupportedImportError();

  let manifest: any;
  try {
    manifest = JSON.parse(await manifestFile.async('string'));
  } catch {
    throw new UnsupportedImportError();
  }
  if (manifest?.app !== 'flash-learn' || !Array.isArray(manifest.decks)) {
    throw new UnsupportedImportError();
  }

  const decks: NativeDeck[] = manifest.decks.map((b: any) => ({
    title: String(b?.deck?.title ?? 'Untitled'),
    category: typeof b?.deck?.category === 'string' ? b.deck.category : undefined,
    tags: Array.isArray(b?.deck?.tags)
      ? b.deck.tags.filter((t: unknown) => typeof t === 'string')
      : [],
    isPublic: !!b?.deck?.isPublic,
    cards: Array.isArray(b?.cards)
      ? b.cards.map((c: any) => ({
          front: String(c?.front ?? ''),
          back: String(c?.back ?? ''),
          frontAudio: typeof c?.frontAudio === 'string' && c.frontAudio ? c.frontAudio : undefined,
          backAudio: typeof c?.backAudio === 'string' && c.backAudio ? c.backAudio : undefined,
          tags: Array.isArray(c?.tags)
            ? c.tags.filter((t: unknown) => typeof t === 'string')
            : undefined,
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
    const buffer = await entry.async('arraybuffer');
    const blob = new Blob([buffer], { type: mimeFromName(ref) });
    mediaBlobs.set(ref, { blob, kind });
  }

  return { decks, mediaBlobs };
};

export const DeckImportService = {
  parseFile: (file: File): Promise<ImportBundle> => parseNative(file),

  importBundle: async (
    uid: string,
    bundle: ImportBundle,
    perDeckLimit: number,
    totalRoom: number,
    onMediaProgress?: (done: number, total: number) => void,
  ): Promise<{ decksCreated: number; cardsCreated: number }> => {
    let remaining = Math.max(0, totalRoom);
    const trimmedDecks = bundle.decks.map((d) => {
      const perDeck = d.cards.slice(0, Math.max(0, perDeckLimit));
      const take = Math.min(perDeck.length, remaining);
      remaining -= take;
      return { ...d, cards: perDeck.slice(0, take) };
    });
    const keptRefs = new Set<string>();
    for (const d of trimmedDecks) {
      for (const c of d.cards) {
        for (const r of collectCardMediaRefs(c)) keptRefs.add(r.ref);
      }
    }
    const mediaToUpload = Array.from(bundle.mediaBlobs).filter(([ref]) => keptRefs.has(ref));
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
      if (deck.cards.length === 0) continue;
      const deckId = await DeckService.createDeck(uid, {
        title: deck.title,
        category: deck.category ?? 'General',
        tags: deck.tags ?? [],
        isPublic: !!deck.isPublic,
      });
      decksCreated++;
      const inserted = await CardService.bulkCreateCards(
        uid,
        deckId,
        deck.cards.map((c) => ({
          front: c.front,
          back: c.back,
          frontAudio: c.frontAudio,
          backAudio: c.backAudio,
          tags: c.tags,
        })),
      );
      cardsCreated += inserted;
    }
    return { decksCreated, cardsCreated };
  },
};
