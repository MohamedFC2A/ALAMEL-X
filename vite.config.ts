import { defineConfig } from 'vitest/config';
import type { IncomingMessage, ServerResponse } from 'http';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

function deepseekProxyPlugin() {
  return {
    name: 'deepseek-proxy',
    configureServer(server: { middlewares: { use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void) => void } }) {
      server.middlewares.use('/api/deepseek/chat', async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: { message: 'Method not allowed.' } }));
          return;
        }

        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey) {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({
            error: {
              message: 'DeepSeek API key is not configured on the server.',
              code: 'missing_server_key',
            },
          }));
          return;
        }

        let body = '';
        req.on('data', (chunk: Buffer) => {
          body += chunk.toString();
        });

        req.on('end', async () => {
          try {
            let input;
            try {
              input = body ? JSON.parse(body) : {};
            } catch {
              input = {};
            }

            const model = typeof input.model === 'string' && input.model.trim() ? input.model.trim() : 'deepseek-chat';
            const messages = Array.isArray(input.messages) ? input.messages : [];
            const temperature = typeof input.temperature === 'number' ? input.temperature : 0.65;
            const maxTokensRaw = typeof input.maxTokens === 'number' ? input.maxTokens : input.max_tokens;
            const maxTokens = typeof maxTokensRaw === 'number' ? maxTokensRaw : 280;

            if (!messages.length) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ error: { message: 'messages array is required.' } }));
              return;
            }

            const upstream = await fetch('https://api.deepseek.com/chat/completions', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model,
                messages,
                temperature,
                max_tokens: maxTokens,
                stream: false,
              }),
            });

            const raw = await upstream.text();
            res.statusCode = upstream.status;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store');
            res.end(raw || '{}');
          } catch {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({
              error: {
                message: 'Failed to connect to DeepSeek upstream.',
                code: 'upstream_request_failed',
              },
            }));
          }
        });
      });
    }
  };
}

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
  },
  plugins: [
    deepseekProxyPlugin(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['avatars/*.svg'],
      manifest: {
        name: 'العميل x',
        short_name: 'العميل x',
        description: 'لعبة اجتماعية لكشف الجاسوس باللهجة العربية.',
        theme_color: '#08111f',
        background_color: '#08111f',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/avatars/boy_1.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/avatars/girl_1.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,json,woff2}'],
        navigateFallback: '/index.html',
        maximumFileSizeToCacheInBytes: 7 * 1024 * 1024,
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, '/');
          if (!normalized.includes('/node_modules/')) {
            return undefined;
          }
          if (normalized.includes('/react/') || normalized.includes('/react-dom/') || normalized.includes('/react-router')) {
            return 'vendor-react';
          }
          if (normalized.includes('/dexie')) {
            return 'vendor-data';
          }
          if (
            normalized.includes('/framer-motion/') ||
            normalized.includes('/i18next/') ||
            normalized.includes('/react-i18next/') ||
            normalized.includes('/lucide-react/')
          ) {
            return 'vendor-ui';
          }
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
});
