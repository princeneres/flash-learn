import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { loadSession, saveSession, SESSION_FILE } from './session.js';

// supabase-js initializes a realtime client that warns (to stdout) when Node
// has no global WebSocket — which would corrupt the MCP stdio channel. We don't
// use realtime, but providing a global WebSocket silences the warning cleanly.
if (!(globalThis as { WebSocket?: unknown }).WebSocket) {
  (globalThis as { WebSocket?: unknown }).WebSocket = WebSocket;
}

/**
 * Builds a Supabase client that acts AS THE AUTHENTICATED USER.
 *
 * We deliberately use the public anon key + the user's session (never the
 * service role key). This means every query runs under `auth.uid()`, so all the
 * Row Level Security policies and the plan-quota triggers
 * (`enforce_deck_quota`, `enforce_card_quota`) that the web app relies on are
 * applied automatically — there is no second copy of the validation logic to
 * keep in sync.
 *
 * The session comes from `~/.flash-learn-mcp/session.json`, written by the
 * `login` command (browser flow), or from env vars as a fallback. When Supabase
 * refreshes the access token we persist it back so the login lasts.
 */

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;

let cached: { client: SupabaseClient; userId: string } | null = null;

function assertEnv(): { url: string; anonKey: string } {
  const missing: string[] = [];
  if (!url) missing.push('SUPABASE_URL');
  if (!anonKey) missing.push('SUPABASE_ANON_KEY');
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        'Configure them in your MCP client config (see mcp-server/README.md).',
    );
  }
  return { url: url!, anonKey: anonKey! };
}

/** Creates a client from the given URL/anon key (used by login + tools). */
export function makeClient(supabaseUrl: string, supabaseAnonKey: string): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false },
  });
}

/**
 * Returns a client scoped to the user and the resolved user id. Memoized so we
 * only validate the session once per process.
 */
export async function getUserClient(): Promise<{ client: SupabaseClient; userId: string }> {
  if (cached) return cached;
  const env = assertEnv();

  const session = loadSession();
  if (!session) {
    throw new Error(
      `Não há sessão salva. Rode "npx flash-learn-mcp login" para conectar sua conta ` +
        `(ou defina SUPABASE_ACCESS_TOKEN). Arquivo esperado: ${SESSION_FILE}.`,
    );
  }

  const client = makeClient(env.url, env.anonKey);

  // Persist refreshed tokens so the login survives access-token expiry.
  client.auth.onAuthStateChange((_event, s) => {
    if (s?.access_token) {
      saveSession({ access_token: s.access_token, refresh_token: s.refresh_token ?? '' });
    }
  });

  const { error: sessionError } = await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (sessionError) {
    throw new Error(
      `Sessão inválida ou expirada: ${sessionError.message}. ` +
        `Rode "npx flash-learn-mcp login" novamente.`,
    );
  }

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new Error(
      `Não foi possível resolver o usuário autenticado: ${error?.message ?? 'sem usuário na sessão'}.`,
    );
  }

  cached = { client, userId: data.user.id };
  return cached;
}
