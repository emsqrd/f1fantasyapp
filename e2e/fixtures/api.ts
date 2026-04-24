import type { TestUser } from './auth';
import { readSupabaseEnv } from './supabase-env';

// Matches API_PORT in playwright.config.ts — shifted +100 from api:watch's
// default (5077) so the e2e API can run alongside a dev API.
const API_HOST = 'http://localhost:5177';
export const API_BASE_URL = `${API_HOST}/api`;

const tokenCache = new Map<string, string>();

export async function getAccessToken(user: TestUser): Promise<string> {
  const cached = tokenCache.get(user.id);
  if (cached) return cached;

  const env = readSupabaseEnv();
  const res = await fetch(`${env.authUrl}/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: env.anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: user.email, password: user.password }),
  });

  if (!res.ok) {
    throw new Error(
      `GoTrue password sign-in failed for ${user.email} (${res.status}): ${await res.text()}`,
    );
  }

  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) {
    throw new Error(`GoTrue password sign-in response missing access_token for ${user.email}.`);
  }

  tokenCache.set(user.id, body.access_token);
  return body.access_token;
}

export function clearAccessTokenCache(): void {
  tokenCache.clear();
}

export interface ApiRequestInit extends Omit<RequestInit, 'body'> {
  body?: unknown;
  user?: TestUser;
}

export async function apiFetch(path: string, init: ApiRequestInit = {}): Promise<Response> {
  const { user, body, headers, ...rest } = init;
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;

  const composedHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(headers as Record<string, string> | undefined),
  };

  if (user) {
    composedHeaders.Authorization = `Bearer ${await getAccessToken(user)}`;
  }

  let serializedBody: BodyInit | undefined;
  if (body !== undefined) {
    composedHeaders['Content-Type'] = 'application/json';
    serializedBody = JSON.stringify(body);
  }

  return fetch(url, {
    ...rest,
    headers: composedHeaders,
    body: serializedBody,
  });
}

export async function apiFetchJson<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    throw new Error(
      `${init.method ?? 'GET'} ${path} failed (${res.status}): ${await res.text()}`,
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
