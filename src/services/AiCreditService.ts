// Client for AI credits: reading the balance. Credits are spent server-side by
// the ai-generate edge function; the client only reads the current balance.

import { supabase } from '../lib/supabase';

export const AiCreditService = {
  getBalance: async (): Promise<number> => {
    const { data, error } = await supabase.rpc('get_ai_credits');
    if (error) throw error;
    return typeof data === 'number' ? data : 0;
  },
};
