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
  local dev. Also where Supabase's GoTrue (auth) and Storage services live;
  `auth.users` and the Storage buckets are here, not in `f1fantasy_e2e`.
- **`f1fantasy_e2e`** (new) — dedicated test DB, created once by global
  setup. E2E runs with `ASPNETCORE_ENVIRONMENT=Testing` and
  `ConnectionStrings__DefaultConnection` pointing at it. Dev state is never
  touched.

**Global setup (once per run):** verify Supabase is reachable, create
`f1fantasy_e2e` if absent, apply EF migrations via `dotnet ef database
update`. **Does not** apply `seed.sql` or the files in
`api/supabase/migrations/` — see exclusions below.

**Per-test reset:** `resetDb()` truncates every `public` table except
`__EFMigrationsHistory`, restarting identity sequences. The full schema is
wiped between tests — grid, season, race, and user-scoped tables alike.
Each test seeds exactly what it needs in its own `beforeEach` via fixture
helpers (commit 4). Fast (<50ms), no shared mutable state between tests.

### No shared `seed.sql` reuse

Originally we planned to reuse `api/supabase/seed.sql` to pre-seed the grid
(22 drivers, 11 constructors). That turned out to be the wrong trade:

- Tests don't need 22 drivers. The minimum is whatever builds a valid team
  and leaves a swap candidate — roughly 6 drivers / 3 constructors.
- `seed.sql` mixes truly static data (Drivers, Constructors) with
  time-sensitive data (`Seasons`, `RaceWeekends` at fixed 2026 calendar
  dates). The calendar data goes stale as wall-clock time passes, and test
  6 needs a race with `LockDeadline` relative to `NOW()` — no static seed
  file can provide that.
- Any test that mutates a shared seeded row (e.g., test 6's lock-deadline
  update) bleeds into the next test unless the reset restores the full
  seed, which negates the point of reusing a shared seed.
- Coupling tests to `seed.sql` creates a latent trap: driver roster edits
  for a future season would silently rot test assumptions.

Per-test fixtures in `e2e/fixtures/` (commit 4) insert a minimal grid, a
current season with pricing, and race weekends with dates relative to
`NOW()`. Each test declares what it needs.

### Raw SQL in fixtures, not test-only endpoints

We considered a gated `/api/_test/seed/*` endpoint family. Rejected —
there's no value shipping endpoints that exist only to seed test data, and
real admin endpoints for Drivers/Constructors/Seasons will land as normal
features later. Raw SQL in fixtures couples tests to the schema; that's
the accepted cost. E2E runs on PR merge, so schema-breaking migrations
surface before a change ships. Fixtures migrate to call real admin
endpoints when those endpoints exist.

### What's NOT in global setup (deliberately)

- **`api/supabase/seed.sql`** — reasons above.
- **`api/supabase/migrations/20241215000000_create_avatars_storage.sql`** —
  creates a Storage bucket. Storage runs on the default `postgres` DB, not
  `f1fantasy_e2e`; this migration has no effect against the e2e DB. Commit
  8 (avatar upload) handles Storage setup separately.
- **`api/supabase/migrations/20260108000000_create_user_profile_trigger.sql`**
  — installs a trigger on `auth.users` (the `auth` schema exists only in
  the default `postgres` DB). In production, this trigger auto-creates
  `Accounts` + `UserProfiles` rows on sign-up. In E2E, the harness inserts
  those rows manually after a Supabase sign-up (commit 3).

### Rationale vs. alternatives
- `supabase db reset` per test is ~5s × 9 tests = ~45s overhead. Truncate
  per test is <50ms.
- Test 6's special race weekend (future date, past lock) is created by
  that test's own `beforeEach` after the truncate — per-test fixtures make
  this natural.

---

## 6. Commit sequence

Each commit self-contained: build + lint + tests + format green.

1. **Scaffold `e2e/` package + Playwright config.** (shipped)
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
2. **Test DB + global setup.** (shipped) `e2e/global-setup.ts` verifies
   the local Supabase stack is reachable, creates `f1fantasy_e2e` if
   absent, and applies EF migrations via `dotnet ef database update`.
   `e2e/fixtures/db.ts` holds the shared `pg` pool + connection constants.
   `e2e/fixtures/reset.ts` truncates every `public` table except
   `__EFMigrationsHistory`. No `seed.sql` reuse (see §5). A dedicated
   `reset.spec.ts` verifies the helper works end-to-end. `e2e/README.md`
   documents `supabase start` as the prerequisite.
3. **Local Supabase auth + `storageState` + API webServer.** `global-setup`
   creates User A and User B via local GoTrue's admin API (programmatic
   sign-up), then — because the profile-trigger migration doesn't run
   against `f1fantasy_e2e` — manually inserts `Accounts` + `UserProfiles`
   rows for each. Signs each user in once, saves `storageState` per user.
   Sign-out test gets its own context. Also adds the API `webServer` to
   `playwright.config.ts` (`dotnet publish -c Release` + run the DLL with
   `ASPNETCORE_ENVIRONMENT=Testing` and the e2e connection string), and
   injects `VITE_SUPABASE_*` + `VITE_F1_FANTASY_API` into the web
   `webServer` env so the prod-like frontend talks to the local stack.
