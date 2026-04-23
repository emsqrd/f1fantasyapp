import { withE2eDb } from './db';

const PRESERVED_TABLES = new Set(['__EFMigrationsHistory']);

export async function resetDb(): Promise<void> {
  await withE2eDb(async (client) => {
    const { rows } = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
    );

    const targets = rows
      .map((r) => r.tablename)
      .filter((name) => !PRESERVED_TABLES.has(name));

    if (targets.length === 0) return;

    const quoted = targets.map((name) => `"${name}"`).join(', ');
    await client.query(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
  });
}
