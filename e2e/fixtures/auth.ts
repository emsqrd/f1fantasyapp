import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { withE2eDb } from './db';
import { readSupabaseEnv, type SupabaseEnv } from './supabase-env';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const AUTH_DIR = path.resolve(__dirname, '..', '.auth');

export type TestUserKey = 'userA' | 'userB';

export interface TestUser {
  key: TestUserKey;
  email: string;
  password: string;
  displayName: string;
}

export const TEST_USERS: readonly TestUser[] = [
  {
    key: 'userA',
    email: 'user-a@e2e.local',
    password: 'e2e-password-a',
    displayName: 'User A',
  },
  {
    key: 'userB',
    email: 'user-b@e2e.local',
    password: 'e2e-password-b',
    displayName: 'User B',
  },
] as const;

export function storageStatePath(key: TestUserKey): string {
  return path.join(AUTH_DIR, `${key}.json`);
}

export function getTestUser(key: TestUserKey): TestUser {
  const user = TEST_USERS.find((u) => u.key === key);
  if (!user) throw new Error(`Unknown test user key: ${key}`);
  return user;
}

export async function provisionTestUsers(webBaseUrl: string): Promise<void> {
  await mkdir(AUTH_DIR, { recursive: true });
  const env = readSupabaseEnv();

  for (const user of TEST_USERS) {
    const id = await ensureAuthUser(env, user);
    await ensureAccountAndProfile(id, user);
    await captureStorageState(webBaseUrl, user);
  }
}

async function ensureAuthUser(env: SupabaseEnv, user: TestUser): Promise<string> {
  const headers = {
    apikey: env.serviceRoleKey,
    Authorization: `Bearer ${env.serviceRoleKey}`,
  } as const;

  const listUrl = new URL(`${env.authUrl}/admin/users`);
  listUrl.searchParams.set('filter', user.email);
  const listRes = await fetch(listUrl, { headers });
  if (!listRes.ok) {
    throw new Error(
      `GoTrue admin list failed (${listRes.status}): ${await listRes.text()}`,
    );
  }
  const listBody = (await listRes.json()) as { users?: Array<{ id: string; email?: string }> };
  const existing = listBody.users?.find(
    (u) => u.email?.toLowerCase() === user.email.toLowerCase(),
  );
  if (existing) return existing.id;

  const createRes = await fetch(`${env.authUrl}/admin/users`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { displayName: user.displayName },
    }),
  });
  if (!createRes.ok) {
    throw new Error(
      `GoTrue admin create failed (${createRes.status}): ${await createRes.text()}`,
    );
  }
  const created = (await createRes.json()) as { id: string };
  return created.id;
}

async function ensureAccountAndProfile(accountId: string, user: TestUser): Promise<void> {
  await withE2eDb(async (client) => {
    await client.query(
      `INSERT INTO "Accounts" ("Id", "CreatedAt", "UpdatedAt", "IsActive", "IsDeleted", "LastLoginAt")
       VALUES ($1, NOW(), NOW(), true, false, NOW())
       ON CONFLICT ("Id") DO NOTHING`,
      [accountId],
    );
    await client.query(
      `INSERT INTO "UserProfiles" ("AccountId", "Email", "DisplayName", "CreatedAt")
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT ("AccountId") DO NOTHING`,
      [accountId, user.email, user.displayName],
    );
  });
}

async function captureStorageState(webBaseUrl: string, user: TestUser): Promise<void> {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ baseURL: webBaseUrl });
    const page = await context.newPage();
    await page.goto('/sign-in');
    const form = page.locator('form');
    await form.getByLabel('Email').fill(user.email);
    await form.getByLabel('Password').fill(user.password);
    await form.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), {
      timeout: 15_000,
    });
    await context.storageState({ path: storageStatePath(user.key) });
  } finally {
    await browser.close();
  }
}
