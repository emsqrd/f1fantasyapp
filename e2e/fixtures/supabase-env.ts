import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_DIR = path.resolve(__dirname, '..', '..', 'api');

export interface SupabaseEnv {
  apiUrl: string;
  authUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  jwtSecret: string;
}

let cached: SupabaseEnv | undefined;

export function readSupabaseEnv(): SupabaseEnv {
  if (cached) return cached;

  const result = spawnSync('supabase', ['status', '-o', 'json'], {
    cwd: API_DIR,
    encoding: 'utf8',
  });

  if (result.error || result.status !== 0) {
    throw new Error(
      `Failed to read \`supabase status\`. Run \`supabase start\` from api/ before running E2E tests.\n` +
        `stderr: ${result.stderr ?? ''}`,
    );
  }

  const match = result.stdout.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('Could not locate JSON in `supabase status -o json` output.');
  }

  const parsed = JSON.parse(match[0]) as Record<string, string>;
  const required = ['API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY', 'JWT_SECRET'] as const;
  for (const key of required) {
    if (!parsed[key]) {
      throw new Error(`\`supabase status\` did not return ${key}.`);
    }
  }

  cached = {
    apiUrl: parsed.API_URL,
    authUrl: `${parsed.API_URL}/auth/v1`,
    anonKey: parsed.ANON_KEY,
    serviceRoleKey: parsed.SERVICE_ROLE_KEY,
    jwtSecret: parsed.JWT_SECRET,
  };
  return cached;
}
