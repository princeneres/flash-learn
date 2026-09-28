import { neon } from '../lib/neon';
import { fromDbDeck, type DbDeck } from './_mappers';
import type { Deck } from './DeckService';

// Favoriting works for any deck the user can read (their own or a public one).
// Listing resolves the owner's current display name through an RPC because
// profiles RLS hides other users' rows.
export const FavoriteService = {
  listFavoriteIds: async (): Promise<string[]> => {
    const { data, error } = await neon.from('deck_favorites').select('deck_id');
    if (error) throw error;
    return (data ?? []).map((r: { deck_id: string }) => r.deck_id);
  },

  getFavoriteDecks: async (): Promise<Deck[]> => {
    const { data, error } = await neon.rpc('get_favorite_decks');
    if (error) throw error;
    return ((data as DbDeck[]) ?? []).map(fromDbDeck);
  },

  add: async (userId: string, deckId: string): Promise<void> => {
    const { error } = await neon
      .from('deck_favorites')
      .insert({ user_id: userId, deck_id: deckId });
    if (error) throw error;
  },

  remove: async (userId: string, deckId: string): Promise<void> => {
    const { error } = await neon
      .from('deck_favorites')
      .delete()
      .eq('user_id', userId)
      .eq('deck_id', deckId);
    if (error) throw error;
  },
};
