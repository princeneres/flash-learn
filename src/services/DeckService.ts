import { supabase } from '../lib/supabase';
import { MediaStorageService } from './MediaStorageService';
import { collectCardMediaRefs } from '../lib/media';
import { fromDbDeck, toDbDeck } from './_mappers';

export interface Deck {
  id: string;
  ownerId: string;
  ownerName?: string;
  title: string;
  category: string;
  tags: string[];
  isPublic: boolean;
  cardCount: number;
  createdAt: string;
}

const TABLE = 'decks';

export const DeckService = {
  createDeck: async (ownerId: string, deck: Partial<Deck>): Promise<string> => {
    const payload = toDbDeck({ ...deck, ownerId });
    const { data, error } = await supabase
      .from(TABLE)
      .insert(payload)
      .select('id')
      .single();
    if (error) throw error;
    return data.id as string;
  },

  getUserDecks: async (ownerId: string): Promise<Deck[]> => {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(fromDbDeck);
  },

  getDeck: async (deckId: string): Promise<Deck | null> => {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', deckId)
      .maybeSingle();
    if (error) throw error;
    return data ? fromDbDeck(data) : null;
  },

  updateDeck: async (deckId: string, patch: Partial<Deck>): Promise<void> => {
    const payload: Record<string, unknown> = {};
    if (patch.title !== undefined) payload.title = patch.title;
    if (patch.category !== undefined) payload.category = patch.category;
    if (patch.tags !== undefined) payload.tags = patch.tags;
    if (patch.isPublic !== undefined) payload.is_public = patch.isPublic;
    if (patch.ownerName !== undefined) payload.owner_name = patch.ownerName;
    const { error } = await supabase.from(TABLE).update(payload).eq('id', deckId);
    if (error) throw error;
  },

  deleteDeck: async (deckId: string): Promise<void> => {
    const { data: cardRows } = await supabase
      .from('cards')
      .select('front, back, front_audio, back_audio')
      .eq('deck_id', deckId);
    const refs = (cardRows ?? []).flatMap((row) =>
      collectCardMediaRefs({
        front: row.front,
        back: row.back,
        frontAudio: row.front_audio,
        backAudio: row.back_audio,
      })
    );
    if (refs.length > 0) {
      try {
        await MediaStorageService.deleteMany(refs);
      } catch (err) {
        console.error('Failed to delete deck media', err);
      }
    }
    const { error } = await supabase.from(TABLE).delete().eq('id', deckId);
    if (error) throw error;
  },

  getPublicDecks: async (): Promise<Deck[]> => {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(fromDbDeck);
  },
};
