import { Pool, type PoolClient } from 'pg';

export const SUPABASE_HOST = '127.0.0.1';
export const SUPABASE_DB_PORT = 54322;
export const SUPABASE_DB_USER = 'postgres';
export const SUPABASE_DB_PASSWORD = 'postgres';

export const E2E_DB_NAME = 'f1fantasy_e2e';

export const E2E_EF_CONNECTION_STRING = [
  `Host=${SUPABASE_HOST}`,
  `Port=${SUPABASE_DB_PORT}`,
  `Database=${E2E_DB_NAME}`,
  `Username=${SUPABASE_DB_USER}`,
  `Password=${SUPABASE_DB_PASSWORD}`,
].join(';');

let pool: Pool | undefined;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: SUPABASE_HOST,
      port: SUPABASE_DB_PORT,
      user: SUPABASE_DB_USER,
      password: SUPABASE_DB_PASSWORD,
      database: E2E_DB_NAME,
      max: 4,
    });
  }
  return pool;
}

export async function withE2eDb<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function closeE2eDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
