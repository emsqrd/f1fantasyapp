# Issue #130 — API Integration Tests (WebApplicationFactory + Testcontainers)

## Context

The API has ~460 xUnit unit tests, but none exercise the API as a cohesive layer against real collaborators. Service tests use EF Core **InMemory** (which silently accepts queries real Postgres rejects — case sensitivity, JSON ops, `DISTINCT ON`, constraints). Endpoint tests invoke private static delegates via **reflection with mocked services**, bypassing routing, middleware, auth, and JSON serialization. EF migrations are never exercised.

This introduces `F1CompanionApi.IntegrationTests` — a sibling xUnit project that boots the real API in-process via `WebApplicationFactory<Program>` against a disposable Postgres container managed by Testcontainers. Schema comes from running the real EF migrations; between tests, Respawn resets mutable table state. A test authentication handler overrides the JWT Bearer scheme so tests assert authorization without a live Supabase dependency.

Project is **named `F1CompanionApi.IntegrationTests`** (not the `F1FantasyApi.*` name in the issue — that's a typo; on-disk project is `F1CompanionApi`).

## Key facts discovered

- Solution: `api/f1-companion-api.sln` — contains `F1CompanionApi` and `F1CompanionApi.UnitTests`.
- Target framework: `net10.0`. SDK pinned via `global.json` to `10.0.100`.
- Central package management: **not used**; NuGet refs live in each `.csproj`.
- `api/.editorconfig` applies recursively — new project inherits formatting rules automatically.
- `api/.config/dotnet-tools.json` — csharpier, dotnet-ef, reportgenerator are restored in CI via `dotnet tool restore`.
- **`Program.cs` uses top-level statements** and is not `public`/`partial` today. `WebApplicationFactory<Program>` needs a publicly referenceable `Program` type — will add a trailing `public partial class Program { }` line (standard ASP.NET Core pattern).
- **Auto-migration on startup only runs in Development** (`api/F1CompanionApi/Program.cs:94–99`). Tests must migrate explicitly in the fixture.
- JWT Bearer registered in `api/F1CompanionApi/Extensions/ServiceExtensions.cs:107–133`. Two authorization policies: `JwtOrApiKey` (default for user endpoints) and `ApiKeyOnly` (for scoring ingest). Test handler will replace the `Bearer` scheme.
- Connection string key: `ConnectionStrings:DefaultConnection`. DbContext registered scoped with a 3-retry Npgsql resiliency policy (`ServiceExtensions.cs:71–97`).
- Global exception handler (`api/F1CompanionApi/Domain/Exceptions/GlobalExceptionHandler.cs`) already maps all domain exceptions to `ProblemDetails` with correct status codes — integration tests assert HTTP status + `ProblemDetails` shape, not exception types.
- Endpoints mapped under `MapGroup("/api")` (`api/F1CompanionApi/Api/Endpoints/Endpoints.cs:10`).
- Unit test helpers (seeding builders for `UserProfile`, `Team`, `Driver`, `Constructor`, `RaceWeekend` in `F1CompanionApi.UnitTests/Services/TeamServiceTests.cs:1549–1645`) are private per-class today. For integration tests we **copy/adapt** into a shared `Support/TestDataBuilder` rather than refactor the unit tests (out of scope).

## Plan (commit-by-commit)

Each commit must independently pass `npm run api:build`, `npm run api:test:unit`, `npm run api:test:integration`, and `npm run api:format:check`. Each commit lands through a PR gated on user approval.

### Commit 1 — Scaffold integration test project, fixture infra, CI wiring, one smoke test

**New project: `api/F1CompanionApi.IntegrationTests/F1CompanionApi.IntegrationTests.csproj`**
- `TargetFramework: net10.0`, `IsTestProject: true`, `ImplicitUsings`, `Nullable: enable`
- `<ProjectReference Include="../F1CompanionApi/F1CompanionApi.csproj" />`
- Package refs:
  - `Microsoft.AspNetCore.Mvc.Testing` 10.0.x (brings `WebApplicationFactory`)
  - `Testcontainers.PostgreSql` (latest 4.x)
  - `Respawn` (latest 6.x)
  - `xunit` 2.9.2, `xunit.runner.visualstudio` 2.8.2, `Microsoft.NET.Test.Sdk` 18.4.0 (match unit-test versions)
  - `FluentAssertions` (latest 6.x) — assertions against `ProblemDetails` and JSON payloads are much cleaner with it; acceptable to skip if user prefers xUnit-only asserts
  - `coverlet.collector` / `coverlet.msbuild` to mirror unit test project (coverage exclusions: `**/Program.cs`, `**/Migrations/**`)

**Register project in solution:** `api/f1-companion-api.sln` — add new project section with fresh GUID.

**Modify `api/F1CompanionApi/Program.cs`** (one line append, outside the top-level statements):
```csharp
public partial class Program { }
```
Required by `WebApplicationFactory<Program>`. No behavior change.

**New files under `api/F1CompanionApi.IntegrationTests/`:**

- `Support/PostgresFixture.cs` — xUnit `IAsyncLifetime` collection fixture. Starts one `PostgreSqlBuilder().WithImage("postgres:16-alpine").Build()` container for the whole test run. Exposes `ConnectionString`. On dispose, stops the container.
- `Support/IntegrationTestCollection.cs` — `[CollectionDefinition]` binding `PostgresFixture` so the container is shared across all integration test classes.
- `Support/ApiWebApplicationFactory.cs` — `WebApplicationFactory<Program>` that:
  - Sets `UseEnvironment("Testing")`
  - In `ConfigureWebHost`: overrides config with the container connection string (`ConnectionStrings:DefaultConnection`), dummy `Supabase:AuthUrl` (so JWT handler wiring doesn't trip on empty config), empty `Sentry:Dsn`.
  - In `ConfigureTestServices`: removes the existing `DbContextOptions<ApplicationDbContext>` registration and re-adds it pointing at the container connection string (keeps the same retry policy + interceptor). Removes the JWT Bearer handler's options and re-registers `TestAuthHandler` on the `Bearer` scheme.
  - Exposes a `ResetDatabaseAsync()` that uses Respawn with `DbAdapter.Postgres` and a `TablesToIgnore` list for EF migration history.
  - On first use, applies EF migrations (`db.Database.MigrateAsync()`) against the container DB — guarded by a one-time gate so concurrent tests don't race.
- `Support/TestAuthHandler.cs` — `AuthenticationHandler<AuthenticationSchemeOptions>`. Reads the `X-Test-User-Id` header and constructs a `ClaimsPrincipal` with `ClaimTypes.NameIdentifier` (+ optional email) matching how `SupabaseAuthService.GetUserId()` extracts identity today. Returns `AuthenticateResult.NoResult()` when the header is absent so anonymous requests remain unauthenticated.
- `Support/AuthenticatedClient.cs` — small extension method on `HttpClient`/`WebApplicationFactory` to seed a `UserProfile` row, return an `HttpClient` preloaded with `X-Test-User-Id`.
- `Support/TestDataBuilder.cs` — seeding helpers for `UserProfile`, `Team`, `Driver`, `Constructor`, `Circuit`, `RaceWeekend` (adapted from `F1CompanionApi.UnitTests/Services/TeamServiceTests.cs:1549–1645`; async variants using `ApplicationDbContext`).
- `IntegrationTestBase.cs` — abstract class implementing `IAsyncLifetime`. Holds `ApiWebApplicationFactory`, `HttpClient`, a DI scope + `ApplicationDbContext` accessor, and calls `ResetDatabaseAsync()` in `InitializeAsync`. All concrete test classes inherit this.
- `README.md` — short doc: how to run locally (`npm run api:test:integration`), Docker requirement, the `TestAuthHandler` header contract (`X-Test-User-Id`), fixture lifecycle, when to use unit vs. integration tests. Single file, ~50 lines.
- `SmokeTests.cs` — two tests:
  - `GET /api/seasons/current` against seeded season data returns `200 OK` (proves stack boots, migrations ran, DI composed, routing works, JSON serializes).
  - **Initial-page-load trifecta**: authenticated user hits `GET /api/me/profile` + `GET /api/me/team/` + `GET /api/seasons/current` concurrently (mirrors the real frontend boot per `CLAUDE.md`); all three return `200`. Catches DI composition issues across the three endpoints the app actually loads on startup.

**npm scripts (`package.json`):**
- Rename current `api:test` effect: make `api:test:unit` filter to unit project only.
- Add `api:test:integration` filter to the integration project only.
- Keep `api:test` as the convenience alias that runs both sequentially (for local "run everything" workflow).
- Concretely:
  - `"api:test:unit": "cd api && dotnet test F1CompanionApi.UnitTests/F1CompanionApi.UnitTests.csproj"`
  - `"api:test:integration": "cd api && dotnet test F1CompanionApi.IntegrationTests/F1CompanionApi.IntegrationTests.csproj"`
  - `"api:test": "npm run api:test:unit && npm run api:test:integration"`
  - `test:all` already chains `web:test && api:test`, so no change there.

**CI (`.github/workflows/ci.yml`):**
- Existing `api` job: switch `npm run api:test` → `npm run api:test:unit` so the fast unit loop stays fast.
- New `api-integration` job (parallel with `web`, `api`, `api-docker`):
  - `ubuntu-latest`; Docker is present out of the box (no `services:` block needed — Testcontainers starts its own container).
  - `actions/checkout@v6` → `actions/setup-dotnet@v5` (`dotnet-version: 10.0.x`) → `dotnet tool restore` (in `api/`) → `npm run api:build` → `npm run api:test:integration`.
  - Same permissions (`contents: read`) and concurrency group as existing jobs.

**Acceptance for commit 1:** Project builds, solution builds, smoke test passes locally (`npm run api:test:integration`), CI job added and green on the PR, `api:format:check` passes. No golden-path tests yet — that's the purpose of commits 2–7.

### Test-design principle (applies to commits 2–7)

Tests assert **user-observable outcomes through the HTTP boundary**: what a caller sends, what they get back, and what they see on the next request. Specifically:

- **DO** assert: HTTP status, response body shape the frontend actually consumes, state visible via a subsequent GET, presence/absence of rows the user would notice.
- **DON'T** assert: specific computed values whose correctness the unit tests already pin (e.g., scoring point totals per position), exact `ProblemDetails` internals unless the frontend renders them, framework behavior (model binding, content-type headers, malformed JSON handling), or internal exception types.
- **Name tests as user scenarios**, not HTTP codes: `OwnerCannotChangeRosterAfterLock`, not `AddDriver_AfterLockDeadline_Returns409`.

### Commit 2 — Roster lock

**New file:** `api/F1CompanionApi.IntegrationTests/Scenarios/RosterLockTests.cs`

User scenario: *once a race locks, I can no longer change my team for that race.*

- `OwnerCanChangeRosterBeforeLock` — lock in the future; add a driver; subsequent `GET /api/me/team` shows the driver on the roster.
- `OwnerCannotChangeRosterAfterLock` — lock in the past; add attempt is rejected; `GET /api/me/team` shows the roster unchanged.
- `OwnerCannotRemoveRosterAfterLock` — lock in the past; remove attempt is rejected; roster unchanged.

Asserting on the subsequent GET (not just the mutation's status) makes the test about the user-visible outcome rather than the error shape.

### Commit 3 — Budget cap

**New file:** `Scenarios/BudgetCapTests.cs`

User scenario: *my team cannot spend more than the budget cap.*

- `OwnerCanBuildTeamWithinCap` — assemble a roster that sums below the cap; all additions succeed; final GET shows the full roster.
- `OwnerCannotAddPickThatExceedsCap` — existing spend 60M, attempt a 50M pick (cap 100M); rejected; GET shows roster unchanged. If the frontend renders a "remaining budget" hint from the error response, pin that field; otherwise leave the body check at status-level only.
- `CapIsEnforcedOnBothDriversAndConstructors` — symmetric check for the constructor slot.

### Commit 4 — Leagues via invite token

**New file:** `Scenarios/LeagueInviteTests.cs`

User scenario: *I create a private league, share an invite link, and friends join through it.*

- `OwnerCreatesLeagueAndAppearsAsOnlyMember` — create league; subsequent `GET /api/leagues/{id}` shows owner's team is the sole member.
- `OwnerSharesInviteAndFriendJoins` — owner generates an invite; second user visits the preview endpoint and sees league metadata; second user joins; `GET /api/leagues/{id}` now shows both teams.
- `NonOwnerCannotGenerateInvites` — second user attempts to create an invite; attempt is rejected; owner's invite list unchanged.
- `FullLeagueRejectsFurtherJoins` — fill league to `MaxTeams` (15); next join attempt rejected.
- `UnknownInviteTokenGivesClearError` — preview with a made-up token returns a not-found response (what a user sees if they click a stale/typo'd link).

### Commit 5 — Scoring visible to players after a race

**New file:** `Scenarios/ScoringRollupTests.cs`

User scenario: *after ops posts race results, players see their team score update.*

- `PlayerSeesTeamScoreUpdateAfterRaceScored` — seed full qualifying + sprint + GP results; user has a known lineup; `POST` the scoring trigger with `X-Api-Key`; `GET /api/me/team` (or the leaderboard endpoint the frontend uses) shows the team's score moved from 0 to a non-zero value. We do not re-assert specific point totals per position — `ScoringServiceTests` owns that. The integration test proves that results → scoring → team read endpoints compose correctly end-to-end.
- `ScoringTriggerIsNotExposedToPlayers` — an authenticated player (no API key) cannot trigger scoring for a race. The user-visible value here is trust: one player cannot manipulate another's score.

Note: test config sets a known `Authentication:ApiKey` in `ApiWebApplicationFactory` so tests can send a valid `X-Api-Key` header.

### Commit 6 — Authorization (your stuff vs. theirs)

**New file:** `Scenarios/AuthorizationTests.cs`

User scenario: *I can only act on my own team and on leagues I belong to; other players' data is protected from me.*

- `PlayerCannotModifyAnotherPlayersTeam` — user B attempts to add a driver to user A's team; attempt rejected; user A's team GET is unchanged.
- `NonOwnerCannotPerformOwnerActionsOnLeague` — user not in a league attempts an owner-only action (invite creation); rejected; league state unchanged.
- `UnauthenticatedCallerCannotAccessProtectedEndpoints` — no credentials → rejected. Confirms the auth pipeline actually gates protected routes.
- `LookingUpAMissingTeamGivesAClearError` — authenticated user requests a team ID that doesn't exist; response clearly signals "not found" (the one salvageable test from the old HTTP-contract commit — it's a real user scenario).

### Commit 7 — Uniqueness rules players actually hit

**New file:** `Scenarios/UniquenessRuleTests.cs`

User scenarios that in-memory EF silently lets through but real Postgres enforces. Framed as user actions (not as "unique constraint violation"), but only meaningful against a real database — which is precisely what makes this commit the clearest proof the integration layer is earning its keep.

- `PlayerCannotOwnTwoTeamsInTheSameSeason` — user already has a team; attempts to create a second for the same season; rejected; GET of their team still shows the original. (Covers the `Teams(UserId, SeasonId)` uniqueness rule.)
- `PlayerCannotPickTheSameDriverTwice` — driver already on roster; second add attempt for that driver is rejected; roster still has one copy. (Covers `TeamDrivers(TeamId, DriverId)` uniqueness.)
- `PlayerCannotJoinTheSameLeagueTwice` — user already in a league; rejoin attempt via token is rejected; `GET /api/leagues/{id}` still shows one entry for that team. (Covers league-membership uniqueness — another rule that only real Postgres enforces.)

## Critical files to modify / create

**Created:**
- `api/F1CompanionApi.IntegrationTests/F1CompanionApi.IntegrationTests.csproj`
- `api/F1CompanionApi.IntegrationTests/Support/{PostgresFixture,IntegrationTestCollection,ApiWebApplicationFactory,TestAuthHandler,AuthenticatedClient,TestDataBuilder}.cs`
- `api/F1CompanionApi.IntegrationTests/IntegrationTestBase.cs`
- `api/F1CompanionApi.IntegrationTests/SmokeTests.cs`
- `api/F1CompanionApi.IntegrationTests/README.md`
- `api/F1CompanionApi.IntegrationTests/Scenarios/{RosterLock,BudgetCap,LeagueInvite,ScoringRollup,Authorization,UniquenessRule}Tests.cs` (one per commit 2–7)

**Modified:**
- `api/f1-companion-api.sln` — register new project
- `api/F1CompanionApi/Program.cs` — append `public partial class Program { }`
- `package.json` — split `api:test` into `api:test:unit` + `api:test:integration`, retain alias
- `.github/workflows/ci.yml` — existing `api` job uses `api:test:unit`; add `api-integration` job
- `.vscode/tasks.json` — rename existing `[API] Test` → `[API] Test (Unit)` for clarity (cwd already points at the unit project), add `[API] Test (Integration)` mirroring it at `api/F1CompanionApi.IntegrationTests`. This mirrors the split in package.json and is worth doing in commit 1 so the task palette stays in sync.

## Dependabot

No changes required. `.github/dependabot.yml:60–71` already has a `nuget` ecosystem scoped to `/api` which scans all `.csproj` files recursively — the new `F1CompanionApi.IntegrationTests.csproj` will be picked up automatically on the next Monday run. The existing `coverlet` group will continue to cover coverlet packages in the new project. Optional (and probably worth adding in commit 1 since we're already touching nothing else): a `testcontainers` group so Testcontainers updates batch together instead of arriving as N separate PRs:

```yaml
testcontainers:
  patterns:
    - "Testcontainers*"
```

## Verification

Local (each commit):
- `npm run api:build` — clean build
- `npm run api:format:check` — formatting clean
- `npm run api:test:unit` — existing 460+ tests still pass (regression check)
- `npm run api:test:integration` — new suite green
  - Requires Docker Desktop running locally; Testcontainers surfaces a clear error if not
- `npm run test:all` — full test chain

CI (each PR):
- `web`, `api`, `api-docker` jobs pass as before (unchanged paths)
- New `api-integration` job green, runs in parallel, gates merge once branch protection is updated

Manual spot-checks after commit 1:
- Kill Docker → `api:test:integration` fails fast with a clear message (confirms Testcontainers is actually doing the work)
- Intentionally break a mapping in `GlobalExceptionHandler` → the relevant golden-path test in a later commit fails (confirms tests exercise the real exception handler, not a mock)
- Delete the `X-Test-User-Id` header in `AuthenticatedClient` → authorization tests fail with `401` instead of the expected success (confirms the test auth handler is actually in the pipeline)
