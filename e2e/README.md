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

- **Database:** `f1fantasy_e2e` on the local Supabase Postgres instance
  (`:54322`). Created by global setup on first run; EF migrations applied via
  `dotnet ef database update`. Local dev state in the default `postgres` DB
  is never touched.
- **Per-test isolation:** `fixtures/reset.ts` truncates every `public` table
  except `__EFMigrationsHistory`, restarting identity sequences. Tests seed
  what they need after the reset.
- **Seeding:** no shared `seed.sql`. Each test declares its own data in
  `beforeEach` — minimal grid, season, race — so there's no implicit state
  shared across tests.

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
├── playwright.config.ts   # Playwright configuration + webServer
├── global-setup.ts        # Provisions f1fantasy_e2e DB + migrations
├── fixtures/
│   ├── db.ts              # pg pool + connection helpers
│   └── reset.ts           # Per-test truncate
└── tests/
    └── *.spec.ts
```