4. **Fixture helpers.** `e2e/fixtures/` with `seedMinimalGrid`,
   `seedCurrentSeason`, `seedRaceWeekend({ raceDate, lockDeadline })`,
   `seedTeamForUser`, `seedLeague`. Grid/season/race helpers go direct to
   DB via the `pg` pool (no user-facing endpoints exist to create this
   data); team/league helpers call the real API via Playwright's `request`
   fixture with the test user's auth. Shape references: `TestDataBuilder.cs`
   in the integration test suite.
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

- `api/F1CompanionApi.IntegrationTests/Support/TestDataBuilder.cs` — shape
  reference for race-weekend / season / constructor seeding. E2E fixtures
  don't share code with this (different language, different process), but
  the column lists and required-field sets are the ground truth.
- `web/src/contexts/AuthContext.tsx`, `web/src/lib/supabase.ts` — Supabase
  client + session storage-key shape for `storageState`.

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
- **Supabase Storage bucket** — the `avatars` bucket lives on the default
  `postgres` database (Storage runs against it, not `f1fantasy_e2e`).
  Commit 8 will ensure the bucket exists — either by running the
  `20241215000000_create_avatars_storage.sql` migration against `postgres`
  (idempotent) or by creating it programmatically via the Storage admin
  API at global-setup time. Bucket state is shared with dev, which is
  tolerable: tests upload to distinct keyed paths per run.
- **Two test users** — User A and User B live in `auth.users` on the
  default `postgres` database (GoTrue only serves `postgres`). Seeded
  once in `global-setup.ts` via the admin API; their `auth.users` rows
  are **not** touched by `resetDb()` since that only wipes
  `f1fantasy_e2e`'s public schema. However, their corresponding
  `Accounts` + `UserProfiles` rows in `f1fantasy_e2e` **are** wiped per
  test, so the harness re-inserts them in `beforeEach` (the profile
  auto-trigger doesn't apply across databases).
- **Per-test grid seed** — tests that need drivers/constructors call
  `seedMinimalGrid()` (or similar) in their own `beforeEach` after
  `resetDb()`. Approximate shape: ~6 drivers / ~3 constructors — enough
  to form a valid team and leave swap candidates. Exact count confirmed
  against `docs/research/fantasy-rules/decisions/format.md` when
  fixtures land in commit 4.
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
- **Existing seed script?** `api/supabase/seed.sql` exists but is **not**
  reused (see §5). Per-test fixtures replace it.
- **Supabase in Docker?** Yes — the Supabase CLI local stack. Best practice
  for Supabase E2E at this project's scale; zero cloud dependency.
- **Per-test reset** — truncate every `public` table except
  `__EFMigrationsHistory`, restarting identity sequences. No table survives
  between tests (including grid). Fast (<50ms), no prod-code surface.
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

### Verified but does NOT apply to `f1fantasy_e2e`
These behaviors hold for `supabase db reset` against the default `postgres`
database, but the E2E database is a separate DB on the same instance and
does not inherit them:
- `api/supabase/migrations/20241215000000_create_avatars_storage.sql`
  creates the `avatars` Storage bucket. Storage runs against `postgres`,
  so the bucket is shared with dev and exists independently of
  `f1fantasy_e2e`. Commit 8 ensures it's present before the avatar test
  runs.
- `api/supabase/migrations/20260108000000_create_user_profile_trigger.sql`
  creates a trigger on `auth.users`. The `auth` schema lives only in
  `postgres`, so the trigger does not fire for user creation when the app
  data (Accounts/UserProfiles) is in `f1fantasy_e2e`. The E2E harness
  inserts those rows manually after sign-up (commit 3).

### Non-obvious decisions baked into this plan
- **Two migration systems, only one applied to `f1fantasy_e2e`.** EF
  migrations (`api/F1CompanionApi/Data/Migrations/`, many files) are
  applied to `f1fantasy_e2e` via `dotnet ef database update` in
  global-setup. `api/supabase/migrations/` (storage bucket + profile
  trigger) are **not** applied — the storage migration targets Storage's
  DB (`postgres`) and has no effect against `f1fantasy_e2e`, and the
  profile-trigger migration depends on `auth.users` which only exists in
  `postgres`. Commits 3 and 8 handle those concerns manually.
- **API auto-migrate is Development-only** (`Program.cs:93-98`). Since E2E
  runs with `ASPNETCORE_ENVIRONMENT=Testing`, we do not piggyback on
  auto-migrate. Explicit migration step above stands.
- **Test users are partially preserved.** User A + User B's `auth.users`
  rows in `postgres` are seeded once in global-setup and survive across
  tests (`resetDb()` doesn't touch that DB). Their `Accounts` +
  `UserProfiles` rows in `f1fantasy_e2e` **are** truncated per test; the
  harness re-inserts them in `beforeEach` to keep the UUID→profile link
  intact (no auto-trigger in e2e). Test 4's sign-up creates a disposable
  third auth user per run — those accumulate in `auth.users` but the
  cost is negligible at e2e's scale.
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
