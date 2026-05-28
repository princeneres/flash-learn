import { supabase } from '../lib/supabase';

export interface PlanLimits {
  plan: {
    id: string;
    name: string;
    maxDecks: number;
    maxTotalCards: number;
    maxCardsPerDeck: number;
    maxMediaBytes: number;
    features: Record<string, unknown>;
  };
  usage: {
    decks: number;
    totalCards: number;
  };
}

export const PlanService = {
  getLimits: async (): Promise<PlanLimits | null> => {
    const { data, error } = await supabase.rpc('get_my_limits');
    if (error) throw error;
    if (!data) return null;
    return data as PlanLimits;
  },
};
