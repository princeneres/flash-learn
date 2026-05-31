import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Persisted session tokens. The login flow writes this file; the MCP server
 * reads it and updates it whenever Supabase refreshes the access token, so the
 * user logs in once and never touches a token by hand.
 */

export interface StoredSession {
  access_token: string;
  refresh_token: string;
}

const DIR = join(homedir(), '.flash-learn-mcp');
const FILE = join(DIR, 'session.json');

export function saveSession(session: StoredSession): void {
  mkdirSync(DIR, { recursive: true });
  // Owner-only permissions — the file holds auth tokens.
  writeFileSync(FILE, JSON.stringify(session, null, 2), { mode: 0o600 });
}

/**
 * Resolves the session from (in order): env vars (back-compat / CI), then the
 * saved session file. Returns null if neither is present.
 */
export function loadSession(): StoredSession | null {
  const envAccess = process.env.SUPABASE_ACCESS_TOKEN;
  if (envAccess && envAccess !== 'PASTE_YOUR_ACCESS_TOKEN_HERE') {
    return {
      access_token: envAccess,
      refresh_token: process.env.SUPABASE_REFRESH_TOKEN ?? '',
    };
  }
  if (existsSync(FILE)) {
    try {
      const parsed = JSON.parse(readFileSync(FILE, 'utf8'));
      if (parsed && typeof parsed.access_token === 'string') {
        return { access_token: parsed.access_token, refresh_token: parsed.refresh_token ?? '' };
      }
    } catch {
      return null;
    }
  }
  return null;
}

export const SESSION_FILE = FILE;
