// Client for AI credits: reading the balance. Credits are spent server-side by
// the ai-generate edge function; the client only reads the current balance.

import { neon } from '../lib/neon';

export const AiCreditService = {
  getBalance: async (): Promise<number> => {
    const { data, error } = await neon.rpc('get_ai_credits');
    if (error) throw error;
    return typeof data === 'number' ? data : 0;
  },
};
