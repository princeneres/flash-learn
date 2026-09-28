// Creates an AbacatePay recurring subscription checkout for the Pro plan. Plan pricing
// and product IDs are resolved SERVER-SIDE from a fixed map (with env overrides) — the
// client only sends a planId ('pro_monthly' | 'pro_annual'), never a price. The product
// must be configured in the AbacatePay dashboard with a billing cycle (MONTHLY/ANNUALLY).
// externalId/metadata carry the user id so the webhook can activate the right user.
//
// Recurring billing requires CARD (PIX is not auto-recurring on AbacatePay), so methods
// is forced to ["CARD"]. PIX stays for one-off credit packs in buy-credits.
//
// Env:
//   ABACATEPAY_API_KEY   - AbacatePay API key
//   APP_URL              - public base URL of the app (for return/completion URLs)
//   ABACATE_PRODUCT_PRO_MONTHLY / _PRO_ANNUAL - product IDs (optional overrides)

import { getUser, json, readJson, sql } from './_lib/server.js';

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
    productId: process.env.ABACATE_PRODUCT_PRO_MONTHLY ?? 'prod_pro_monthly',
    planId: 'pro',
    grantCredits: 30,
  },
  pro_annual: {
    productId: process.env.ABACATE_PRODUCT_PRO_ANNUAL ?? 'prod_pro_annual',
    planId: 'pro',
    grantCredits: 30,
  },
};

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const body = await readJson<{ planId?: string }>(req);
  if (!body) return json({ error: 'Invalid JSON' }, 400);

  const plan = body.planId ? PLANS[body.planId] : undefined;
  if (!plan) return json({ error: 'Unknown plan' }, 400);

  const abacateKey = process.env.ABACATEPAY_API_KEY;
  if (!abacateKey) {
    console.error('ABACATEPAY_API_KEY not set');
    return json({ error: 'Payments not configured' }, 500);
  }

  const appUrl = (process.env.APP_URL ?? 'http://localhost:5173').replace(/\/+$/, '');
  const [profile] = (await sql`
    select display_name, email from public.profiles where id = ${user.id}
  `) as Array<{ display_name: string | null; email: string | null }>;

  // /subscriptions/create reuses the same params as /checkouts/create.
  const checkoutBody = {
    items: [{ id: plan.productId, quantity: 1 }],
    methods: ['CARD'],
    customer: {
      name: profile?.display_name || user.email?.split('@')[0] || 'Flash Learn user',
      email: profile?.email || user.email || 'user@example.com',
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
}
