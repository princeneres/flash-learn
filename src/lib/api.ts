import { getAccessToken } from './neon';

/** Non-2xx response from one of our /api functions; `body` carries its JSON (e.g. `code`). */
export class ApiError extends Error {
  status: number;
  body: Record<string, unknown> | null;

  constructor(status: number, body: Record<string, unknown> | null) {
    super(typeof body?.error === 'string' ? body.error : `Request failed (${status})`);
    this.status = status;
    this.body = body;
  }
}

/** POSTs JSON to /api/<name> with the session JWT and returns the parsed response. */
export async function callApi<T>(name: string, body: unknown): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`/api/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}
