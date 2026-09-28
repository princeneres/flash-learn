import { neon } from '../lib/neon';
import { fromDbCollection, toDbCollection, fromDbDeck } from './_mappers';
import type { Deck } from './DeckService';

export interface Collection {
  id: string;
  ownerId: string;
  /** Owner's current display name, resolved from their profile (public collections only). */
  ownerName?: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  isPublic: boolean;
  coverColor?: string;
  deckCount: number;
  createdAt: string;
}

/** A deck as it appears inside a collection, carrying its position in the order. */
export interface CollectionDeck extends Deck {
  orderIndex: number;
}

const TABLE = 'collections';

export const CollectionService = {
  createCollection: async (ownerId: string, collection: Partial<Collection>): Promise<string> => {
    const payload = toDbCollection({ ...collection, ownerId });
    const { data, error } = await neon.from(TABLE).insert(payload).select('id').single();
    if (error) throw error;
    return data.id as string;
  },

  getUserCollections: async (ownerId: string): Promise<Collection[]> => {
    const { data, error } = await neon
      .from(TABLE)
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(fromDbCollection);
  },

  getCollection: async (collectionId: string): Promise<Collection | null> => {
    const { data, error } = await neon
      .from(TABLE)
      .select('*')
      .eq('id', collectionId)
      .maybeSingle();
    if (error) throw error;
    return data ? fromDbCollection(data) : null;
  },

  // Like getCollection, but resolves the owner's current display name (works for
  // public collections owned by other users, where profiles RLS blocks a read).
  getCollectionDetail: async (collectionId: string): Promise<Collection | null> => {
    const { data, error } = await neon.rpc('get_collection_detail', {
      p_collection_id: collectionId,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return row ? fromDbCollection(row) : null;
  },

  updateCollection: async (collectionId: string, patch: Partial<Collection>): Promise<void> => {
    const payload: Record<string, unknown> = {};
    if (patch.title !== undefined) payload.title = patch.title;
    if (patch.description !== undefined) payload.description = patch.description;
    if (patch.category !== undefined) payload.category = patch.category;
    if (patch.tags !== undefined) payload.tags = patch.tags;
    if (patch.isPublic !== undefined) payload.is_public = patch.isPublic;
    if (patch.coverColor !== undefined) payload.cover_color = patch.coverColor;
    const { error } = await neon.from(TABLE).update(payload).eq('id', collectionId);
    if (error) throw error;
  },

  deleteCollection: async (collectionId: string): Promise<void> => {
    // Cascades to deck_collections links and quizzes (FK on delete cascade);
    // member decks themselves are left untouched.
    const { error } = await neon.from(TABLE).delete().eq('id', collectionId);
    if (error) throw error;
  },

  getPublicCollections: async (): Promise<Collection[]> => {
    const { data, error } = await neon.rpc('get_public_collections');
    if (error) throw error;
    return (data ?? []).map(fromDbCollection);
  },

  // --- Membership (M:N deck_collections) ---------------------------------

  getCollectionDecks: async (collectionId: string): Promise<CollectionDeck[]> => {
    const { data, error } = await neon.rpc('get_collection_decks', {
      p_collection_id: collectionId,
    });
    if (error) throw error;
    return (data ?? []).map((row: Record<string, unknown>) => ({
      ...fromDbDeck(row as never),
      orderIndex: (row.order_index as number) ?? 0,
    }));
  },

  /** Collection ids the given deck currently belongs to (for the deck editor). */
  getDeckCollectionIds: async (deckId: string): Promise<string[]> => {
    const { data, error } = await neon
      .from('deck_collections')
      .select('collection_id')
      .eq('deck_id', deckId);
    if (error) throw error;
    return (data ?? []).map((r) => r.collection_id as string);
  },

  addDeck: async (
    ownerId: string,
    collectionId: string,
    deckId: string,
    orderIndex = 0,
  ): Promise<void> => {
    const { error } = await neon.from('deck_collections').upsert(
      {
        owner_id: ownerId,
        collection_id: collectionId,
        deck_id: deckId,
        order_index: orderIndex,
      },
      { onConflict: 'collection_id,deck_id' },
    );
    if (error) throw error;
  },

  removeDeck: async (collectionId: string, deckId: string): Promise<void> => {
    const { error } = await neon
      .from('deck_collections')
      .delete()
      .eq('collection_id', collectionId)
      .eq('deck_id', deckId);
    if (error) throw error;
  },

  setDeckOrder: async (collectionId: string, deckId: string, orderIndex: number): Promise<void> => {
    const { error } = await neon
      .from('deck_collections')
      .update({ order_index: orderIndex })
      .eq('collection_id', collectionId)
      .eq('deck_id', deckId);
    if (error) throw error;
  },
};
