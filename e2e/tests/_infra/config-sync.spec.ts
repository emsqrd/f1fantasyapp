import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const DEV_CONFIG = path.join(REPO_ROOT, 'api', 'supabase', 'config.toml');
const E2E_CONFIG = path.join(REPO_ROOT, 'e2e', 'supabase', 'config.toml');

// Both stacks must run the same Supabase config — if someone edits
// api/supabase/config.toml and forgets the e2e copy, e2e tests pass
// against config the user never sees in dev. This test diffs them and
// fails on drift.
//
// The exceptions below are values that *must* differ:
//   - project_id: distinguishes the two local stacks
//   - *_port: e2e shifts every port by +100 (see README → Local
//     Services Topology) to run alongside dev
//   - site_url / additional_redirect_urls: contain the web port
//     (5173 dev, 5273 e2e), so they shift too
//   - max_frequency: e2e drops the per-user resend cool-down to 0s
//     so resend tests don't have to sleep past gotrue's throttle
const IGNORED_KEY_RE =
  /^\s*(project_id|[a-z_]*port|site_url|additional_redirect_urls|max_frequency)\s*=/;

// Compare config values only: drop blank lines, comments (the two files carry
// different header blocks), and the keys above that must differ between stacks.
const configValues = (raw: string): string[] =>
  raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#') && !IGNORED_KEY_RE.test(line));

test('api/supabase/config.toml and e2e/supabase/config.toml stay in sync', () => {
  const dev = configValues(readFileSync(DEV_CONFIG, 'utf8'));
  const e2e = configValues(readFileSync(E2E_CONFIG, 'utf8'));

  expect(e2e).toEqual(dev);
});
