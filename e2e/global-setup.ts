import type { FullConfig } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { provisionTestUsers } from './fixtures/auth';
import {
  E2E_DB_NAME,
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

export default async function globalSetup(config: FullConfig): Promise<void> {
  await ensureSupabaseRunning();
  await ensureE2eDatabaseExists();
  applyEfMigrations();
  await provisionTestUsers(resolveWebBaseUrl(config));
  await closeE2eDb();
}

function resolveWebBaseUrl(config: FullConfig): string {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) {
    throw new Error('Playwright config is missing `use.baseURL`.');
  }
  return baseURL;
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
      `Cannot reach local Supabase Postgres at ${SUPABASE_HOST}:${SUPABASE_DB_PORT}. ` +
        `Run \`supabase start\` from the api/ directory before running E2E tests.`,
    );
  } finally {
    await client.end().catch(() => {});
  }
}

async function ensureE2eDatabaseExists(): Promise<void> {
  const admin = new Client({
    host: SUPABASE_HOST,
    port: SUPABASE_DB_PORT,
    user: SUPABASE_DB_USER,
    password: SUPABASE_DB_PASSWORD,
    database: 'postgres',
  });

  await admin.connect();
  try {
    const { rowCount } = await admin.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [E2E_DB_NAME]);
    if (rowCount === 0) {
      await admin.query(`CREATE DATABASE "${E2E_DB_NAME}"`);
    }
  } finally {
    await admin.end();
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
    throw new Error(`Failed to invoke \`dotnet ef\`: ${result.error.message}. ` + `Ensure the .NET SDK and \`dotnet-ef\` tool are installed.`);
  }

  if (result.status !== 0) {
    throw new Error(`dotnet ef database update exited with status ${result.status}.`);
  }
}
