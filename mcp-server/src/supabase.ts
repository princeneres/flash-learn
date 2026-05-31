import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Builds a Supabase client that acts AS THE AUTHENTICATED USER.
 *
 * We deliberately use the public anon key + the user's access token (never the
 * service role key). This means every query runs under `auth.uid()`, so all the
 * Row Level Security policies and the plan-quota triggers
 * (`enforce_deck_quota`, `enforce_card_quota`) that the web app relies on are
 * applied automatically — there is no second copy of the validation logic to
 * keep in sync.
 */

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const refreshToken = process.env.SUPABASE_REFRESH_TOKEN ?? '';

let cached: { client: SupabaseClient; userId: string } | null = null;

function assertEnv(): { url: string; anonKey: string; accessToken: string } {
  const missing: string[] = [];
  if (!url) missing.push('SUPABASE_URL');
  if (!anonKey) missing.push('SUPABASE_ANON_KEY');
  if (!accessToken) missing.push('SUPABASE_ACCESS_TOKEN');
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        'Configure them in your MCP client config (see mcp-server/README.md).',
    );
  }
  return { url: url!, anonKey: anonKey!, accessToken: accessToken! };
}

/**
 * Returns a client scoped to the user and the resolved user id. Memoized so we
 * only validate the session once per process.
 */
export async function getUserClient(): Promise<{ client: SupabaseClient; userId: string }> {
  if (cached) return cached;
  const env = assertEnv();

  const client = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false },
  });

  const { error: sessionError } = await client.auth.setSession({
    access_token: env.accessToken,
    refresh_token: refreshToken,
  });
  if (sessionError) {
    throw new Error(
      `Failed to establish a Supabase session from SUPABASE_ACCESS_TOKEN: ${sessionError.message}. ` +
        'The token may be expired — grab a fresh one (see README).',
    );
  }

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new Error(
      `Could not resolve the authenticated user: ${error?.message ?? 'no user in session'}.`,
    );
  }

  cached = { client, userId: data.user.id };
  return cached;
}
