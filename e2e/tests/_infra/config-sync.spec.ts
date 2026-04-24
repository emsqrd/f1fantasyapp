import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const DEV_CONFIG = path.join(REPO_ROOT, 'api', 'supabase', 'config.toml');
const E2E_CONFIG = path.join(REPO_ROOT, 'e2e', 'supabase', 'config.toml');

// Fields the two stacks are intentionally allowed to differ on. Every other
// line must match exactly so config drift fails loudly before it causes
// silent behavioral divergence between dev and e2e.
const IGNORED_KEY_RE = /^\s*(project_id|[a-z_]*port)\s*=/;

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
