// Edge Function: create-subscription
//
// Creates an AbacatePay recurring subscription checkout for the Pro plan. Plan pricing
// and product IDs are resolved SERVER-SIDE from a fixed map (with env overrides) — the
// client only sends a planId ('pro_monthly' | 'pro_annual'), never a price. The product
// must be configured in the AbacatePay dashboard with a billing cycle (MONTHLY/ANNUALLY).
// externalId/metadata carry the user id so the webhook can activate the right user.
//
// Recurring billing requires CARD (PIX is not auto-recurring on AbacatePay), so methods
// is forced to ["CARD"]. PIX stays for one-off credit packs in buy-credits.
//
// Required secrets:
//   ABACATEPAY_API_KEY   - AbacatePay API key
//   APP_URL              - public base URL of the app (for return/completion URLs)
//   ABACATE_PRODUCT_PRO_MONTHLY / _PRO_ANNUAL - product IDs (optional overrides)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

const ABACATE_BASE = 'https://api.abacatepay.com/v2';

interface SubPlan {
  productId: string;
  planId: string; // plans.id granted on payment
  grantCredits: number; // monthly bonus credits included with Pro
}

// Source of truth for what each subscription plan grants. Product IDs default to the
// ones provisioned in the AbacatePay dashboard (with a billing cycle), overridable via
// secrets. Both map to the same 'pro' plan row; only the billing cadence differs.
const PLANS: Record<string, SubPlan> = {
  pro_monthly: {
    productId: Deno.env.get('ABACATE_PRODUCT_PRO_MONTHLY') ?? 'prod_pro_monthly',
    planId: 'pro',
    grantCredits: 30,
  },
  pro_annual: {
    productId: Deno.env.get('ABACATE_PRODUCT_PRO_ANNUAL') ?? 'prod_pro_annual',
    planId: 'pro',
    grantCredits: 30,
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  const token = authHeader.replace('Bearer ', '');
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401);
  const user = userData.user;

  let body: { planId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const plan = body.planId ? PLANS[body.planId] : undefined;
  if (!plan) return json({ error: 'Unknown plan' }, 400);

  const abacateKey = Deno.env.get('ABACATEPAY_API_KEY');
  if (!abacateKey) {
    console.error('ABACATEPAY_API_KEY not set');
    return json({ error: 'Payments not configured' }, 500);
  }

  const appUrl = (Deno.env.get('APP_URL') ?? 'http://localhost:5173').replace(/\/+$/, '');
  const profile = await admin
    .from('profiles')
    .select('display_name, email')
    .eq('id', user.id)
    .maybeSingle();

  // /subscriptions/create reuses the same params as /checkouts/create.
  const checkoutBody = {
    items: [{ id: plan.productId, quantity: 1 }],
    methods: ['CARD'],
    customer: {
      name: profile.data?.display_name || user.email?.split('@')[0] || 'Flash Learn user',
      email: profile.data?.email || user.email || 'user@example.com',
    },
    externalId: user.id,
    metadata: {
      user_id: user.id,
      plan_id: plan.planId,
      grant_credits: plan.grantCredits,
    },
    returnUrl: `${appUrl}/profile`,
    completionUrl: `${appUrl}/profile?plan=success`,
  };

  const res = await fetch(`${ABACATE_BASE}/subscriptions/create`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${abacateKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(checkoutBody),
  });
  const payload = (await res.json()) as {
    success?: boolean;
    data?: { id?: string; url?: string };
    error?: string;
  };
  if (!res.ok || !payload.success || !payload.data?.url) {
    console.error('subscription create failed', res.status, payload.error);
    return json({ error: 'Could not create subscription' }, 502);
  }

  return json({ url: payload.data.url });
});
