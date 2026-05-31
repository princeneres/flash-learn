import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { AddressInfo } from 'node:net';
import { saveSession, SESSION_FILE } from './session.js';

/**
 * Browser login flow — no token copy-pasting.
 *
 *   1. Start an ephemeral localhost HTTP server.
 *   2. Open the app's /connect-mcp page (the user is/logs in there normally,
 *      including Google OAuth).
 *   3. That page posts the user's existing session tokens back to localhost.
 *   4. We save them to ~/.flash-learn-mcp/session.json and exit.
 *
 * A one-time `state` nonce guards the callback so a random local process can't
 * inject tokens.
 */

const APP_URL = (process.env.FLASH_LEARN_APP_URL ?? 'https://flashlearn.princeneres.dev').replace(
  /\/$/,
  '',
);

function openBrowser(url: string): void {
  const cmd =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  const child = spawn(cmd, [url], {
    stdio: 'ignore',
    detached: true,
    shell: process.platform === 'win32',
  });
  child.on('error', () => {
    /* ignored — we already printed the URL */
  });
  child.unref();
}

export async function runLogin(): Promise<void> {
  const state = randomUUID();

  await new Promise<void>((resolve, reject) => {
    const server = createServer((req, res) => {
      // CORS so the app origin can POST here.
      res.setHeader('Access-Control-Allow-Origin', APP_URL);
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204).end();
        return;
      }
      if (req.method !== 'POST' || !req.url?.startsWith('/callback')) {
        res.writeHead(404).end();
        return;
      }

      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const data = JSON.parse(body || '{}');
          if (data.state !== state) {
            res.writeHead(403).end(JSON.stringify({ error: 'state mismatch' }));
            return;
          }
          if (!data.access_token) {
            res.writeHead(400).end(JSON.stringify({ error: 'missing access_token' }));
            return;
          }
          saveSession({ access_token: data.access_token, refresh_token: data.refresh_token ?? '' });
          res
            .writeHead(200, { 'Content-Type': 'application/json' })
            .end(JSON.stringify({ ok: true }));
          console.error(`\n✓ Conta conectada. Sessão salva em ${SESSION_FILE}\n`);
          server.close();
          resolve();
        } catch (err) {
          res.writeHead(400).end(JSON.stringify({ error: String(err) }));
          reject(err);
        }
      });
    });

    server.on('error', reject);

    // Listen on an OS-assigned ephemeral port (no randomness needed).
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port;
      const callback = `http://127.0.0.1:${port}/callback`;
      const loginUrl = `${APP_URL}/connect-mcp?callback=${encodeURIComponent(callback)}&state=${state}`;
      console.error('Abrindo o navegador para conectar sua conta Flash-Learn...');
      console.error(`Se não abrir, acesse manualmente:\n  ${loginUrl}\n`);
      openBrowser(loginUrl);
    });

    // Safety timeout (5 min).
    setTimeout(
      () => {
        server.close();
        reject(new Error('Tempo esgotado aguardando o login no navegador.'));
      },
      5 * 60 * 1000,
    ).unref();
  });
}
