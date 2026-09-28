import { loadToken, SESSION_FILE } from './session.js';
import { rethrowFriendly } from './planErrors.js';

/**
 * Calls the Flash-Learn backend (`POST {APP_URL}/api/mcp`) AS THE AUTHENTICATED
 * USER, using the personal token saved by the `login` command. The backend
 * checks ownership for every tool and the database triggers enforce the plan
 * quotas (`enforce_deck_quota`, `enforce_card_quota`), so there is no second
 * copy of the validation logic to keep in sync here.
 */

export const APP_URL = (process.env.FLASH_LEARN_APP_URL ?? 'https://flashlearn.princeneres.dev').replace(
  /\/+$/,
  '',
);

export async function callTool<T>(tool: string, args: Record<string, unknown>): Promise<T> {
  const token = loadToken();
  if (!token) {
    throw new Error(
      `Não há sessão salva. Rode "npx flash-learn-mcp login" para conectar sua conta ` +
        `(ou defina FLASH_LEARN_TOKEN). Arquivo esperado: ${SESSION_FILE}.`,
    );
  }

  let res: Response;
  try {
    res = await fetch(`${APP_URL}/api/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tool, args }),
    });
  } catch (err) {
    throw new Error(`Não foi possível acessar ${APP_URL}: ${err instanceof Error ? err.message : err}`);
  }

  const body = (await res.json().catch(() => null)) as { result?: T; error?: string } | null;
  if (res.status === 401) {
    throw new Error('Token do MCP inválido ou revogado. Rode "npx flash-learn-mcp login" novamente.');
  }
  if (!res.ok) rethrowFriendly({ message: body?.error ?? `HTTP ${res.status}` });
  return body!.result as T;
}
