import { createClient, SupabaseAuthAdapter } from '@neondatabase/neon-js';

const authUrl = import.meta.env.VITE_NEON_AUTH_URL;
const dataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL;

if (!authUrl || !dataApiUrl) {
  console.error('Missing VITE_NEON_AUTH_URL or VITE_NEON_DATA_API_URL environment variables.');
}

// Neon Auth (Better Auth) behind the Supabase-compatible adapter, so `neon.auth`
// keeps the supabase-js call shapes; `neon.from()` / `neon.rpc()` hit the Data API
// (PostgREST) with the session JWT injected, so RLS sees auth.uid().
export const neon = createClient({
  auth: {
    adapter: SupabaseAuthAdapter(),
    url: authUrl ?? '',
  },
  dataApi: {
    url: dataApiUrl ?? '',
  },
});

/** Better Auth client, for flows the Supabase adapter doesn't cover (password reset). */
export const betterAuth = neon.auth.getBetterAuthInstance();

/** Current session JWT, for calls to our own /api functions. */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await neon.auth.getSession();
  return data.session?.access_token ?? null;
}

type SessionResult = Awaited<ReturnType<typeof neon.auth.getSession>>;
/** Supabase-shaped user (id, email, user_metadata.displayName / profileImageUrl). */
export type AuthUser = NonNullable<SessionResult['data']['session']>['user'];
