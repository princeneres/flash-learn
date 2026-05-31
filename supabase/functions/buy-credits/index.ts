// Edge Function: buy-credits
//
// Creates an AbacatePay PIX checkout for a credit pack. Pack pricing and product
// IDs are resolved SERVER-SIDE from a fixed map (with env overrides) — the client
// only sends a packId, never a price or credit amount. A pending order row is
// created and linked to the checkout via externalId/metadata so the webhook can
// credit the right user.
//
// Required secrets:
//   ABACATEPAY_API_KEY   - AbacatePay API key
//   APP_URL              - public base URL of the app (for return/completion URLs)
//   ABACATE_PRODUCT_STARTER / _POPULAR / _PRO  - product IDs (optional overrides)
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

interface Pack {
  productId: string;
  credits: number;
  amountCents: number;
}

// Source of truth for what each pack costs and grants. Product IDs default to the
// ones provisioned in the AbacatePay dashboard, overridable via secrets.
const PACKS: Record<string, Pack> = {
  starter: {
    productId: Deno.env.get('ABACATE_PRODUCT_STARTER') ?? 'prod_WycCRY4qmkrXQJ1gcc0qQCNK',
    credits: 10,
    amountCents: 990,
  },
  popular: {
    productId: Deno.env.get('ABACATE_PRODUCT_POPULAR') ?? 'prod_tjuputS3Y4NKZBtGZy3TUG3a',
    credits: 50,
    amountCents: 2990,
  },
  pro: {
    productId: Deno.env.get('ABACATE_PRODUCT_PRO') ?? 'prod_PYWAcTS1tNdzPwaa0a2SKzZY',
    credits: 200,
    amountCents: 7990,
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

  let body: { packId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const pack = body.packId ? PACKS[body.packId] : undefined;
  if (!pack) return json({ error: 'Unknown pack' }, 400);

  const abacateKey = Deno.env.get('ABACATEPAY_API_KEY');
  if (!abacateKey) {
    console.error('ABACATEPAY_API_KEY not set');
    return json({ error: 'Payments not configured' }, 500);
  }

  // Create the pending order first so we have a stable externalId for tracing.
  const { data: order, error: orderErr } = await admin
    .from('ai_credit_orders')
    .insert({
      user_id: user.id,
      pack_id: body.packId,
      credits: pack.credits,
      amount_cents: pack.amountCents,
      status: 'pending',
    })
    .select('id')
    .single();
  if (orderErr || !order) {
    console.error('order insert failed', orderErr);
    return json({ error: 'Could not create order' }, 500);
  }

  const appUrl = (Deno.env.get('APP_URL') ?? 'http://localhost:5173').replace(/\/+$/, '');
  const profile = await admin
    .from('profiles')
    .select('display_name, email')
    .eq('id', user.id)
    .maybeSingle();

  const checkoutBody = {
    items: [{ id: pack.productId, quantity: 1 }],
    customer: {
      name: profile.data?.display_name || user.email?.split('@')[0] || 'Flash Learn user',
      email: profile.data?.email || user.email || 'user@example.com',
    },
    externalId: order.id,
    metadata: { user_id: user.id, credits: pack.credits, order_id: order.id },
    returnUrl: `${appUrl}/profile`,
    completionUrl: `${appUrl}/profile?credits=success`,
  };

  const res = await fetch(`${ABACATE_BASE}/checkouts/create`, {
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
    console.error('checkout create failed', res.status, payload.error);
    return json({ error: 'Could not create checkout' }, 502);
  }

  // Record the AbacatePay checkout id on the order for later reconciliation.
  if (payload.data.id) {
    await admin.from('ai_credit_orders').update({ abacate_id: payload.data.id }).eq('id', order.id);
  }

  return json({ url: payload.data.url });
});
