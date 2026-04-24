# Review & Plan — Issue #131: Playwright E2E Suite

## Context

Issue #131 proposes a Playwright E2E suite at the repo root to cover the gap no other
layer can see: the fully-composed browser → API → DB → Supabase system. The codebase
currently has strong unit coverage (~53 frontend test files, 12 service + 10 endpoint
backend suites) and a recently-landed integration suite (#130) that exercises the API
HTTP pipeline against Testcontainers Postgres with a `TestJwtBearerHandler` bypass.
There is no browser-layer test of any kind today.

This plan validates the issue's proposals against what is *actually shipped* in the
app, against the monorepo's `CLAUDE.md` testing strategy, and recommends a scoped
suite and commit sequence.

---

## 1. Process validation — issue #131

What the issue proposes holds up well. Concrete checks:

- **Playwright over Cypress** — consistent with the CLAUDE.md testing-strategy defaults
  (`E2E: Playwright, small suite, runs against a prod-like build`). No friction.
- **Separate `e2e/` package** — matches the monorepo convention (`web/`, `api/`) and
  keeps Playwright deps out of the Vite build.
- **`webServer` orchestration + dedicated test DB** — aligns with the strategy rule
  "seed via API/DB, not through the UI."
- **`storageState` auth reuse** — required for the 8-test scope to be fast.
- **10–15 test ceiling** — matches strategy ("keep the suite small").
- **CI additions (parallel job, artifact upload on failure, required check)** —
  standard; drops alongside existing `web`, `api`, `api-integration`, `api-docker` jobs.

Gaps in the issue worth closing before implementation:

- **Auth approach is left undecided.** The recommended "hybrid" adds a dev-only
  backdoor to production code *and* maintains a test Supabase project. That is
  more moving parts than 8 tests justify. See §4 below.
- **Selector discipline** isn't called out. Strategy requires semantic selectors
  (`data-testid`, role, accessible name) — anti-pattern to rely on CSS structure.
  This should be encoded in `e2e/README.md`.
- **Database reset between tests** — the issue says "reset between runs" but doesn't
  specify per-test isolation. Strategy requires it ("Isolate per test. No shared
  fixtures."). For E2E this typically means reset-before-each via API seed endpoint
  or direct DB truncate, not transaction rollback (the browser commits).

---

## 2. Test-coverage validation against the strategy

The 8 proposed tests cross-checked against the CLAUDE.md strategy and what the app
actually ships:

| # | Proposed test | Real in app? | Strategy fit | Verdict |
|---|---|---|---|---|
| 1 | Sign in → dashboard loaded | ✅ `/sign-in` email+password → `/my-team` | Happy path, load-bearing | **Keep** |
| 2 | Unauth → redirect to sign-in | ✅ `requireAuth` route guard | "one representative failure… auth redirect" | **Keep** |
| 3 | Sign out clears session | ✅ `AuthContext.signOut` | Load-bearing | **Keep** |
| 4 | First-time team creation | ✅ sign-up → `/create-team` via `_no-team` guard | Golden path | **Keep** |
| 5a | Edit lineup within budget | ✅ `/my-team` DriverPicker/ConstructorPicker + captain | Golden path | **Keep** |
| 5b | Exceeding cap blocks submission | Client-side only (`remainingBudget` disables picks) | **Violates** "Validation/edge-case matrices in E2E — belongs in unit." Already covered at `DriverPicker.test.tsx` + `BudgetCapTests.cs` (integration). | **Cut** |
| 6 | Past lock deadline → disabled + countdown | ✅ `Team.tsx:60-112` live countdown, `readOnly={isLocked}` | Load-bearing UI state only E2E can verify composes | **Keep** |
| 7 | Create league → join via invite (two contexts) | ✅ `/leagues` create → invite dialog → `/join/$token` | Golden path, cross-user | **Keep** |
| 8 | Avatar upload | ✅ `/account` → `useAvatarUpload` → Supabase Storage direct | Only E2E can prove Supabase Storage wiring | **Keep** |

**Net:** drop test 5b. It's a validation matrix item already owned by the unit and
integration layers.

### Additional scenarios that are real, shipped, and high-value

These pass the "in production, reachable by users" bar and cover failure modes no
other layer can see:

- **A. Invite-while-unauthenticated round-trip.** `JoinInvite.tsx` preserves the
  `/join/$token` destination through sign-in *and* through team creation. This is
  the only flow that traverses public → auth → `_no-team` → `_team-required` layers
  in one go, and the redirect preservation lives in client state — nothing below the
  browser can verify it end-to-end. **High value.**
- **B. Captain selection persists.** `/my-team` exposes captain-setting on the
  lineup; the captain affects scoring. Server-side rule is covered in unit tests,
  but the click → persist → reload-and-see-captain flow is only visible at E2E.
  *Only worth including if it adds a distinct UI assertion not already covered by
  test 5a; most likely fold into test 5a rather than a separate test.*

Scenarios deliberately **not** recommended (fail the "real + reachable" or the
strategy bar):

- Landing page → CTA → sign-up: pure marketing-page click, no composed-system risk.
- `/browse-leagues` join-public-league: read-path with no auth nuance, covered
  cheaply at frontend integration with mocked API (same reason issue #131 excluded
  standings).
- `/account` profile edit (display name etc.): no cross-boundary wiring the
  existing unit + integration tests don't already verify.
- `/team/$teamId` read-only other-user team view: no user-reachable failure mode
  distinct from #1 (dashboard load).
- 15-team league cap: server-enforced only, no client UI prevents the attempt —
  already covered by `LeagueInviteTests.FullLeagueRejectsFurtherJoins`.
- Season/race picker, admin UI: **do not exist** in the app.

---

## 3. Recommended final suite (9 tests)

1. Sign in with real credentials → dashboard shows profile + team + current season
2. Unauthenticated access to `/my-team` redirects to `/sign-in`
3. Sign out → protected route now redirects to `/sign-in`
4. New user: sign-up → `/create-team` → build valid team → lands on `/my-team`
5. Edit lineup on `/my-team` within budget, **set captain**, reload → drivers +
   captain persisted (captain UI lives on `DriverPicker` via `onSetCaptain`;
   folding it into test 5 avoids a 10th test)
6. Seeded race where `RaceDate >= now` AND `LockDeadline < now` (backend marks
   `isCurrent: true`, frontend computes `isLocked: true`): pickers disabled,
   "Lineup Locked" visible, countdown hidden
7. User A creates private league → copies invite URL → User B opens `/join/$token`
   in a second browser context and joins
8. Avatar upload on `/account` (`avatars` bucket in Supabase Storage) → new URL
   persisted → sidebar avatar updates
9. Unauthenticated user opens `/join/$token` → signs up → creates team → lands
   back on `/join/$token` and joins

Total: 9 tests, within the 10–15 ceiling.

---

## 4. Infrastructure — existing pieces to reuse

The repo has most of what this plan needs already. Two Supabase stacks
run side by side locally: the dev stack under `api/supabase/` for day-to-day
development, and a dedicated test stack under `e2e/supabase/` that the
E2E suite owns.

- **`api/supabase/config.toml`** — dev stack. Postgres `:54322`, API
  `:54321`, GoTrue auth, Storage. `supabase start` from `api/` runs it.
  Never touched by the E2E suite.
- **`e2e/supabase/config.toml`** — e2e stack (commit 5). Same shape as the
  dev config, ports shifted by +100 (`:54421/:54422/:54423/:54424`),
  `project_id = "f1-companion-api-e2e"` to scope Docker container names.
  The two configs are kept in lockstep by `tests/_infra/config-sync.spec.ts`,
  which fails loudly on any drift outside of ports + `project_id`.
- **`e2e/supabase/migrations/` → `../../api/supabase/migrations/`** —
  symlink. The storage-bucket and profile-trigger migrations apply to
  both stacks verbatim. Prod-faithful by construction; any dev-only
  migration would need to be conspicuously separate rather than silently
  omitted from e2e.
- **`api/F1CompanionApi.IntegrationTests/Support/TestDataBuilder.cs`** — C#
  seed helpers (drivers, constructors, seasons, race weekends) used by
  integration tests. Useful reference for the fixture helper shape.

### Auth approach

The e2e stack runs GoTrue in Docker alongside Postgres, with app data
(`public.*`) and auth data (`auth.users`) sharing a single database. The
profile-creation trigger installed from
`api/supabase/migrations/20260108000000_create_user_profile_trigger.sql`
therefore fires whenever a user is inserted via the GoTrue admin API,
populating `Accounts` + `UserProfiles` in the same transaction. Tests call
`createTestUser()` directly; no manual re-seed ceremony.

Benefits:
- Zero cloud dependency. No secrets in CI.
- Same code path as prod auth — proves JWT/Supabase wiring.
- Trigger covered end-to-end as a side effect.

Test-header-in-prod-code backdoors stay rejected: adding a shipped code
path for testing convenience is marginal speed gain at meaningful risk.

## 5. Database strategy

Single database per stack, prod-faithful:

- `public.*` (app data), `auth.*` (GoTrue), and `storage.*` (Supabase
  Storage metadata) all live in the e2e stack's default `postgres` DB.
- EF migrations apply to that same DB via `dotnet ef database update` in
  global-setup. The stack's `supabase start` has already run the files in
  `e2e/supabase/migrations/` by then (implicit ordering is documented in
  a comment on `global-setup.ts`).
- `ASPNETCORE_ENVIRONMENT=Testing` and `ConnectionStrings__DefaultConnection`
  point the API at the e2e stack's `postgres` DB. Dev data in
  `api/supabase/`'s stack is never touched.

**Global setup (once per run):** verify the e2e stack is reachable, apply
EF migrations, warm the `supabase status` cache.

**Per-test reset:** `resetDb()` runs a single `TRUNCATE ... CASCADE`
covering:

- every `public.*` table except `__EFMigrationsHistory`,
- `auth.users` (CASCADE sweeps `auth.identities`, `auth.sessions`,
  `auth.refresh_tokens`, `auth.mfa_*`, `auth.flow_state`, etc.),
- `storage.objects`.

Left untouched: migration trackers (`__EFMigrationsHistory`,
`auth.schema_migrations`, `storage.migrations`), `storage.buckets`, and
Supabase internals (`supabase_*`, `_realtime`, `_analytics`, `extensions`,
`pgsodium`, `vault`). These are owned by `supabase start`, not the suite.

Fully ephemeral per-test state across auth, storage metadata, and app
data — one helper call, zero per-test cleanup ceremony. Residual
non-ephemeral bit: uploaded avatar *bytes* live in the storage-api
container's Docker volume and accumulate slowly across runs; recycle via
`supabase stop && supabase start` from `e2e/supabase/` if it ever matters.

### No shared `seed.sql` reuse

Originally we considered reusing `api/supabase/seed.sql` to pre-seed the
grid (22 drivers, 11 constructors). Rejected:

- Tests don't need 22 drivers. The minimum is whatever builds a valid team
  and leaves a swap candidate — roughly 6 drivers / 3 constructors.
- `seed.sql` mixes truly static data (Drivers, Constructors) with
  time-sensitive data (`Seasons`, `RaceWeekends` at fixed calendar dates).
  The calendar data goes stale as wall-clock time passes, and test 6 needs
  a race with `LockDeadline` relative to `NOW()` — no static seed file
  can provide that.
- A shared seed that any test mutates bleeds into the next test unless
  the reset restores the seed, which negates the point of sharing.
- Coupling tests to `seed.sql` creates a latent trap: driver roster edits
  for a future season would silently rot test assumptions.

There is no `e2e/supabase/seed.sql`. Per-test fixtures in `e2e/fixtures/`
insert a minimal grid, a current season with pricing, and race weekends
with dates relative to `NOW()`. Each test declares what it needs.

### Raw SQL in fixtures, not test-only endpoints

We considered a gated `/api/_test/seed/*` endpoint family. Rejected —
there's no value shipping endpoints that exist only to seed test data,
and real admin endpoints for Drivers/Constructors/Seasons will land as
normal features later. Raw SQL in fixtures couples tests to the schema;
that's the accepted cost. E2E runs on PR merge, so schema-breaking
migrations surface before a change ships. Fixtures migrate to call real
admin endpoints when those endpoints exist.

### Editing a migration in place (escape hatch)

EF tracks applied migrations by ID in `__EFMigrationsHistory`, so editing
a migration file in-place is silently skipped on the next `dotnet ef
database update`. If a migration body actually changed and you need the
e2e stack to re-run it from scratch:

```bash
cd e2e/supabase && supabase db reset
```

That drops and re-creates the e2e stack's Postgres, re-runs the supabase
migrations, and the next `npm run e2e` re-applies every EF migration from
an empty `__EFMigrationsHistory`. Dev data in `api/supabase/` is
untouched. Also documented in `e2e/README.md`.

### Rationale vs. alternatives

- `supabase db reset` per test is ~5s × N tests. Truncate per test is
  <50ms. The escape hatch above is opt-in, not the hot path.
- Test 6's special race weekend (future date, past lock) is created by
  that test's own `beforeEach` after the truncate — per-test fixtures
  make this natural.
- The single-DB topology lets the profile trigger fire naturally for
  `createTestUser()` calls. The split-DB topology used by commits 1–4
  required a `reseedTestUserProfiles` helper on every test; the pivot in
  commit 5 eliminates that ceremony.

---

## 6. Commit sequence

Each commit self-contained: build + lint + tests + format green.

1. **Scaffold `e2e/` package + Playwright config.** (done)
   `e2e/package.json`, `playwright.config.ts`, `tsconfig.json`, `.gitignore`
   entries, and a single smoke test (`/` loads). Root `package.json` gets
   `e2e`, `e2e:ui`, `e2e:install` scripts; VS Code tasks for `[E2E] Test`
   and `[E2E] Test UI` land alongside the existing Web/API tasks.
   `playwright.config.ts` wires a **web-only** `webServer` running a
   prod-like build (`npm run web:build && vite preview --port 5173
   --strictPort`). The API `webServer` is deferred to commit 3 — it needs
   the e2e DB (commit 2) and the full env-var injection (Supabase keys,
   `VITE_F1_FANTASY_API`) that commit 3 sets up. Adding a half-wired API
   webServer earlier would leave commit 1 unable to stay independently green.
2. **Test DB + global setup.** (done) `e2e/global-setup.ts` verifies
   the local Supabase stack is reachable, creates `f1fantasy_e2e` if
   absent, and applies EF migrations via `dotnet ef database update`.
   `e2e/fixtures/db.ts` holds the shared `pg` pool + connection constants.
   `e2e/fixtures/reset.ts` truncates every `public` table except
   `__EFMigrationsHistory`. No `seed.sql` reuse (see §5). A dedicated
   `reset.spec.ts` verifies the helper works end-to-end. `e2e/README.md`
   documents `supabase start` as the prerequisite.
3. **Local Supabase auth + `storageState` + API webServer.** (done) `global-setup`
   creates User A and User B via local GoTrue's admin API (programmatic
   sign-up), then — because the profile-trigger migration doesn't run
   against `f1fantasy_e2e` — manually inserts `Accounts` + `UserProfiles`
   rows for each. Signs each user in once, saves `storageState` per user.
   Sign-out test gets its own context. Also adds the API `webServer` to
   `playwright.config.ts` (`dotnet publish -c Release` + run the DLL with
   `ASPNETCORE_ENVIRONMENT=Testing` and the e2e connection string), and
   injects `VITE_SUPABASE_*` + `VITE_F1_FANTASY_API` into the web
   `webServer` env so the prod-like frontend talks to the local stack.
4. **Fixture helpers.** (done) `e2e/fixtures/` with `seedMinimalGrid`,
   `seedCurrentSeason`, `seedRaceWeekend({ raceDate, lockDeadline })`,
   `seedTeamForUser`, `seedLeague`. Grid/season/race helpers go direct to
   DB via the `pg` pool (no user-facing endpoints exist to create this
   data); team/league helpers call the real API via Playwright's `request`
   fixture with the test user's auth. Shape references: `TestDataBuilder.cs`
   in the integration test suite.
5. **Pivot to a dedicated e2e Supabase stack.** (done) Replace the split-DB
   topology (app data in `f1fantasy_e2e`, auth in `postgres` of the dev
   stack) with a standalone Supabase CLI project at `e2e/supabase/`.
   Prod-faithful single-DB layout: GoTrue's `auth.users` and the app's
   `public.*` live in the same Postgres, so the profile-creation trigger
   fires naturally and Storage policies/RLS become testable. Concretely:
   - Add `e2e/supabase/config.toml` with `project_id = "f1-companion-api-e2e"`
     and ports shifted so the dev and e2e stacks can coexist.
   - Symlink `e2e/supabase/migrations/` → `api/supabase/migrations/` so
     the profile trigger + avatars bucket migrations apply to the e2e
     stack on `supabase start`.
   - Drop `ensureE2eDatabaseExists` from `global-setup.ts`; `dotnet ef
     database update` now runs against the e2e stack's `postgres` DB.
   - Drop `reseedTestUserProfiles` and its `beforeEach` wiring. Adopt
     per-test auth-user creation: each test creates its own users via
     GoTrue admin, trigger populates `Accounts` + `UserProfiles`, test
     owns its users. No shared `storageState`, no pre-provisioned
     User A / User B constants.
   - Expand `resetDb()` scope. Per-test truncate becomes a single
     statement covering `auth.users CASCADE` (sweeps
     `auth.identities`, `auth.sessions`, `auth.refresh_tokens`,
     `auth.mfa_*`, `auth.flow_state`), `storage.objects`, and every
     `public.*` table except `__EFMigrationsHistory`. Leaves
     migration-tracker tables (`__EFMigrationsHistory`,
     `auth.schema_migrations`, `storage.migrations`),
     `storage.buckets`, and Supabase internals (`supabase_*`,
     `_realtime`, `_analytics`, `extensions`, `pgsodium`, `vault`)
     untouched. Fully ephemeral per-test state across auth, storage
     metadata, and app data — one helper call, zero per-test cleanup
     ceremony. Residual non-ephemeral bit: uploaded avatar *bytes*
     live in the storage-api container's Docker volume and accumulate
     slowly; recycle via `supabase stop && supabase start` from
     `e2e/supabase/` if it ever matters.
   - Add a `config.toml` drift check as a small spec (e.g.
     `e2e/tests/_infra/config-sync.spec.ts`). Loads both
     `api/supabase/config.toml` and `e2e/supabase/config.toml`,
     ignores the fields we intentionally diverge on (ports,
     `project_id`), asserts the rest matches. Fails loudly if dev
     config drifts from e2e.
   - Comment the implicit migration ordering in `global-setup.ts`:
     supabase migrations apply at `supabase start` (trigger installs
     with unresolved `public.*` refs — PL/pgSQL defers resolution to
     runtime), then `dotnet ef database update` creates the `public`
     tables, then tests run. A future supabase migration that needs
     public tables at CREATE time (e.g. a FK from `auth.*` to
     `public.*`) would break this order; flag it in the comment.
   - Document the edit-a-migration-in-place escape hatch in
     `e2e/README.md`. EF sees the migration ID in
     `__EFMigrationsHistory` and silently skips re-applying a
     modified file. Fix: `cd e2e/supabase && supabase db reset` —
     drops the DB, re-runs supabase migrations, next e2e run
     re-applies EF migrations from scratch.
   - `e2e/README.md` prereq shifts from `cd api && supabase start` to
     `cd e2e/supabase && supabase start`.
   - Shift the web + API `webServer` ports by +100 as well (web
     `5173 → 5273`, API `5077 → 5177`). Same rationale as the Supabase
     +100 shift: lets `web:dev` / `api:watch` keep running while the
     e2e suite fires. `reuseExistingServer: false` stays — it now
     guards the e2e-only ports, not the shared dev ones.
   - Rewrite §4 (auth approach) and §5 (database strategy) of this plan
     to reflect the new topology.

   **Rationale.** The current split-DB topology is a custom workaround —
   app data lives in a second DB specifically so the per-test truncate
   doesn't nuke the user's dev data. That breaks the single-DB
   invariant the profile trigger depends on, and forces a
   `reseedTestUserProfiles` helper plus a `beforeEach` that every future
   test file would have to remember. A standalone stack pays a
   one-time setup cost (a `config.toml` + symlinked migrations) to
   restore prod-faithful topology, eliminate the reseed ceremony, and
   isolate test users + Storage buckets from dev. The Supabase CLI
   supports multiple projects natively via `project_id` scoping, so this
   is using the tool as designed rather than fighting it.

   **Verified precondition.** The pivot depends on the profile-creation
   trigger
   (`api/supabase/migrations/20260108000000_create_user_profile_trigger.sql`)
   firing when rows are inserted into `auth.users` via the GoTrue admin
   API. Confirmed in both the trigger's SQL (`AFTER INSERT … FOR EACH
   ROW`, no `WHEN` clause) and empirically in the running dev stack:
   User A and User B were created by the e2e harness via the admin API,
   and their `Accounts` + `UserProfiles` rows exist in the dev
   `postgres` DB with the `DisplayName` values that only the trigger
   function populates from `raw_user_meta_data`. Nothing else writes
   those rows. The trigger fires for admin-API inserts.

   **Decisions pre-staked (don't re-litigate unless something breaks):**
   - **Ports:** shift dev's defaults by +100 → `54421/54422/54423/54424`
     (API / DB / Studio / Inbucket). Lets dev and e2e stacks coexist on
     the same machine.
   - **Project ID:** `f1-companion-api-e2e` in `e2e/supabase/config.toml`.
     Scopes the Docker container names.
   - **Migration sharing:** symlink `e2e/supabase/migrations` →
     `../api/supabase/migrations`. This is a macOS solo-dev project; no
     Windows concern. Prod-faithful by construction — any future
     dev-only migration should be conspicuously separate rather than
     silently omitted from e2e.
   - **Seed file:** no `e2e/supabase/seed.sql`. Per-test fixtures still
     own all data seeding (unchanged from §5).
   - **Auth-user creation granularity:** per-test (not per-file,
     not pre-provisioned). Each test creates whatever users it needs,
     captures a JWT via the token endpoint (not via UI sign-in).
     No explicit per-test cleanup — the expanded `resetDb()` wipes
     `auth.users CASCADE` in the next test's `beforeEach`.
     `storageState` mechanism goes away entirely. If measured runtime
     pushes past a few minutes locally, revisit by promoting to per-file.
   - **Test user emails:** unique per test via
     `test-${crypto.randomUUID()}@e2e.local`. Collision-free by
     construction; truncate keeps the table empty across runs.
   - **`supabase start` lifecycle:** manual prereq, documented in
     `e2e/README.md`. Do **not** auto-start from global-setup in the
     first iteration (adds complexity, risks spurious failures). Can
     layer on later.

   **Known assumptions (noted, low-risk):**
   - Supabase CLI supports concurrent projects with distinct
     `project_id` + ports. (Documented feature, used widely.)
   - `supabase start` applies files in `supabase/migrations/` against
     the stack's `postgres` DB on first boot. (Documented default.)
   - The `avatars` bucket migration applies normally in this mode, so
     commit 9 loses its "mirror bucket" complication.
   - The GoTrue admin API is reachable at `${API_URL}/auth/v1/admin/*`
     on the shifted port, same shape as today.

   **Explicitly out of scope for commit 5:**
   - Parallel Playwright workers. Still `workers: 1`. Per-worker DB
     isolation would require per-worker DBs or stacks; separate future
     work if the suite gets slow.
   - CI workflow changes. Those land in commit 10.
   - Auto-starting the e2e stack from global-setup.
6. **Auth suite (tests 1–3).** (done) Sign in, unauth redirect, sign out.
   `e2e/tests/auth.spec.ts` with a per-test `resetDb()` + per-test
   `createTestUser()` / seeded season + grid + team.

   **Selector precedent set here, propagates to commits 7–9.** Follow the
   Playwright / Testing Library priority: `getByRole` → `getByLabel` →
   `getByPlaceholder` → `getByText` → `getByAltText` / `getByTitle` →
   `getByTestId`. Testid is a last resort, not a default. Copy drift
   breaking a test is a feature — the user experience changed and a test
   should flag it. Codified in `e2e/README.md` Conventions section.

   **Deviations from the original §3 wording, pre-staked for commits 7–9:**
   - Tests 2 and 3 assert redirect to **`/`** (landing page), not `/sign-in`.
     `requireAuth` in `web/src/lib/route-guards.ts:35` redirects to `/`, and
     `handleSignOut` in `web/src/components/AppSidebar/AppSidebar.tsx`
     navigates to `/`. If a future design calls for `/sign-in` as the
     redirect target, that is a product change; tests will follow.
   - Test 1's "dashboard shows profile + team + current season" is
     asserted as: URL = `/leagues`, heading "My Leagues" visible,
     `user.displayName` visible in the sidebar. The current-season
     `year` is fetched by the root route loader but has no UI surface to
     assert on today.
   - Disambiguation by DOM structure, not testid, when a semantic query
     matches multiple nodes. Example: `/sign-in` has two "Sign In"
     buttons (header CTA + form submit) — test uses
     `page.locator('form').getByRole('button', { name: 'Sign In' })`.
   - Added one product a11y improvement to stabilize a dynamic
     accessible name: `aria-label="Account menu"` on the sidebar account
     dropdown trigger (`AppSidebar.tsx`). The previous selector had to
     regex-match the user's `displayName`, which was data-driven but
     fragile. aria-label gives screen-reader users a concise action
     name *and* gives the test a stable handle.

   **Tooling added alongside this commit (not in the original plan):**
   - Prettier for the `e2e/` project: `e2e/prettier.config.js` (copy of
     `web/prettier.config.js`), `e2e/.prettierignore`, `format` /
     `format:check` scripts in `e2e/package.json`, and root passthroughs
     `e2e:format` / `e2e:format:check` in `package.json`. Existing e2e
     files were reformatted in the same commit (cosmetic only, 11 files,
     +22/-24 lines). Needed because the per-commit "format green" rule
     had no e2e-side tooling up to this point.
   - **Sentry telemetry gated on the web side.** `web/.env` ships a real
     `VITE_SENTRY_DSN` so `npm run web:dev` works out of the box, and
     Vite inlines env vars at build time. The e2e webServer's `env`
     block was overriding `VITE_SUPABASE_*` + `VITE_F1_FANTASY_API` but
     not the Sentry DSN, so `npm run web:build` inside `playwright.config.ts`'s
     webServer baked the real DSN and every e2e run since commit 3 has
     been reporting errors (URLs like `http://localhost:5273/...`) to the
     prod Sentry project. Fix: add `VITE_SENTRY_DSN: ''` to the web
     webServer's `env`, mirroring the API side's `Sentry__Dsn: ''`. Kept
     as a bullet here so future telemetry SDKs added to the app get the
     same treatment by default.
7. **Team suite (tests 4–6).** Team creation, lineup edit + captain persist,
   lock-deadline disabled state. Test 6 seeds a race with `RaceDate > now` and
   `LockDeadline < now`.
8. **League + cross-context suite (tests 7, 9).** Two browser contexts; invite
   URL round-trip; unauthenticated `/join/$token` → sign-up → create-team →
   join.
9. **Avatar suite (test 8).** File upload to local Supabase Storage
   (`avatars` bucket, provisioned by the e2e stack's storage migration —
   no separate mirroring step needed under the commit-5 topology).
10. **CI job + required check.** New `e2e` job in `.github/workflows/ci.yml`
    using `supabase/setup-cli` + `supabase start` (from `e2e/supabase/`)
    in the runner. Builds web (`web:build`) and API (`dotnet publish -c
    Release`) before running Playwright — optionally reuses the existing
    `api-docker` image rather than rebuilding from source (discussed
    during implementation). Parallel with existing jobs. Uploads
    `playwright-report/` + traces on failure. Branch protection update
    is a manual step (documented in the commit message).
11. **Docs.** Update root `CLAUDE.md` and `api/CLAUDE.md` (cross-reference the
    new layer, mirror how #130 was documented). Add `e2e/README.md` covering
    run/debug/extend + selector discipline + the `cd e2e/supabase &&
    supabase start` prerequisite.

---

## Critical files to modify

- `e2e/` (new): `package.json`, `playwright.config.ts`, `tests/*.spec.ts`,
  `fixtures/`, `global-setup.ts`, `README.md`, `prettier.config.js` +
  `.prettierignore` (added commit 6)
- `e2e/supabase/` (new, commit 5): `config.toml`, `migrations/` symlink to
  `api/supabase/migrations/`
- `package.json` (root): `e2e`, `e2e:ui`, `e2e:install` scripts mirroring
  `web:*` / `api:*`, plus `e2e:format` / `e2e:format:check` (added commit 6)
- `web/src/components/AppSidebar/AppSidebar.tsx` (commit 6): one-line
  a11y edit — `aria-label="Account menu"` on the account dropdown
  trigger. Improves screen-reader UX and gives e2e a stable semantic
  handle, avoiding a testid.
- `.github/workflows/ci.yml`: add `e2e` job
- `CLAUDE.md` (root), `api/CLAUDE.md`: cross-reference the new layer

## Files to reuse, not duplicate

- `api/F1CompanionApi.IntegrationTests/Support/TestDataBuilder.cs` — shape
  reference for race-weekend / season / constructor seeding. E2E fixtures
  don't share code with this (different language, different process), but
  the column lists and required-field sets are the ground truth.
- `api/supabase/migrations/` — symlinked into `e2e/supabase/migrations/`
  so the storage-bucket + profile-trigger migrations apply to both
  stacks.

`api/supabase/seed.sql` is **not** reused. See §5 for the reasoning.

---

## Verification

- **Local run:** `npm run e2e` from repo root runs all 9 tests in Chromium, green.
  `npm run e2e:ui` opens Playwright UI mode for debugging.
- **Trace inspection:** artificially break a test (e.g., change a selector),
  confirm `trace.zip` is produced and viewable via `npx playwright show-trace`.
- **DB isolation:** run the suite twice back-to-back; second run must not inherit
  first-run state.
- **CI:** PR with a deliberately failing test shows artifacts uploaded and the
  `e2e` check blocking merge.
- **Selector audit:** grep the suite for `.class`, `nth-child`, or structural
  selectors — should be zero.
- **Strategy conformance:** suite size ≤ 15, no validation matrix tests, one
  happy path per flow, no `sleep`, no pixel-diff.

## Assumptions baked into this plan

Calling these out so none of them are quietly decided during implementation:

- **Current-race selector** — verified: backend returns the nearest race where
  `RaceDate >= now` (`RaceWeekendService.cs:46`). Test 6's seed must use a
  future race date with a past lock deadline to trigger the locked-UI state.
- **Supabase Storage bucket** — the `avatars` bucket lives in the e2e
  stack's `postgres` DB alongside app data. The bucket migration
  (`20241215000000_create_avatars_storage.sql`) applies on `supabase
  start` via the `e2e/supabase/migrations/` symlink. `resetDb()` clears
  `storage.objects` per test but leaves `storage.buckets` alone, so the
  bucket is always there when commit 9 runs. Bytes in the storage-api
  Docker volume accumulate slowly across runs — tolerable.
- **Per-test test users** — each test creates whatever users it needs via
  `createTestUser()` (GoTrue admin API). Emails are unique by
  construction (`test-${randomUUID()}@e2e.local`). `resetDb()` truncates
  `auth.users CASCADE` per test, so users do not leak across tests. No
  shared pre-provisioned users, no shared `storageState`.
- **Per-test grid seed** — tests that need drivers/constructors call
  `seedMinimalGrid()` (or similar) in their own `beforeEach` after
  `resetDb()`. Approximate shape: ~6 drivers / ~3 constructors — enough
  to form a valid team and leave swap candidates. Exact count confirmed
  against `docs/research/fantasy-rules/decisions/format.md` when
  fixtures land in commit 4.
- **Sign-out test (#3) isolation** — creates its own user and signs in
  via the UI; nothing else depends on its session state.
- **Branch protection** — the "required check" update must be applied by the
  user via the GitHub UI after the CI job is green once. Documented in the
  commit message; Claude cannot flip it.
- **No cloud Supabase project required.** The plan uses two local Supabase
  stacks (`api/supabase/` for dev, `e2e/supabase/` for tests) spun up via
  `supabase start`. No cloud project, no org changes, no CI secrets for
  Supabase.
- **Repo-root `npm run e2e` / `e2e:ui` scripts** — added to root `package.json`
  alongside existing `web:*` / `api:*` to keep the run surface consistent.

## Decisions resolved

Previously-open questions, now answered by inspecting the repo:

- **Ephemeral DB?** Yes. A dedicated e2e Supabase stack at `e2e/supabase/`
  runs alongside the dev stack (ports shifted +100). Its `postgres` DB
  is the E2E target.
- **Existing seed script?** `api/supabase/seed.sql` exists but is **not**
  reused (see §5). Per-test fixtures replace it.
- **Supabase in Docker?** Yes — two Supabase CLI local stacks running
  concurrently. Zero cloud dependency.
- **Per-test reset** — single `TRUNCATE ... CASCADE` across `auth.users`,
  `storage.objects`, and every `public.*` table except
  `__EFMigrationsHistory`. No user, file, or row survives between tests.
  Fast (<50ms).
- **Seed-only API endpoints?** Rejected. No value shipping endpoints that
  exist only for tests. Fixtures couple to the schema via raw SQL; the
  coupling cost is accepted because e2e runs on PR merge and surfaces
  migration breakage pre-merge.

## Open caveats

Full audit of what the plan bakes in. Each item is surfaced so nothing is
quietly decided during implementation.

### Verified (no action needed)
- `enable_confirmations = false` in `config.toml` (line 176) — programmatic
  sign-up works without inbox polling. Test 4's sign-up flow works.
- Current-race selector rule: backend picks nearest race where
  `RaceDate >= now`. Test 6 seed shape confirmed.

### Non-obvious decisions baked into this plan
- **Two Supabase stacks, migrations shared by symlink.** `api/supabase/`
  (dev) and `e2e/supabase/` (test) run concurrently with ports shifted
  +100. `e2e/supabase/migrations` is a symlink to
  `../../api/supabase/migrations`, so both stacks apply the storage-bucket
  + profile-trigger migrations verbatim. A `config.toml` drift check
  (`tests/_infra/config-sync.spec.ts`) fails loudly if the two configs
  diverge on anything other than ports + `project_id`.
- **Migration ordering in global-setup.** `supabase start` applies files
  in `e2e/supabase/migrations/` against the stack's `postgres` DB on
  first boot (trigger installs with unresolved `public.*` refs —
  PL/pgSQL defers resolution to runtime). Then `dotnet ef database
  update` creates the `public` tables in global-setup. Then tests run. A
  future supabase migration that needs public tables at CREATE time
  (e.g., an FK from `auth.*` to `public.*`) would break this order;
  commented in `global-setup.ts`.
- **API auto-migrate is Development-only** (`Program.cs:93-98`). Since E2E
  runs with `ASPNETCORE_ENVIRONMENT=Testing`, we do not piggyback on
  auto-migrate. Explicit `dotnet ef database update` in global-setup stands.
- **Per-test test users.** `createTestUser()` hits the GoTrue admin API
  with a random UUID-based email; the profile-creation trigger populates
  `Accounts` + `UserProfiles` in the same transaction. `resetDb()`
  truncates `auth.users CASCADE` per test, so users do not leak. No
  shared `storageState`, no pre-provisioned test users.
- **Parallel workers = 1.** Until per-worker DB isolation is added, run
  Playwright serially. ~10 tests × few seconds each is fine serial.
- **Secrets injection.** `supabase status` emits the JWT secret + anon key on
  every `supabase start`. Global-setup reads that output and injects into
  the API `webServer`'s env (`Supabase__JwtSecret`) and the web `webServer`'s
  env (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). No committed secrets.
- **User B has a team** before test 7. The test creates both users plus
  User B's team in its own `beforeEach` after truncate; otherwise
  `/join/$token` click lands them on "Create Team First" instead of
  joining.
- **Test 6 assertion discipline.** Lock countdown updates every 1s — assert
  presence of "Lineup Locked" text and `readOnly` state on pickers only.
  Don't assert exact countdown strings (flaky).
- **Frontend env.** `web/.env.local` is never read by the E2E webServer;
  the harness injects `VITE_SUPABASE_*` at spawn time so prod/dev local
  config is untouched.
- **Sentry in Testing.** API boots with `Sentry:Dsn` unset or empty;
  Sentry SDK no-ops. Not worth a separate gate.
- **CORS.** The e2e API webServer gets `CorsOrigins__0` injected at spawn
  time (pointing at the e2e web webServer's URL, `http://localhost:5273`),
  so the API's baked-in `CorsOrigins` in `appsettings.json` is irrelevant
  to the e2e run.
- **`e2e/supabase/config.toml`** is a near-copy of
  `api/supabase/config.toml` with shifted ports + scoped `project_id`.
  Drift-checked; amend both together if `storage` or `auth` settings
  need to change.

### Acknowledged costs / risks
- **CI boot time.** `supabase start` + container pulls in GH Actions ~60–90s
  cold. Cached between runs via `actions/cache` on Docker layers.
- **Postgres 17 (local Supabase) vs Postgres 16 (integration tests via
  Testcontainers).** Minor version drift; no functional impact expected for
  this app's queries. Prod Supabase is 17 per `config.toml` comment.
- **`cd e2e/supabase && supabase start` is a prerequisite for local
  runs.** Documented in `e2e/README.md`. Not auto-started by `npm run
  e2e` — adds complexity and risks spurious failures on a flaky Docker
  daemon.
- **User may pull on a branch without starting the e2e stack first.**
  The first `npm run e2e` fails fast with a clear "is supabase running?"
  error from global-setup.

### Known out-of-scope for this plan (explicitly deferred)
- Parallelizing E2E workers.
- Visual regression / screenshot diffing.
- Performance benchmarking.
- E2E against a deployed Fly staging environment. This plan runs prod-like
  builds *locally* (Vite preview + published .NET DLL), which is the level
  root `CLAUDE.md` prescribes. "Against a real Fly deploy" would be a
  separate initiative and is not in scope here.
