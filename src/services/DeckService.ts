import { neon } from '../lib/neon';
import { MediaStorageService } from './MediaStorageService';
import { collectCardMediaRefs } from '../lib/media';
import { fromDbDeck, toDbDeck } from './_mappers';
import { parsePlanError } from '../lib/planErrors';
import { CardService } from './CardService';
import type { SrsSettings } from './srsAlgorithm';

export interface Deck {
  id: string;
  ownerId: string;
  /** Owner's current display name, resolved from their profile (public decks only). */
  ownerName?: string;
  title: string;
  category: string;
  tags: string[];
  isPublic: boolean;
  cardCount: number;
  createdAt: string;
  /** Per-deck scheduler tunables, always normalized (defaults filled in). */
  srsSettings: SrsSettings;
}

const TABLE = 'decks';

export const DeckService = {
  createDeck: async (ownerId: string, deck: Partial<Deck>): Promise<string> => {
    const payload = toDbDeck({ ...deck, ownerId });
    const { data, error } = await neon.from(TABLE).insert(payload).select('id').single();
    if (error) {
      const plan = parsePlanError(error);
      throw plan ?? error;
    }
    return data.id as string;
  },

  getUserDecks: async (ownerId: string): Promise<Deck[]> => {
    const { data, error } = await neon
      .from(TABLE)
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(fromDbDeck);
  },

  getDeck: async (deckId: string): Promise<Deck | null> => {
    const { data, error } = await neon.from(TABLE).select('*').eq('id', deckId).maybeSingle();
    if (error) throw error;
    return data ? fromDbDeck(data) : null;
  },

  // Like getDeck, but resolves the owner's current display name (works for
  // public decks owned by other users, where profiles RLS blocks a direct read).
  getDeckDetail: async (deckId: string): Promise<Deck | null> => {
    const { data, error } = await neon.rpc('get_deck_detail', { p_deck_id: deckId });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return row ? fromDbDeck(row) : null;
  },

  updateDeck: async (deckId: string, patch: Partial<Deck>): Promise<void> => {
    const payload: Record<string, unknown> = {};
    if (patch.title !== undefined) payload.title = patch.title;
    if (patch.category !== undefined) payload.category = patch.category;
    if (patch.tags !== undefined) payload.tags = patch.tags;
    if (patch.isPublic !== undefined) payload.is_public = patch.isPublic;
    if (patch.srsSettings !== undefined) payload.srs_settings = patch.srsSettings;
    const { error } = await neon.from(TABLE).update(payload).eq('id', deckId);
    if (error) throw error;
  },

  deleteDeck: async (deckId: string): Promise<void> => {
    const { data: cardRows } = await neon
      .from('cards')
      .select('front, back, front_audio, back_audio')
      .eq('deck_id', deckId);
    const refs = (cardRows ?? []).flatMap((row) =>
      collectCardMediaRefs({
        front: row.front,
        back: row.back,
        frontAudio: row.front_audio,
        backAudio: row.back_audio,
      }),
    );
    if (refs.length > 0) {
      try {
        await MediaStorageService.deleteMany(refs);
      } catch (err) {
        console.error('Failed to delete deck media', err);
      }
    }
    const { error } = await neon.from(TABLE).delete().eq('id', deckId);
    if (error) throw error;
  },

  // Clone a deck the caller can read (their own or a public one) into a brand-new
  // deck owned by them. Card media refs are copied verbatim — the same stored
  // files are reused, mirroring how studying a public deck already references
  // them. The copy starts private and its cards reset to fresh SRS state (the
  // bulk insert leaves the scheduler columns at their "new" defaults).
  copyDeck: async (
    ownerId: string,
    sourceDeckId: string,
    overrides?: Partial<Pick<Deck, 'title' | 'category' | 'tags' | 'srsSettings'>>,
  ): Promise<string> => {
    const source = await DeckService.getDeckDetail(sourceDeckId);
    if (!source) throw new Error('Source deck not found');
    const cards = await CardService.getDeckCards(sourceDeckId);

    const newDeckId = await DeckService.createDeck(ownerId, {
      title: overrides?.title ?? source.title,
      category: overrides?.category ?? source.category,
      tags: overrides?.tags ?? source.tags,
      isPublic: false,
      srsSettings: overrides?.srsSettings ?? source.srsSettings,
    });

    await CardService.bulkCreateCards(
      ownerId,
      newDeckId,
      cards.map((c) => ({
        front: c.front,
        back: c.back,
        frontAudio: c.frontAudio,
        backAudio: c.backAudio,
        tags: c.tags,
      })),
    );

    return newDeckId;
  },

  // Served through an RPC so each deck carries its owner's *current* profile
  // name (resolving it client-side is blocked by RLS on other users' profiles).
  getPublicDecks: async (): Promise<Deck[]> => {
    const { data, error } = await neon.rpc('get_public_decks');
    if (error) throw error;
    return (data ?? []).map(fromDbDeck);
  },
};
