# E2E Tests

End-to-end browser tests for the F1 Fantasy app. Runs Playwright against a
prod-like build of the web client (Vite preview), backed by a dedicated
Supabase stack at `e2e/supabase/` that runs alongside the dev stack in
`api/supabase/`.

## Prerequisites

1. **Docker Desktop** running.
2. **E2E Supabase stack** running:

   ```bash
   cd e2e/supabase && supabase start
   ```

   This is a separate Supabase project from the one under `api/supabase/`
   (dev). Both can run concurrently — every port is shifted by +100 in
   `e2e/supabase/config.toml`. The harness fails fast if this stack isn't
   reachable.

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

- **Two Supabase stacks side-by-side.** `api/supabase/` is the dev stack
  (ports `54321/54322/54323/54324`). `e2e/supabase/` is the test stack
  (ports `54421/54422/54423/54424`). Dev work and test runs never touch the
  same Postgres.
- **Single DB layout.** App data (`public.*`) and GoTrue auth
  (`auth.users`) live in the same database — prod-faithful. The
  `handle_new_user` trigger fires on `auth.users` insert and populates
  `Accounts` + `UserProfiles` in the same transaction.
- **Migrations are shared via symlink.** `e2e/supabase/migrations` →
  `../../api/supabase/migrations`. The storage-bucket + profile-trigger
  migrations apply to both stacks verbatim. A `config.toml` drift check
  (`tests/_infra/config-sync.spec.ts`) fails loudly if the two configs
  diverge on anything other than ports / `project_id`.
- **Web + API servers.** Playwright's `webServer` block starts two
  processes before tests run — a prod-like web build served by `vite
preview` on `:5273`, and a published-Release `dotnet` API on `:5177`
  wired to the e2e stack. Ports are shifted by +100 from the dev
  defaults (`web:dev = 5173`, `api:watch = 5077`) so the e2e stack can
  run alongside dev servers — same rationale as the +100 Supabase port
  shift. `reuseExistingServer: false` guards against an earlier dev
  process on the e2e ports silently serving tests against the wrong
  stack.
- **Per-test users.** Each test creates whatever users it needs via
  `createTestUser()` (calls GoTrue admin API, trigger populates profile
  rows). No pre-provisioned users, no shared `storageState`. Collision-free
  by construction: emails are `test-${randomUUID()}@e2e.local`.
- **Per-test isolation.** `fixtures/reset.ts` truncates `auth.users
CASCADE` (sweeps all auth._ state), `storage.objects`, and every
  `public._`table except`\_\_EFMigrationsHistory`in a single statement.
Storage buckets, migration-tracker tables, and Supabase internals stay
put. Uploaded avatar *bytes* accumulate slowly in the storage-api
container's Docker volume — recycle via`supabase stop && supabase
  start`from`e2e/supabase/` if it ever matters.
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

```
e2e/
├── playwright.config.ts   # Playwright configuration + web/API webServers
├── global-setup.ts        # Verifies stack reachable + applies EF migrations
├── supabase/              # Dedicated e2e Supabase project (ports +100)
│   ├── config.toml        # Shifted ports; in-sync with api/supabase/config.toml
│   └── migrations -> ../../api/supabase/migrations
├── fixtures/
│   ├── db.ts              # pg pool + connection constants
│   ├── reset.ts           # Per-test truncate (auth + storage + public)
│   ├── supabase-env.ts    # Reads `supabase status -o json` from e2e/supabase/
│   ├── auth.ts            # createTestUser via GoTrue admin
│   ├── api.ts             # Authenticated fetch helpers (JWT via GoTrue)
│   ├── seed.ts            # Season, grid, race-weekend helpers (direct DB)
│   ├── team.ts            # seedTeamForUser (via API)
│   └── league.ts          # seedLeague (via API)
└── tests/
    ├── _infra/
    │   └── config-sync.spec.ts  # config.toml drift check
    └── *.spec.ts
```

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
