import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

import {
  E2E_EF_CONNECTION_STRING,
  SUPABASE_DB_PASSWORD,
  SUPABASE_DB_PORT,
  SUPABASE_DB_USER,
  SUPABASE_HOST,
  closeE2eDb,
} from './fixtures/db';
import { readSupabaseEnv } from './fixtures/supabase-env';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const API_PROJECT = path.join(REPO_ROOT, 'api', 'F1CompanionApi');

/**
 * Migration ordering (implicit, worth knowing):
 *   1. `supabase start` (from e2e/supabase/) applies files in
 *      supabase/migrations/ against the stack's `postgres` DB. The profile
 *      trigger installs with unresolved `public.*` refs — PL/pgSQL defers
 *      name resolution to runtime, so this is fine today. A future supabase
 *      migration that needs `public.*` at CREATE time (e.g. an FK from
 *      `auth.*` → `public.*`) would break this order.
 *   2. `dotnet ef database update` runs here, creating the `public` tables.
 *   3. Tests execute; by then both layers are in place.
 */
export default async function globalSetup(): Promise<void> {
  await ensureSupabaseRunning();
  applyEfMigrations();
  // Warm the Supabase env cache so worker processes spend no time on
  // `supabase status` once tests start. Read ignores its own return value.
  readSupabaseEnv();
  await closeE2eDb();
}

async function ensureSupabaseRunning(): Promise<void> {
  const client = new Client({
    host: SUPABASE_HOST,
    port: SUPABASE_DB_PORT,
    user: SUPABASE_DB_USER,
    password: SUPABASE_DB_PASSWORD,
    database: 'postgres',
    connectionTimeoutMillis: 2000,
  });

  try {
    await client.connect();
    await client.query('SELECT 1');
  } catch {
    throw new Error(
      `Cannot reach E2E Supabase Postgres at ${SUPABASE_HOST}:${SUPABASE_DB_PORT}. ` +
        `Run \`supabase start\` from e2e/supabase/ before running E2E tests.`,
    );
  } finally {
    await client.end().catch(() => {});
  }
}

function applyEfMigrations(): void {
  const result = spawnSync('dotnet', ['ef', 'database', 'update', '--project', API_PROJECT], {
    cwd: path.join(REPO_ROOT, 'api'),
    env: {
      ...process.env,
      ConnectionStrings__DefaultConnection: E2E_EF_CONNECTION_STRING,
      Supabase__AuthUrl: readSupabaseEnv().authUrl,
      Sentry__Dsn: '',
    },
    stdio: 'inherit',
  });

  if (result.error) {
    throw new Error(
      `Failed to invoke \`dotnet ef\`: ${result.error.message}. ` +
        `Ensure the .NET SDK and \`dotnet-ef\` tool are installed.`,
    );
  }

  if (result.status !== 0) {
    throw new Error(`dotnet ef database update exited with status ${result.status}.`);
  }
}
