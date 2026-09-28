import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Persisted personal token. The login flow writes this file and the MCP server
 * reads it, so the user logs in once and never touches a token by hand.
 */

const DIR = join(homedir(), '.flash-learn-mcp');
const FILE = join(DIR, 'session.json');

export function saveToken(token: string): void {
  mkdirSync(DIR, { recursive: true });
  // Owner-only permissions — the file holds an auth token.
  writeFileSync(FILE, JSON.stringify({ token }, null, 2), { mode: 0o600 });
}

/**
 * Resolves the token from (in order): the FLASH_LEARN_TOKEN env var (CI /
 * development), then the saved session file. Returns null if neither is present.
 */
export function loadToken(): string | null {
  const envToken = process.env.FLASH_LEARN_TOKEN;
  if (envToken) return envToken;
  if (existsSync(FILE)) {
    try {
      const parsed = JSON.parse(readFileSync(FILE, 'utf8'));
      // Sessions saved by older versions (Supabase tokens) have no `token` field.
      if (parsed && typeof parsed.token === 'string') return parsed.token;
    } catch {
      return null;
    }
  }
  return null;
}

export const SESSION_FILE = FILE;
