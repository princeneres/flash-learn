// Client for AI credits: reading the balance, listing purchase history, and
// starting an AbacatePay checkout. All mutations happen server-side.

import { supabase } from '../lib/supabase';

export type CreditPackId = 'starter' | 'popular' | 'pro';

export interface CreditPack {
  id: CreditPackId;
  credits: number;
  priceCents: number;
}

// Display-only catalogue; the authoritative pricing lives in the buy-credits
// edge function (the client never sends a price).
export const CREDIT_PACKS: CreditPack[] = [
  { id: 'starter', credits: 10, priceCents: 990 },
  { id: 'popular', credits: 50, priceCents: 2990 },
  { id: 'pro', credits: 200, priceCents: 7990 },
];

export interface LedgerEntry {
  id: string;
  delta: number;
  reason: string;
  created_at: string;
}

export const AiCreditService = {
  getBalance: async (): Promise<number> => {
    const { data, error } = await supabase.rpc('get_ai_credits');
    if (error) throw error;
    return typeof data === 'number' ? data : 0;
  },

  getHistory: async (limit = 20): Promise<LedgerEntry[]> => {
    const { data, error } = await supabase
      .from('ai_credit_ledger')
      .select('id, delta, reason, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as LedgerEntry[];
  },

  // Creates a checkout and returns the hosted payment URL.
  startCheckout: async (packId: CreditPackId): Promise<string> => {
    const { data, error } = await supabase.functions.invoke('buy-credits', {
      body: { packId },
    });
    if (error) throw error;
    const url = (data as { url?: string } | null)?.url;
    if (!url) throw new Error('No checkout URL returned');
    return url;
  },
};
