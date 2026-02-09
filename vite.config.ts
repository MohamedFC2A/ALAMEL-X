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
        name: 'سُسَاوي',
        short_name: 'سُسَاوي',
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
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
});
