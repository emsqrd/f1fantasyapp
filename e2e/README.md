# E2E Tests

End-to-end browser tests for the F1 Fantasy app. Runs Playwright against a
prod-like build of the web client (Vite preview), backed by a dedicated
Supabase stack at `e2e/supabase/`.

See root `CLAUDE.md` → "Local Services Topology" for how this stack relates
to the dev stack and the port-shift rule.

## Prerequisites

1. **Docker Desktop** running.
2. **E2E Supabase stack** running:

   ```bash
   cd e2e/supabase && supabase start
   ```

   The harness fails fast if this stack isn't reachable.

3. **.NET SDK** with the `dotnet-ef` tool (used by global setup to apply EF
   migrations to the e2e stack's Postgres).

## Install

From the repo root:

```bash
npm run e2e:install     # installs npm deps + Chromium
```

## Run

```bash
npm run e2e             # headless run of all specs
npm run e2e:ui          # Playwright UI for interactive debugging
```

## Architecture

- **Web + API servers.** Playwright's `webServer` block starts two
  processes before tests run — a prod-like web build served by `vite
preview`, and a published-Release `dotnet` API — both wired to the e2e
  Supabase stack. `reuseExistingServer: false` guards against an earlier
  dev process on the e2e ports silently serving tests against the wrong
  stack.
- **Per-test users.** Each test creates whatever users it needs via
  `createTestUser()` (calls GoTrue admin API, trigger populates
  `Accounts` + `UserProfiles` in the same transaction). No
  pre-provisioned users, no shared `storageState`. Collision-free by
  construction: emails are `test-${randomUUID()}@e2e.local`.
- **Per-test isolation.** `fixtures/reset.ts` truncates `auth.users CASCADE`
  (sweeps all `auth.*` state), `storage.objects`, and every `public.*`
  table except `__EFMigrationsHistory` in a single statement. Storage
  buckets, migration-tracker tables, and Supabase internals stay put.
  Uploaded avatar _bytes_ accumulate slowly in the storage-api container's
  Docker volume — recycle via `supabase stop && supabase start` from
  `e2e/supabase/` if it ever matters.
- **Seeding.** Each test declares its own data in `beforeEach` — minimal
  grid, season, race. Helpers live in `fixtures/seed.ts` (direct-DB:
  season, grid, race weekend), `fixtures/team.ts` and `fixtures/league.ts`
  (both via the real API with the user's JWT).

## Conventions

- **Selectors (semantic-first).** Follow the Playwright / Testing Library
  priority: `getByRole` → `getByLabel` → `getByPlaceholder` → `getByText` →
  `getByAltText` / `getByTitle` → `getByTestId`. Testid is a last resort,
  not a default — if the UI has an accessible name, query by it. Copy drift
  breaking a test is a feature, not a bug: the user-visible text changed,
  and a test should flag it.
- **Disambiguating collisions.** When a semantic query matches more than
  one element (e.g. two "Sign In" buttons on `/sign-in`), fix it by
  scoping (`page.locator('form').getByRole(...)`) or by improving the
  product's a11y (add an `aria-label` on an icon-heavy trigger). Both
  keep tests semantic and, in the a11y case, improve the app at the same
  time.
- **Reach for `data-testid` only when** the target has no accessible name
  and can't gain one (canvas elements, drag handles, decorative
  wrappers), or the accessible name is inherently dynamic in a way that
  would make regex-matching fragile. Document the reason inline.
- **Never** rely on CSS structure, class names, or `:nth-child`.
- **Waits:** Playwright's built-in `expect` polling. Never `sleep`.
- **Scope:** this suite owns cross-system failure modes only (auth, CORS,
  Supabase wiring, deploy/config, critical user journeys). Validation
  matrices and unit logic belong one layer down.

## Layout

Feature specs live in `tests/*.spec.ts`. Meta-tests that guard the harness
itself (e.g. the `config.toml` drift check) live under `tests/_infra/` —
the underscore keeps them grouped and visually distinct from user-flow
specs. Shared helpers live in `fixtures/`.

## CI

The `e2e` job in `.github/workflows/ci.yml` runs the suite on every push
and PR. Steps: `supabase/setup-cli` → `supabase start` from
`e2e/supabase/` → `npm ci` + `npx playwright install` → `npm run e2e`.
On failure, `playwright-report/` and `test-results/` (traces, videos,
screenshots) are uploaded as artifacts with 14-day retention. The stack
is stopped in an `if: always()` step. Add `e2e` to branch protection's
required checks after the first green run.

## Escape hatch: editing an already-applied migration

EF tracks applied migrations in `__EFMigrationsHistory` by ID, so editing
a migration file in-place is silently skipped on the next `dotnet ef
database update`. If a migration body actually changed and you need the
e2e stack to re-run it from scratch:

```bash
cd e2e/supabase && supabase db reset
```

That drops and re-creates the e2e stack's Postgres, re-runs the supabase
migrations, and the next `npm run e2e` re-applies every EF migration from
an empty `__EFMigrationsHistory`. Dev data in `api/supabase/` is
untouched.
