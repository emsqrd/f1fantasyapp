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

The repo already has the infrastructure this plan needs. This reshapes the
commit sequence versus issue #131's original "new Supabase test project +
docker-compose" framing:

- **`api/supabase/config.toml`** — Supabase CLI local stack (Postgres :54322,
  API :54321, GoTrue auth, Storage, bucket config). `supabase start` spins
  everything in Docker locally. This *is* the project's standard dev DB.
- **`api/supabase/seed.sql`** — 22 drivers already defined. The CLI runs it
  automatically on `supabase db reset`.
- **`api/supabase/seed-prices.sql`**, **`test-data-teams.sql`** — additional
  fixtures.
- **`api/F1CompanionApi.IntegrationTests/Support/TestDataBuilder.cs`** — C#
  seed helpers (drivers, constructors, seasons, race weekends) used by
  integration tests. Useful reference for what a "seeded test-data endpoint"
  would expose, if that route is chosen.

### Auth approach — revised

**Option A, using local Supabase (not a cloud test project).** The local stack
runs GoTrue auth in Docker. Real sign-in/sign-up works against it, storageState
captures a real JWT, the API validates it with the local project's JWT secret.

Benefits over my earlier "cloud test project" framing:
- Zero external dependency. No cloud secrets in CI.
- Matches how the user already develops locally.
- Same code path as prod auth — still proves JWT/Supabase wiring.

CI path: `supabase/setup-cli` GitHub Action → `supabase start` in the runner.

Option B (test header in prod code) stays rejected for the same reasons as
before — adds a backdoor to shipped code for marginal speed gain.

## 5. Database strategy — revised

Use the local Supabase Postgres instance. Two databases on the same server:

- **`postgres`** (default) — already used for `npm run web:dev` / `api:watch`
  local dev.
- **`f1fantasy_e2e`** (new) — dedicated test DB, created once. E2E runs with
  `ASPNETCORE_ENVIRONMENT=Testing` and `ConnectionStrings__DefaultConnection`
  pointing at it. Dev state is never touched.

**Per-test reset:** Playwright global-setup runs migrations + `seed.sql` once
per worker (populates the grid: drivers, constructors). `beforeEach` truncates
user-scoped tables only (`Accounts`, `UserProfiles`, `Teams`, `Leagues`,
`LeagueMemberships`, `LeagueInvites`, `TeamDriverSelections`,
`TeamConstructorSelections`, `Seasons`, `RaceWeekends`) via direct `pg` from
Node. Grid tables stay seeded across tests.

Rationale vs. alternatives:
- `supabase db reset` per test is ~5s × 9 tests = ~45s overhead. Truncate
  per test is <50ms.
- A test-only `/api/_test/reset` endpoint was an option but is unnecessary
  now that truncate from Node against the local DB is straightforward.
- Test 6's special race weekend (future date, past lock) is created by that
  test's own `beforeEach` after the truncate.

---

## 6. Commit sequence

Each commit self-contained: build + lint + tests + format green.

1. **Scaffold `e2e/` package + Playwright config.** `package.json`,
   `playwright.config.ts` with `webServer` for **prod-like builds** (not dev
   servers): `web` runs `npm run web:build && vite preview --port 5173`, `api`
   runs `dotnet publish -c Release` then the published DLL with
   `ASPNETCORE_ENVIRONMENT=Testing` + e2e connection string. TypeScript setup,
   `.gitignore`. Single smoke test (`/` loads) to prove the harness runs.
   Aligns with root `CLAUDE.md` strategy ("runs against a prod-like build")
   and catches build-output drift dev servers hide.
2. **Test DB + global setup.** Script that creates `f1fantasy_e2e` on the
   local Supabase Postgres, applies EF migrations, runs `seed.sql` to populate
   the grid. `e2e/fixtures/reset.ts` with a Node `pg`-based truncate of
   user-scoped tables only. Documented that `supabase start` is a prerequisite
   (mirroring the existing dev workflow).
3. **Local Supabase auth + `storageState`.** `global-setup.ts` creates User A
   and User B via local GoTrue (signs up programmatically), signs each in
   once, saves `storageState` per user. Sign-out test gets its own context.
4. **Fixture helpers.** `e2e/fixtures/` with `seedLeague`, `seedCurrentSeason`,
   `seedRaceWeekend({ raceDate, lockDeadline })`, `seedTeamForUser`. Most
   call the real API via Playwright `request` fixture with the user's auth;
   race-weekend and season seeding go direct-to-DB via `pg` since no
   user-facing endpoint creates them. Reuses shapes from `TestDataBuilder.cs`.
