// Edge Function: abacate-webhook
//
// Receives AbacatePay webhooks (configured with verify_jwt = false — AbacatePay
// does not send a Supabase JWT). Security is layered:
//   1. ?webhookSecret= query param must match the configured secret (primary gate)
//   2. x-webhook-timestamp must be within 5 minutes (anti-replay)
//   3. x-webhook-signature HMAC-SHA256 — verified ONLY if ABACATEPAY_SIGNING_KEY is set
//      (AbacatePay signs with its own key, not our webhookSecret; opt-in to avoid
//      rejecting legitimate events when the right key isn't configured)
// On `billing.paid` we credit the buyer idempotently (credit_ai is a no-op if the
// payment id was already recorded) and mark the order paid.
//
// Required secrets:
//   ABACATEPAY_WEBHOOK_SECRET - shared secret from the AbacatePay dashboard
//   ABACATEPAY_SIGNING_KEY     - (optional) AbacatePay signing key to enable HMAC check
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const constantTimeEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
};

const b64ToBytes = (s: string): Uint8Array => {
  try {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return new Uint8Array(0);
  }
};

const hmacSha256 = async (secret: string, message: string): Promise<Uint8Array> => {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return new Uint8Array(sig);
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const secret = Deno.env.get('ABACATEPAY_WEBHOOK_SECRET');
  if (!secret) {
    console.error('ABACATEPAY_WEBHOOK_SECRET not set');
    return json({ error: 'Not configured' }, 500);
  }

  const url = new URL(req.url);
  if (url.searchParams.get('webhookSecret') !== secret) {
    return json({ error: 'Invalid secret' }, 401);
  }

  const timestamp = req.headers.get('x-webhook-timestamp');
  if (timestamp) {
    const skew = Math.abs(Date.now() / 1000 - parseInt(timestamp, 10));
    if (!Number.isFinite(skew) || skew > 300) return json({ error: 'Stale timestamp' }, 401);
  }

  // Raw body is required for signature verification.
  const rawBody = await req.text();

  // HMAC verification is OPT-IN. AbacatePay signs X-Webhook-Signature with its own key
  // (NOT our webhookSecret), so validating against the wrong key would reject legitimate
  // events. Enable it only once the correct signing key is configured via
  // ABACATEPAY_SIGNING_KEY; until then the ?webhookSecret= query param is the auth gate.
  const signingKey = Deno.env.get('ABACATEPAY_SIGNING_KEY');
  const signature = req.headers.get('x-webhook-signature');
  if (signingKey && signature) {
    const expected = await hmacSha256(signingKey, rawBody);
    if (!constantTimeEqual(b64ToBytes(signature), expected)) {
      return json({ error: 'Invalid signature' }, 401);
    }
  }

  let event: {
    event?: string;
    id?: string;
    data?: {
      id?: string;
      currentPeriodEnd?: string;
      nextBilling?: string;
      billing?: {
        id?: string;
        externalId?: string;
        metadata?: Record<string, unknown>;
      };
      subscription?: {
        id?: string;
        currentPeriodEnd?: string;
        nextBilling?: string;
        externalId?: string;
        metadata?: Record<string, unknown>;
      };
      metadata?: Record<string, unknown>;
      externalId?: string;
    };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // One-off credit purchases. v2 may name this checkout.completed; older flows used
  // billing.paid — accept both so the credits flow can't silently miss the event.
  if (event.event === 'billing.paid' || event.event === 'checkout.completed') {
    const billing = event.data?.billing ?? event.data;
    const metadata = event.data?.billing?.metadata ?? event.data?.metadata ?? {};
    const userId = typeof metadata.user_id === 'string' ? metadata.user_id : undefined;
    const credits =
      typeof metadata.credits === 'number' ? metadata.credits : Number(metadata.credits);
    const orderId =
      (typeof metadata.order_id === 'string' && metadata.order_id) ||
      event.data?.billing?.externalId ||
      event.data?.externalId;
    // Stable id for idempotency: prefer the payment/billing id, fall back to event id.
    const paymentId = billing?.id ?? event.id;

    if (!userId || !credits || !paymentId) {
      console.error('credit event missing fields', { userId, credits, paymentId });
      return json({ error: 'Missing metadata' }, 400);
    }

    const { error: creditErr } = await admin.rpc('credit_ai', {
      p_user: userId,
      p_amount: credits,
      p_reason: 'purchase',
      p_abacate_id: `billing:${paymentId}`,
    });
    if (creditErr) {
      console.error('credit failed', creditErr);
      return json({ error: 'Credit failed' }, 500); // 500 → AbacatePay retries.
    }

    if (orderId) {
      await admin.from('ai_credit_orders').update({ status: 'paid' }).eq('id', orderId);
    }
    return json({ received: true });
  }

  // Subscription activation and recurring renewals — grant/extend the Pro plan and the
  // included monthly credits, both idempotent.
  if (event.event === 'subscription.completed' || event.event === 'subscription.renewed') {
    const sub = event.data?.subscription ?? event.data;
    const metadata = event.data?.subscription?.metadata ?? event.data?.metadata ?? {};
    const userId =
      (typeof metadata.user_id === 'string' && metadata.user_id) ||
      event.data?.subscription?.externalId ||
      event.data?.externalId;
    const planId = typeof metadata.plan_id === 'string' ? metadata.plan_id : 'pro';
    const grantCredits =
      typeof metadata.grant_credits === 'number'
        ? metadata.grant_credits
        : Number(metadata.grant_credits) || 0;
    const subscriptionId = sub?.id ?? event.id;
    const periodEnd = sub?.currentPeriodEnd ?? sub?.nextBilling ?? null;

    if (!userId || !subscriptionId) {
      console.error('subscription event missing fields', { userId, subscriptionId });
      return json({ error: 'Missing metadata' }, 400);
    }
    if (!periodEnd) {
      // Non-fatal: log so we can inspect the real payload and map the field correctly.
      console.warn('subscription event without period end', event.event, subscriptionId);
    }

    const { error: subErr } = await admin.rpc('apply_subscription', {
      p_user: userId,
      p_plan: planId,
      p_status: 'active',
      p_period_end: periodEnd,
      p_abacate_id: subscriptionId,
    });
    if (subErr) {
      console.error('apply_subscription failed', subErr);
      return json({ error: 'Subscription apply failed' }, 500);
    }

    if (grantCredits > 0) {
      // Idempotent per (subscription, period): renewals grant fresh credits, retries don't.
      const { error: creditErr } = await admin.rpc('credit_ai', {
        p_user: userId,
        p_amount: grantCredits,
        p_reason: 'subscription',
        p_abacate_id: `sub:${subscriptionId}:${periodEnd ?? event.id}`,
      });
      if (creditErr) {
        console.error('subscription credit failed', creditErr);
        return json({ error: 'Credit failed' }, 500);
      }
    }
    return json({ received: true });
  }

  // Cancellation — keep access until current_period_end; just flip the status flag.
  if (event.event === 'subscription.cancelled') {
    const metadata = event.data?.subscription?.metadata ?? event.data?.metadata ?? {};
    const userId =
      (typeof metadata.user_id === 'string' && metadata.user_id) ||
      event.data?.subscription?.externalId ||
      event.data?.externalId;
    if (userId) {
      const { error } = await admin.rpc('cancel_subscription', { p_user: userId });
      if (error) {
        console.error('cancel_subscription failed', error);
        return json({ error: 'Cancel failed' }, 500);
      }
    }
    return json({ received: true });
  }

  // Acknowledge other events so AbacatePay doesn't retry them.
  return json({ received: true });
});
