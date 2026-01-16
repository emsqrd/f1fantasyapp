import { sentryVitePlugin } from '@sentry/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      // Upload source maps to Sentry in production builds
      mode === 'production' &&
        sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
          sourcemaps: {
            assets: './dist/**',
          },
        }),
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/setupTests.ts',
      exclude: [...configDefaults.exclude],
      coverage: {
        exclude: [
          'node_modules/',
          'dist/',
          'src/setupTests.ts',
          'src/main.tsx',
          'src/contracts/**',
          '**/*.config.js',
          '**/*.config.ts',
          '**/tsconfig*.json',
          '**/*.d.ts',
          'src/components/ui',
          'src/demos',
        ],
      },
    },
  };
});