5. **Auth suite (tests 1–3).** Sign in, unauth redirect, sign out. Semantic
   selectors (`data-testid`, role, accessible name) only.
6. **Team suite (tests 4–6).** Team creation, lineup edit + captain persist,
   lock-deadline disabled state. Test 6 seeds a race with `RaceDate > now` and
   `LockDeadline < now`.
7. **League + cross-context suite (tests 7, 9).** Two browser contexts; invite
   URL round-trip; unauthenticated `/join/$token` → sign-up → create-team →
   join.
8. **Avatar suite (test 8).** File upload to local Supabase Storage
   (`avatars` bucket, mirrored via `supabase storage` CLI or a short setup
   script in global-setup).
9. **CI job + required check.** New `e2e` job in `.github/workflows/ci.yml`
   using `supabase/setup-cli` + `supabase start` in the runner. Builds web
   (`web:build`) and API (`dotnet publish -c Release`) before running
   Playwright — optionally reuses the existing `api-docker` image rather than
   rebuilding from source (discussed during implementation). Parallel with
   existing jobs. Uploads `playwright-report/` + traces on failure. Branch
   protection update is a manual step (documented in the commit message).
10. **Docs.** Update root `CLAUDE.md` and `api/CLAUDE.md` (cross-reference the
    new layer, mirror how #130 was documented). Add `e2e/README.md` covering
    run/debug/extend + selector discipline + the `supabase start` prerequisite.

---

## Critical files to modify

- `e2e/` (new): `package.json`, `playwright.config.ts`, `tests/*.spec.ts`,
  `fixtures/`, `global-setup.ts`, `README.md`
- `package.json` (root): `e2e`, `e2e:ui`, `e2e:install` scripts mirroring
  `web:*` / `api:*`
- `.github/workflows/ci.yml`: add `e2e` job
- `CLAUDE.md` (root), `api/CLAUDE.md`: cross-reference the new layer
- `api/supabase/config.toml`: verify `storage` and `auth` sections match
  what the E2E assumes (avatars bucket, email sign-up enabled); amend if not

## Files to reuse, not duplicate

- `api/supabase/seed.sql` — driver grid. Run unchanged at global setup.
- `api/F1CompanionApi.IntegrationTests/Support/TestDataBuilder.cs` — shape
  reference for race-weekend / season / constructor seeding.
- `web/src/contexts/AuthContext.tsx`, `web/src/lib/supabase.ts` — Supabase
  client + session storage-key shape for `storageState`.

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
- **Supabase Storage bucket** — the test Supabase project needs an `avatars`
  bucket with the same RLS policies as prod. Bucket config is not in the
  codebase; a short migration script (TS or SQL) will be added to the E2E
  global setup to create it idempotently.
- **Two test users** — User A and User B exist in the test Supabase project
  for test 7. Seeded once via Supabase admin API in `global-setup.ts`, not
  recreated per run.
- **Grid seed (22 drivers, 11 constructors, current season)** — required by
  every team-related test. Seeded once per test via the chosen seed mechanism
  (see Decisions below).
- **Sign-out test (#3) isolation** — does not reuse worker-wide
  `storageState`; runs in its own context so it doesn't poison siblings.
- **Branch protection** — the "required check" update must be applied by the
  user via the GitHub UI after the CI job is green once. Documented in the
  commit message; Claude cannot flip it.
- **No new Supabase project required.** The plan uses the existing local
  Supabase stack (`api/supabase/config.toml`, spun up via `supabase start`).
  No cloud project, no org changes, no CI secrets for Supabase.
- **Repo-root `npm run e2e` / `e2e:ui` scripts** — added to root `package.json`
  alongside existing `web:*` / `api:*` to keep the run surface consistent.

## Decisions resolved

Previously-open questions, now answered by inspecting the repo:

- **Ephemeral DB?** Yes. `supabase start` (Docker) gives us an ephemeral
  Postgres; a dedicated `f1fantasy_e2e` DB on that instance is the E2E target.
- **Existing seed script?** Yes — `api/supabase/seed.sql`. Reused as-is for
  the driver grid at worker startup. EF migrations applied before it.
- **Supabase in Docker?** Yes — the Supabase CLI local stack. Best practice
  for Supabase E2E at this project's scale; zero cloud dependency.
- **Per-test reset** — truncate user-scoped tables from Node via `pg`. Grid
  tables (Drivers, Constructors) survive. Fast (<50ms), no prod-code surface.

## Open caveats

Full audit of what the plan bakes in. Each item is surfaced so nothing is
quietly decided during implementation.

### Verified (no action needed)
- `enable_confirmations = false` in `config.toml` (line 176) — programmatic
  sign-up works without inbox polling. Test 4's sign-up flow works.
- `avatars` bucket is created by
  `api/supabase/migrations/20241215000000_create_avatars_storage.sql` — runs
  automatically on `supabase db reset`. No manual bucket provisioning needed.
- `20260108000000_create_user_profile_trigger.sql` creates the profile
  auto-trigger — sign-up creates both auth user and profile row.
- Current-race selector rule: backend picks nearest race where
  `RaceDate >= now`. Test 6 seed shape confirmed.

### Non-obvious decisions baked into this plan
- **Two migration systems.** `api/supabase/migrations/` (2 files: storage
  bucket + profile trigger) runs on `supabase db reset`. EF migrations (93
  files in `api/F1CompanionApi/Data/Migrations/`) do NOT run on `db reset`.
  Plan applies them via an explicit `dotnet ef database update` in
  global-setup against the e2e DB.
- **API auto-migrate is Development-only** (`Program.cs:93-98`). Since E2E
  runs with `ASPNETCORE_ENVIRONMENT=Testing`, we do not piggyback on
  auto-migrate. Explicit migration step above stands.
- **Test users not truncated.** User A + User B are seeded once in global
  setup; per-test truncate spares `Accounts` and `UserProfiles` rows tied to
  those two auth users (or re-inserts them in `beforeEach`). Test 4
  (sign-up) creates a third, disposable user each run.
- **Sign-out test (#3)** runs in its own context with empty `storageState` to
  avoid poisoning sibling tests.
- **Parallel workers = 1.** Until per-worker DB isolation is added, run
  Playwright serially. 9 tests × few seconds each is fine serial.
- **Secrets injection.** `supabase status` emits the JWT secret + anon key on
  every `supabase start`. Global-setup reads that output and injects into
  the API `webServer`'s env (`Supabase__JwtSecret`) and the web `webServer`'s
  env (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). No committed secrets.
- **User B has a team** before test 7. Seeded in the test's `beforeEach`
  after truncate; otherwise `/join/$token` click lands them on
  "Create Team First" instead of joining.
- **Test 6 assertion discipline.** Lock countdown updates every 1s — assert
  presence of "Lineup Locked" text and `readOnly` state on pickers only.
  Don't assert exact countdown strings (flaky).
- **Frontend env.** `web/.env.local` is never read by the E2E webServer;
  the harness injects `VITE_SUPABASE_*` at spawn time so prod/dev local
  config is untouched.
- **Sentry in Testing.** API boots with `Sentry:Dsn` unset or empty;
  Sentry SDK no-ops. Not worth a separate gate.
- **CORS.** `CorsOrigins` in `appsettings.json` already includes
  `http://localhost:5173`. Playwright webServer reuses that port.
- **Config.toml unchanged.** Everything we need is already configured
  (`enable_signup = true`, `enable_confirmations = false`, storage enabled).
  No amendment required.

### Acknowledged costs / risks
- **CI boot time.** `supabase start` + container pulls in GH Actions ~60–90s
  cold. Cached between runs via `actions/cache` on Docker layers.
- **Postgres 17 (local Supabase) vs Postgres 16 (integration tests via
  Testcontainers).** Minor version drift; no functional impact expected for
  this app's queries. Prod Supabase is 17 per `config.toml` comment.
- **`supabase start` is a prerequisite for local runs.** Documented in
  `e2e/README.md`. Not auto-started by `npm run e2e` — that would risk
  clobbering the user's dev stack state.
- **User may pull on a branch without running `supabase start` first.** The
  first `npm run e2e` will fail fast with a clear "is supabase running?"
  error from global-setup.

### Known out-of-scope for this plan (explicitly deferred)
- Parallelizing E2E workers.
- Visual regression / screenshot diffing.
- Performance benchmarking.
- E2E against a deployed Fly staging environment. This plan runs prod-like
  builds *locally* (Vite preview + published .NET DLL), which is the level
  root `CLAUDE.md` prescribes. "Against a real Fly deploy" would be a
  separate initiative and is not in scope here.
