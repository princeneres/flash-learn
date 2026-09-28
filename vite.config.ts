import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Serves api/<name>.ts (Vercel Functions with Web `POST(Request)` handlers) under
// `pnpm dev`, so the app works locally without `vercel dev`. Production uses Vercel.
const apiFunctions = (): Plugin => ({
  name: 'api-functions',
  apply: 'serve',
  configureServer(server) {
    Object.assign(process.env, loadEnv(server.config.mode, process.cwd(), ''));
    server.middlewares.use(async (req, res, next) => {
      const match = req.url?.match(/^\/api\/([\w-]+)(\?.*)?$/);
      if (!match) return next();
      try {
        const mod = await server.ssrLoadModule(`/api/${match[1]}.ts`);
        const handler = mod[req.method ?? 'GET'];
        if (typeof handler !== 'function') {
          res.statusCode = 405;
          return res.end();
        }
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const request = new Request(`http://${req.headers.host}${req.url}`, {
          method: req.method,
          headers: req.headers as Record<string, string>,
          body: chunks.length ? Buffer.concat(chunks) : undefined,
        });
        const response: Response = await handler(request);
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch (err) {
        next(err);
      }
    });
  },
});

// https://vite.dev/config/
export default defineConfig({
  preview: {
    allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.ngrok.io'],
  },
  // Guard against "Invalid hook call" from a duplicated React (e.g. if deps get
  // installed with a different package manager): always resolve a single copy.
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  plugins: [
    apiFunctions(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon_io/favicon.ico',
        'favicon_io/apple-touch-icon.png',
        'favicon_io/favicon-16x16.png',
        'favicon_io/favicon-32x32.png',
      ],
      manifest: {
        name: 'Flash Learn',
        short_name: 'FlashLearn',
        description: 'Spaced repetition flashcards for effective learning',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/favicon_io/android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/favicon_io/android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/favicon_io/maskable-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/favicon_io/maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/__/, /^\/api\//, /\/[^/?]+\.[^/]+$/],
        runtimeCaching: [
          {
            // Neon Data API (PostgREST) reads.
            urlPattern: ({ url }) =>
              url.hostname.endsWith('.neon.tech') && url.hostname.includes('.apirest.'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'neon-data-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.origin === 'https://fonts.googleapis.com' ||
              url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // Neon object storage (presigned media URLs, public avatars).
            urlPattern: ({ url }) =>
              url.hostname.endsWith('.neon.tech') && url.hostname.includes('.storage.'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'neon-storage',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
