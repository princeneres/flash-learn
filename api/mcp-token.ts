// Issues a personal access token for the MCP server. Called by the /connect-mcp
// page with the user's session JWT; the plaintext token is returned once and
// only its SHA-256 hash is stored (public.mcp_tokens).

import { randomBytes } from 'node:crypto';
import { getUser, hashMcpToken, json, readJson, sql } from './_lib/server.js';

const MAX_ACTIVE_TOKENS = 10;

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const body = await readJson<{ name?: string }>(req);
  const name = (body?.name ?? 'MCP').trim().slice(0, 80) || 'MCP';

  const [{ count }] = (await sql`
    select count(*)::int as count from public.mcp_tokens
    where user_id = ${user.id} and revoked_at is null
  `) as Array<{ count: number }>;
  if (count >= MAX_ACTIVE_TOKENS) {
    return json({ error: 'Too many active MCP tokens; revoke one first.' }, 409);
  }

  const token = `flmcp_${randomBytes(32).toString('base64url')}`;
  await sql`
    insert into public.mcp_tokens (user_id, name, token_hash)
    values (${user.id}, ${name}, ${hashMcpToken(token)})
  `;
  return json({ token });
}
