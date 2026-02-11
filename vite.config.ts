import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
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
