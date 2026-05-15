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
//   - email_sent: e2e raises the per-hour cap so the suite has
//     headroom for signup + resend within a single run
//   - max_frequency: e2e drops the per-user resend cool-down to 0s
//     so resend tests don't have to sleep past gotrue's throttle
const IGNORED_KEY_RE =
  /^\s*(project_id|[a-z_]*port|site_url|additional_redirect_urls|email_sent|max_frequency)\s*=/;

test('api/supabase/config.toml and e2e/supabase/config.toml stay in sync', () => {
  const dev = readFileSync(DEV_CONFIG, 'utf8').split('\n');
  const e2e = readFileSync(E2E_CONFIG, 'utf8').split('\n');

  const stripIgnored = (lines: string[]): string[] =>
    lines.filter((line) => !IGNORED_KEY_RE.test(line));

  // Dev config has no leading file-level comment; e2e config has an
  // orientation comment block before `project_id`. Drop e2e's leading
  // comment block (everything before the first non-comment, non-blank
  // line) so the diff isn't poisoned by it.
  const dropLeadingComments = (lines: string[]): string[] => {
    let i = 0;
    while (i < lines.length && (lines[i]!.trim() === '' || lines[i]!.trim().startsWith('#'))) {
      i++;
    }
    return lines.slice(i);
  };

  const devBody = stripIgnored(dropLeadingComments(dev));
  const e2eBody = stripIgnored(dropLeadingComments(e2e));

  expect(e2eBody).toEqual(devBody);
});
