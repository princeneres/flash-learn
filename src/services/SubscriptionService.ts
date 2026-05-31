// Client for the Pro subscription: reading state and starting an AbacatePay recurring
// checkout. All mutations happen server-side (create-subscription / abacate-webhook).

import { supabase } from '../lib/supabase';

export type SubscriptionPlanId = 'pro_monthly' | 'pro_annual';

export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  priceCents: number;
  includedCredits: number;
}

// Display-only catalogue; authoritative pricing/product mapping lives in the
// create-subscription edge function (the client never sends a price).
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  { id: 'pro_monthly', priceCents: 1990, includedCredits: 30 },
  { id: 'pro_annual', priceCents: 19900, includedCredits: 30 },
];

export interface SubscriptionState {
  plan_id: string;
  status: 'active' | 'past_due' | 'canceled';
  current_period_end: string | null;
}

export const SubscriptionService = {
  getState: async (): Promise<SubscriptionState | null> => {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('plan_id, status, current_period_end')
      .maybeSingle();
    if (error) throw error;
    return (data as SubscriptionState | null) ?? null;
  },

  // Creates a recurring checkout and returns the hosted payment URL.
  startCheckout: async (planId: SubscriptionPlanId): Promise<string> => {
    const { data, error } = await supabase.functions.invoke('create-subscription', {
      body: { planId },
    });
    if (error) throw error;
    const url = (data as { url?: string } | null)?.url;
    if (!url) throw new Error('No checkout URL returned');
    return url;
  },
};
