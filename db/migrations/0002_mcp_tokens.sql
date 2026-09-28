-- Personal access tokens for the MCP server (flash-learn-mcp).
--
-- Neon Auth JWTs last ~15 minutes and external clients get no refresh token,
-- so the MCP server authenticates with a long-lived personal token instead.
-- Only the SHA-256 hash is stored; the plaintext is shown once, when the token
-- is issued by api/mcp-token. api/mcp resolves the hash to the owning user.

create table public.mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references neon_auth."user"(id) on delete cascade,
  name text not null default 'MCP',
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index mcp_tokens_user_idx on public.mcp_tokens (user_id, created_at desc);

-- Owners can see and revoke (delete) their tokens; issuing goes through api/mcp-token.
alter table public.mcp_tokens enable row level security;

create policy "mcp_tokens select own" on public.mcp_tokens for select
  to authenticated using (user_id = auth.uid());
create policy "mcp_tokens delete own" on public.mcp_tokens for delete
  to authenticated using (user_id = auth.uid());

revoke insert, update on public.mcp_tokens from authenticated;
