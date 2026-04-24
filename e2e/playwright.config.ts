import { defineConfig, devices } from '@playwright/test';

import { E2E_EF_CONNECTION_STRING } from './fixtures/db';
import { readSupabaseEnv } from './fixtures/supabase-env';

// Ports shifted by +100 from the dev defaults (web:dev = 5173, api:watch =
// 5077) so e2e webServers can run alongside dev servers — same rationale
// as the e2e Supabase stack's +100 shift.
const WEB_PORT = 5273;
const API_PORT = 5177;
const BASE_URL = `http://localhost:${WEB_PORT}`;
const API_URL = `http://localhost:${API_PORT}`;

const supabase = readSupabaseEnv();

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html'], ['github']] : [['html'], ['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: `npm run web:build && npm --prefix web run preview -- --port ${WEB_PORT} --strictPort`,
      cwd: '..',
      url: BASE_URL,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        VITE_SUPABASE_URL: supabase.apiUrl,
        VITE_SUPABASE_ANON_KEY: supabase.anonKey,
        VITE_F1_FANTASY_API: `${API_URL}/api`,
        // Disable Sentry at build time so e2e runs don't ship events to
        // the real project. web/.env ships a real DSN and Vite inlines
        // env vars at build, so an explicit override here is the gate.
        // Mirrors `Sentry__Dsn: ''` on the API webServer below.
        VITE_SENTRY_DSN: '',
      },
    },
    {
      command: `dotnet publish api/F1CompanionApi/F1CompanionApi.csproj -c Release -o api/bin/e2e --nologo && dotnet api/bin/e2e/F1CompanionApi.dll`,
      cwd: '..',
      url: `${API_URL}/openapi/v1.json`,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ASPNETCORE_ENVIRONMENT: 'Testing',
        ASPNETCORE_URLS: API_URL,
        ConnectionStrings__DefaultConnection: E2E_EF_CONNECTION_STRING,
        Supabase__AuthUrl: supabase.authUrl,
        CorsOrigins__0: BASE_URL,
        Sentry__Dsn: '',
      },
    },
  ],
});
