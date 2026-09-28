// Receives a feature suggestion from an authenticated user, enriches it with
// trusted server-side context (plan/premium status, points, streak, etc.),
// stores it in `public.feature_suggestions`, and emails it to the developer
// via Resend.
//
// Env:
//   RESEND_API_KEY         - Resend API key
//   SUGGESTIONS_TO_EMAIL   - destination inbox (defaults to the contact email)
//   SUGGESTIONS_FROM_EMAIL - verified Resend sender (e.g. noreply@yourdomain)

import { getUser, json, readJson, sql } from './_lib/server.js';

const MAX_MESSAGE = 4000;
const ALLOWED_CATEGORIES = ['general', 'feature', 'bug', 'improvement', 'other'];

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );

interface Profile {
  display_name: string | null;
  email: string | null;
  points: number | null;
  streak: number | null;
  total_reviews: number | null;
  language: string | null;
  created_at: string | null;
}

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const body = await readJson<{ message?: string; category?: string }>(req);
  if (!body) return json({ error: 'Invalid JSON' }, 400);

  const message = (body.message ?? '').trim();
  if (!message) return json({ error: 'Message is required' }, 400);
  if (message.length > MAX_MESSAGE) return json({ error: 'Message too long' }, 400);
  const category = ALLOWED_CATEGORIES.includes(body.category ?? '')
    ? (body.category as string)
    : 'general';

  const [profile] = (await sql`
    select display_name, email, points, streak, total_reviews, language, created_at
    from public.profiles where id = ${user.id}
  `) as Profile[];

  let plan: { id?: string; name?: string } = {};
  try {
    const [row] = await sql`select id, name from public.get_user_plan(${user.id})`;
    if (row) plan = row as { id?: string; name?: string };
  } catch {
    // Plan lookup is best-effort; never block a suggestion on it.
  }

  const planName = plan?.name ?? 'free';
  const isPremium = !!plan?.id && plan.id !== 'free';
  const email = profile?.email ?? user.email;
  const displayName = profile?.display_name || email?.split('@')[0] || 'Unknown';

  const context = {
    userId: user.id,
    email,
    displayName,
    plan: { id: plan?.id ?? null, name: planName, isPremium },
    points: profile?.points ?? null,
    streak: profile?.streak ?? null,
    totalReviews: profile?.total_reviews ?? null,
    language: profile?.language ?? null,
    accountCreatedAt: profile?.created_at ?? null,
    userAgent: req.headers.get('user-agent') ?? null,
  };

  try {
    await sql`
      insert into public.feature_suggestions (user_id, category, message, context)
      values (${user.id}, ${category}, ${message}, ${JSON.stringify(context)}::jsonb)
    `;
  } catch (err) {
    console.error('Insert failed', err);
    return json({ error: 'Could not save suggestion' }, 500);
  }

  // Email is best-effort: the suggestion is already persisted above.
  const resendKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.SUGGESTIONS_TO_EMAIL ?? 'prince.neres@simplifytec.com.br';
  const fromEmail = process.env.SUGGESTIONS_FROM_EMAIL ?? 'Flash Learn <onboarding@resend.dev>';

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
}
