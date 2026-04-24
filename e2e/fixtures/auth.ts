import { randomUUID } from 'node:crypto';
import { readSupabaseEnv, type SupabaseEnv } from './supabase-env';

export interface TestUser {
  id: string;
  email: string;
  password: string;
  displayName: string;
}

export interface CreateTestUserOptions {
  displayName?: string;
  password?: string;
  emailPrefix?: string;
}

const DEFAULT_PASSWORD = 'e2e-password';

/**
 * Creates a Supabase auth user via the GoTrue admin API. The
 * on_auth_user_created trigger populates `Accounts` + `UserProfiles` in the
 * same transaction, so the returned user is immediately usable as an API
 * caller.
 *
 * Each test should create whatever users it needs; the per-test `resetDb()`
 * wipes `auth.users CASCADE` so these never leak between tests.
 */
export async function createTestUser(
  options: CreateTestUserOptions = {},
): Promise<TestUser> {
  const env = readSupabaseEnv();
  const unique = randomUUID();
  const email = `${options.emailPrefix ?? 'test'}-${unique}@e2e.local`;
  const password = options.password ?? DEFAULT_PASSWORD;
  const displayName = options.displayName ?? `Test ${unique.slice(0, 8)}`;

  const id = await adminCreateAuthUser(env, { email, password, displayName });
  return { id, email, password, displayName };
}

async function adminCreateAuthUser(
  env: SupabaseEnv,
  input: { email: string; password: string; displayName: string },
): Promise<string> {
  const res = await fetch(`${env.authUrl}/admin/users`, {
    method: 'POST',
    headers: {
      apikey: env.serviceRoleKey,
      Authorization: `Bearer ${env.serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { displayName: input.displayName },
    }),
  });

  if (!res.ok) {
    throw new Error(
      `GoTrue admin create failed (${res.status}): ${await res.text()}`,
    );
  }

  const created = (await res.json()) as { id: string };
  return created.id;
}
