// Edge Function: feature-suggestion
//
// Receives a feature suggestion from an authenticated user, enriches it with
// trusted server-side context (plan/premium status, points, streak, etc.),
// stores it in `public.feature_suggestions`, and emails it to the developer
// via Resend.
//
// Required secrets (set with `supabase secrets set ...`):
//   RESEND_API_KEY        - Resend API key
//   SUGGESTIONS_TO_EMAIL  - destination inbox (defaults to the contact email)
//   SUGGESTIONS_FROM_EMAIL- verified Resend sender (e.g. noreply@yourdomain)
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

const MAX_MESSAGE = 4000;
const ALLOWED_CATEGORIES = ['general', 'feature', 'bug', 'improvement', 'other'];

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Identify the user from the verified JWT — never trust client-sent identity.
  const authClient = createClient(supabaseUrl, serviceKey);
  const token = authHeader.replace('Bearer ', '');
  const { data: userData, error: userErr } = await authClient.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401);
  const user = userData.user;

  let body: { message?: string; category?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const message = (body.message ?? '').trim();
  if (!message) return json({ error: 'Message is required' }, 400);
  if (message.length > MAX_MESSAGE) return json({ error: 'Message too long' }, 400);
  const category = ALLOWED_CATEGORIES.includes(body.category ?? '')
    ? (body.category as string)
    : 'general';

  // Service-role client to read enrichment data and insert the row.
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: profile } = await admin
    .from('profiles')
    .select('display_name, email, points, streak, total_reviews, language, created_at')
    .eq('id', user.id)
    .maybeSingle();

  let plan: { id?: string; name?: string } = {};
  try {
    const { data: planData } = await admin.rpc('get_user_plan', { uid: user.id });
    if (planData) plan = planData as { id?: string; name?: string };
  } catch (_) {
    // Plan lookup is best-effort; never block a suggestion on it.
  }

  const planName = plan?.name ?? 'free';
  const isPremium = !!plan?.id && plan.id !== 'free';
  const displayName =
    profile?.display_name ||
    (user.user_metadata?.full_name as string | undefined) ||
    user.email?.split('@')[0] ||
    'Unknown';

  const context = {
    userId: user.id,
    email: profile?.email ?? user.email ?? null,
    displayName,
    plan: { id: plan?.id ?? null, name: planName, isPremium },
    points: profile?.points ?? null,
    streak: profile?.streak ?? null,
    totalReviews: profile?.total_reviews ?? null,
    language: profile?.language ?? null,
    accountCreatedAt: profile?.created_at ?? user.created_at ?? null,
    userAgent: req.headers.get('user-agent') ?? null,
  };

  const { error: insertErr } = await admin.from('feature_suggestions').insert({
    user_id: user.id,
    category,
    message,
    context,
  });
  if (insertErr) {
    console.error('Insert failed', insertErr);
    return json({ error: 'Could not save suggestion' }, 500);
  }

  // Email is best-effort: the suggestion is already persisted above.
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const toEmail = Deno.env.get('SUGGESTIONS_TO_EMAIL') ?? 'prince.neres@simplifytec.com.br';
  const fromEmail = Deno.env.get('SUGGESTIONS_FROM_EMAIL') ?? 'Flash Learn <onboarding@resend.dev>';

  if (resendKey) {
    const html = `
      <h2>New feature suggestion</h2>
      <p><strong>Category:</strong> ${escapeHtml(category)}</p>
      <table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
        <tr><td><strong>User</strong></td><td>${escapeHtml(displayName)}</td></tr>
        <tr><td><strong>Email</strong></td><td>${escapeHtml(context.email ?? '—')}</td></tr>
        <tr><td><strong>Plan</strong></td><td>${escapeHtml(planName)} ${isPremium ? '⭐ (premium)' : ''}</td></tr>
        <tr><td><strong>Points</strong></td><td>${context.points ?? '—'}</td></tr>
        <tr><td><strong>Streak</strong></td><td>${context.streak ?? '—'}</td></tr>
        <tr><td><strong>Total reviews</strong></td><td>${context.totalReviews ?? '—'}</td></tr>
        <tr><td><strong>Language</strong></td><td>${escapeHtml(context.language ?? '—')}</td></tr>
        <tr><td><strong>User ID</strong></td><td>${escapeHtml(context.userId)}</td></tr>
      </table>
      <h3>Message</h3>
      <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
    `;
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [toEmail],
          reply_to: context.email ?? undefined,
          subject: `[Flash Learn] ${category} suggestion from ${displayName}`,
          html,
        }),
      });
      if (!res.ok) console.error('Resend failed', res.status, await res.text());
    } catch (e) {
      console.error('Email send error', e);
    }
  } else {
    console.warn('RESEND_API_KEY not set — suggestion stored but email not sent.');
  }

  return json({ ok: true });
});
