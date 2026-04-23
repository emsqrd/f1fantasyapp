import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import {
  E2E_DB_NAME,
  E2E_EF_CONNECTION_STRING,
  SUPABASE_DB_PASSWORD,
  SUPABASE_DB_PORT,
  SUPABASE_DB_USER,
  SUPABASE_HOST,
  closeE2eDb,
} from './fixtures/db';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const API_PROJECT = path.join(REPO_ROOT, 'api', 'F1CompanionApi');

export default async function globalSetup(): Promise<void> {
  await ensureSupabaseRunning();
  await ensureE2eDatabaseExists();
  applyEfMigrations();
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
    const { rowCount } = await admin.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [E2E_DB_NAME],
    );
    if (rowCount === 0) {
      await admin.query(`CREATE DATABASE "${E2E_DB_NAME}"`);
    }
  } finally {
    await admin.end();
  }
}

function applyEfMigrations(): void {
  const result = spawnSync(
    'dotnet',
    ['ef', 'database', 'update', '--project', API_PROJECT],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        ASPNETCORE_ENVIRONMENT: 'Testing',
        ConnectionStrings__DefaultConnection: E2E_EF_CONNECTION_STRING,
        Supabase__AuthUrl: 'http://127.0.0.1:54321/auth/v1',
        Sentry__Dsn: '',
      },
      stdio: 'inherit',
    },
  );

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
