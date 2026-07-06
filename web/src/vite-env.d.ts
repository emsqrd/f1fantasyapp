/// <reference types="vite/client" />

interface ViteTypeOptions {
  // Disallow reads of env keys not declared below — a mistyped or undeclared
  // VITE_* becomes a compile error instead of silently typed `any`.
  strictImportMetaEnv: unknown;
}

interface ImportMetaEnv {
  readonly VITE_F1_FANTASY_API: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_SENTRY_DSN: string;
  readonly VITE_SENTRY_TRACES_SAMPLE_RATE: string;
  readonly VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE: string;
  readonly VITE_ROUTER_DEVTOOLS: string;
  readonly VITE_QUERY_DEVTOOLS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
