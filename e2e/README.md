# E2E Tests

End-to-end browser tests for the F1 Fantasy app. Runs Playwright against a
prod-like build of the web client (Vite preview), backed by a dedicated test
database on the local Supabase Postgres instance.

## Prerequisites

1. **Docker Desktop** running.
2. **Supabase CLI local stack** running:

   ```bash
   cd api && supabase start
   ```

   Provides Postgres (`:54322`), GoTrue auth (`:54321`), and Storage. The
   E2E harness fails fast on `supabase start` not being reachable.

3. **.NET SDK** with the `dotnet-ef` tool (used by global setup to apply
   migrations to the E2E database).

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

- **Web + API servers:** Playwright's `webServer` block starts two processes
  before tests run — a prod-like web build served by `vite preview` on
  `:5173`, and a published-Release `dotnet` API on `:5077` wired to the
  E2E database. Both are configured with `reuseExistingServer: false`, so
  if `api:watch` or `web:dev` is already bound to those ports the suite
  fails fast with a port-in-use error instead of silently running against
  a dev-configured server pointed at the wrong DB. Stop dev servers before
  `npm run e2e`.
- **Database:** `f1fantasy_e2e` on the local Supabase Postgres instance
  (`:54322`). Created by global setup on first run; EF migrations applied via
  `dotnet ef database update`. Local dev state in the default `postgres` DB
  is never touched.
- **Auth:** `global-setup.ts` reads the CLI-default keys from
  `supabase status -o json`, provisions two users (User A, User B) via the
  local GoTrue admin API, manually inserts their `Accounts` +
  `UserProfiles` rows (the profile-trigger migration targets the default
  `postgres` DB, not the E2E DB), then signs each user in through the real
  sign-in form and saves their session to `e2e/.auth/{userA,userB}.json`.
  Tests opt in by setting `test.use({ storageState: storageStatePath('userA') })`.
- **Per-test isolation:** `fixtures/reset.ts` truncates every `public` table
  except `__EFMigrationsHistory`, restarting identity sequences. Tests seed
  what they need after the reset.
- **Seeding:** no shared `seed.sql`. Each test declares its own data in
  `beforeEach` — minimal grid, season, race — so there's no implicit state
  shared across tests. Helpers live in `fixtures/seed.ts` (direct-DB:
  season, grid, race weekend), `fixtures/team.ts`, and `fixtures/league.ts`
  (both via the real API with the user's JWT).

## Conventions

- **Selectors:** semantic only (`data-testid`, role, accessible name). Never
  CSS structure or `:nth-child`.
- **Waits:** Playwright's built-in `expect` polling. Never `sleep`.
- **Scope:** this suite owns cross-system failure modes only (auth, CORS,
  Supabase wiring, deploy/config, critical user journeys). Validation
  matrices and unit logic belong one layer down.

## Layout

```
e2e/
├── playwright.config.ts   # Playwright configuration + web/API webServers
├── global-setup.ts        # Provisions f1fantasy_e2e DB + migrations + auth users
├── fixtures/
│   ├── db.ts              # pg pool + connection helpers
│   ├── reset.ts           # Per-test truncate
│   ├── supabase-env.ts    # Reads `supabase status -o json`
│   ├── auth.ts            # Test-user provisioning + storageState capture
│   ├── api.ts             # Authenticated fetch helpers (JWT via GoTrue)
│   ├── seed.ts            # Season, grid, race-weekend helpers (direct DB)
│   ├── team.ts            # seedTeamForUser (via API)
│   └── league.ts          # seedLeague (via API)
├── .auth/                 # Captured storageState JSON (gitignored)
└── tests/
    └── *.spec.ts
```
