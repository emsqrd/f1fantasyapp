import { withE2eDb } from './db';

// Tables inside `public` that must survive truncate.
const PUBLIC_PRESERVED = new Set(['__EFMigrationsHistory']);

/**
 * Wipes per-test state across auth, storage metadata, and app data in one
 * CASCADE. Leaves migration-tracker tables, storage buckets, and Supabase
 * internals untouched — those are owned by `supabase start`, not the test
 * suite.
 *
 * Residual non-ephemeral bit: uploaded avatar *bytes* live in the storage-api
 * container's Docker volume and accumulate slowly across runs. Recycle via
 * `supabase stop && supabase start` from e2e/supabase/ if it ever matters.
 */
export async function resetDb(): Promise<void> {
  await withE2eDb(async (client) => {
    const { rows } = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
    );

    const publicTargets = rows
      .map((r) => r.tablename)
      .filter((name) => !PUBLIC_PRESERVED.has(name))
      .map((name) => `public."${name}"`);

    // auth.users CASCADE sweeps auth.identities, auth.sessions,
    // auth.refresh_tokens, auth.mfa_*, auth.flow_state, etc. — every
    // auth.* table GoTrue populates via FKs. Leaves auth.schema_migrations
    // (owned by supabase start) intact.
    const targets = [...publicTargets, 'auth.users', 'storage.objects'];

    // No RESTART IDENTITY: sequences in the auth schema are owned by
    // supabase_auth_admin, and postgres isn't allowed to reset them.
    // Tests read IDs back from fixture helpers rather than hardcoding,
    // so monotonic continuation across tests is harmless.
    await client.query(`TRUNCATE TABLE ${targets.join(', ')} CASCADE`);
  });
}
