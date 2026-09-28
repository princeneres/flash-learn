// Shared helpers for the Vercel Functions in api/ (files under _lib are not routes).
//
// Required env (Vercel project settings / .env.local for `vercel dev`):
//   DATABASE_URL        - Neon connection string (owner role; bypasses RLS)
//   NEON_AUTH_JWKS_URL  - Neon Auth JWKS, used to verify the caller's session JWT

import { neon } from '@neondatabase/serverless';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export const json = (body: unknown, status = 200) => Response.json(body, { status });

const env = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} not set`);
  return value;
};

/** SQL over HTTP as the database owner — server code enforces authorization itself. */
export const sql = neon(env('DATABASE_URL'));

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

export interface AuthedUser {
  id: string;
  email: string | null;
}

/**
 * Identifies the caller from the `Authorization: Bearer <jwt>` header (the Neon
 * Auth session JWT) — never trust client-sent identity. Returns null when absent
 * or invalid.
 */
export async function getUser(req: Request): Promise<AuthedUser | null> {
  const header = req.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return null;
  jwks ??= createRemoteJWKSet(new URL(env('NEON_AUTH_JWKS_URL')));
  try {
    const { payload } = await jwtVerify(header.slice('Bearer '.length), jwks);
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : null,
    };
  } catch {
    return null;
  }
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

/** Postgres error raised by our functions with `raise exception '<CODE>'`. */
export const pgErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);
