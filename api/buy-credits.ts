// Creates an AbacatePay PIX checkout for a credit pack. Pack pricing and product
// IDs are resolved SERVER-SIDE from a fixed map (with env overrides) — the client
// only sends a packId, never a price or credit amount. A pending order row is
// created and linked to the checkout via externalId/metadata so the webhook can
// credit the right user.
//
// Env:
//   ABACATEPAY_API_KEY   - AbacatePay API key
//   APP_URL              - public base URL of the app (for return/completion URLs)
//   ABACATE_PRODUCT_STARTER / _POPULAR / _PRO  - product IDs (optional overrides)

import { getUser, json, readJson, sql } from './_lib/server.js';

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
    productId: process.env.ABACATE_PRODUCT_STARTER ?? 'prod_WycCRY4qmkrXQJ1gcc0qQCNK',
    credits: 10,
    amountCents: 990,
  },
  popular: {
    productId: process.env.ABACATE_PRODUCT_POPULAR ?? 'prod_tjuputS3Y4NKZBtGZy3TUG3a',
    credits: 50,
    amountCents: 2990,
  },
  pro: {
    productId: process.env.ABACATE_PRODUCT_PRO ?? 'prod_PYWAcTS1tNdzPwaa0a2SKzZY',
    credits: 200,
    amountCents: 7990,
  },
};

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const body = await readJson<{ packId?: string }>(req);
  if (!body) return json({ error: 'Invalid JSON' }, 400);

  const pack = body.packId ? PACKS[body.packId] : undefined;
  if (!pack) return json({ error: 'Unknown pack' }, 400);

  const abacateKey = process.env.ABACATEPAY_API_KEY;
  if (!abacateKey) {
    console.error('ABACATEPAY_API_KEY not set');
    return json({ error: 'Payments not configured' }, 500);
  }

  // Create the pending order first so we have a stable externalId for tracing.
  let order: { id: string };
  try {
    [order] = (await sql`
      insert into public.ai_credit_orders (user_id, pack_id, credits, amount_cents, status)
      values (${user.id}, ${body.packId}, ${pack.credits}, ${pack.amountCents}, 'pending')
      returning id
    `) as Array<{ id: string }>;
  } catch (err) {
    console.error('order insert failed', err);
    return json({ error: 'Could not create order' }, 500);
  }

  const appUrl = (process.env.APP_URL ?? 'http://localhost:5173').replace(/\/+$/, '');
  const [profile] = (await sql`
    select display_name, email from public.profiles where id = ${user.id}
  `) as Array<{ display_name: string | null; email: string | null }>;

  const checkoutBody = {
    items: [{ id: pack.productId, quantity: 1 }],
    customer: {
      name: profile?.display_name || user.email?.split('@')[0] || 'Flash Learn user',
      email: profile?.email || user.email || 'user@example.com',
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
    await sql`update public.ai_credit_orders set abacate_id = ${payload.data.id} where id = ${order.id}`;
  }

  return json({ url: payload.data.url });
}
