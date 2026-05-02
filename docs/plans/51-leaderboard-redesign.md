# Leaderboard Redesign — GH Issue #51

## Context

Issue #51 promotes the league leaderboard from a 2-column rank/team table into the league hub: position, team, owner, position-change, and cumulative season points, with a richer header. The scoring engine (#17) is already done — `TeamRaceWeekendScore` rows exist per (team, race weekend) — but nothing aggregates them into season totals or exposes them as standings. The current `Leaderboard.tsx` renders only rank + team name + owner + a "View" button against the unsorted `LeagueDetailsResponse.Teams` array.

This plan implements the design at `docs/mockups/design_handoff_leaderboard_redesign/`. Decisions reflect explicit user answers in the planning conversation:

- Header chips: ship `Round X / Y` and `After {Race} {Session}` only. The `Next ...` chip is dropped (no session-start-time data exists; out of scope).
- `positionChange`: computed on-the-fly from `TeamRaceWeekendScores`, no snapshot table.
- Standings live on a new `GET /leagues/{id}/standings` endpoint (separate from `GET /leagues/{id}`).
- Tie-break: `totalPoints DESC, weekendWins DESC, highestSingleRoundPoints DESC, teamId ASC`.
- Session label uses **"Grand Prix"** (not "Race") even when redundant with `RaceWeekend.Name`.
- Mobile/desktop layout swap via Tailwind responsive classes only (no JS hook); both layouts render, CSS hides one.
- Direct replacement of the existing `Leaderboard.tsx` — no flag, no V2-side-by-side.

## Critical files

**Backend (new):**

- `api/F1CompanionApi/Api/Models/LeagueStandingsResponse.cs` — response DTO
- `api/F1CompanionApi/Api/Models/StandingsEntryResponse.cs` — per-team row
- `api/F1CompanionApi/Domain/Models/WeekendSessions.cs` — small static helper that encodes the F1 chronological order of sessions. See "Session ordering" below.
- `api/F1CompanionApi.UnitTests/Domain/Models/WeekendSessionsTests.cs`
- `api/F1CompanionApi.IntegrationTests/Scenarios/LeagueStandingsTests.cs` (project layout uses `Scenarios/` for tests + `Support/` for fixtures — verified by `find`. Closest reference test to mirror: `Scenarios/RaceWeekendScoringTests.cs`.)

**Backend (touched):**

- `api/F1CompanionApi/Data/Entities/SessionType.cs` — add `Qualifying = 2` with an XML doc clarifying it is not a valid value for `DriverRacingResult.SessionType`.
- `api/F1CompanionApi/Domain/Services/LeagueService.cs` — add `GetLeagueStandingsAsync(int leagueId)` to both the `ILeagueService` interface (declared at line 10 of the same file — not separate) and the class. **No constructor changes**: query Seasons and RaceWeekends directly via the existing `_dbContext` rather than injecting `ISeasonService` / `IRaceWeekendService`. Avoids touching `new LeagueService(...)` calls in `LeagueServiceTests.cs` (5 sites at lines 35, 81, 148, 168, 198 — verified). The duplicated 2-line "current season" / "current race weekend" inline query is cheaper than the test-fixture ripple from injection.
- `api/F1CompanionApi/Api/Endpoints/LeagueEndpoints.cs` — add `MapGet("/leagues/{id:int}/standings", ...)` next to the existing league routes.
- `api/F1CompanionApi.UnitTests/Services/LeagueServiceTests.cs` — extend with standings cases (file already exists alongside the other service tests).

**Frontend (new):**

- `web/src/contracts/LeagueStandings.ts`
- `web/src/services/standingsService.ts`
- `web/src/components/PositionDelta/PositionDelta.tsx` — top-level folder per the project's one-folder-per-component convention (verified: `DriverCard/`, `DriverListItem/`, `DriverPicker/` etc. are all sibling top-level folders, not nested).
- `web/src/components/PositionDelta/PositionDelta.test.tsx` — leaf component, props in / DOM out per `web/CLAUDE.md`'s "leaf / presentational" layer.
- `web/src/components/LeaderboardHeader/LeaderboardHeader.tsx`
- `web/src/tests/integration/league-loader.integration.test.tsx` — small loader-only integration test added in commit 3.
- `web/src/tests/integration/leaderboard.integration.test.tsx` — replaces the deleted component-level test in commit 4; uses the real router, real loader, real components, MSW for the `/leagues/{id}` and `/leagues/{id}/standings` boundary. Reference: `src/tests/integration/account.integration.test.tsx`.

**Frontend (rewrite):**

- `web/src/components/Leaderboard/Leaderboard.tsx` — full redesign per handoff

**Frontend (delete):**

- `web/src/components/Leaderboard/Leaderboard.test.tsx` — this file mocks `@tanstack/react-router` to stub `useLoaderData`, which `web/CLAUDE.md` explicitly identifies as the wrong layer for route components. Replaced by an integration test (see Tests under Commit 4). The leaf-component test for `PositionDelta` lives next to the component as `PositionDelta.test.tsx`.

**Frontend (touched):**

- `web/src/index.css` — add `--row-highlight`, `--row-highlight-border`, `--delta-up-fg`, `--delta-down-fg`, `--delta-flat-fg` to `:root` and `.dark`
- `web/src/router.tsx` — extend the existing `/league/$leagueId` route loader at `router.tsx:491-512` (do not create a second loader). Fetch `getLeagueStandings(leagueId)` in parallel with the existing `getLeagueById(leagueId)` call. Treat either returning `null` as `notFound`. Detailed loader code is in commit 3.
- `web/src/components/League/League.tsx` — in commit 3: widen the local `interface LeagueLoaderData` (line 26) to add `standings: LeagueStandings`. In commit 4: drop the interface and the `as LeagueLoaderData` cast at line 40 entirely; replace with the `getRouteApi` pattern.
- `web/src/tests/test-utils/mockFactories.ts` — add `createMockLeagueStandings` next to the existing `createMockTeam` / `createMockDriver` factories.

## Data shapes

### `GET /api/leagues/{id}/standings`

```json
{
  "leagueId": 12,
  "round": 7,
  "totalRounds": 24,
  "afterRaceName": "Miami GP",
  "afterSessionType": 2,
  "standings": [
    {
      "teamId": 91,
      "teamName": "Mango Lassi Racing",
      "ownerId": 5,
      "ownerName": "Priya Iyer",
      "position": 1,
      "totalPoints": 1284,
      "positionChange": 0
    }
  ]
}
```

Field rules:

- `round` = the round of the race weekend that the API already considers "current" (`RaceWeekendResponse.IsCurrent == true`, i.e., first race where `RaceDate >= now`). Reuse `RaceWeekendService` rather than inventing a parallel rule. `null` only if the season has no current race (season over).
- `totalRounds` = `COUNT(RaceWeekend WHERE SeasonId = league's current season)`.
- Define `latestScoredRound` (internal, not in the response) = `MAX(RaceWeekend.Round)` for which any `TeamRaceWeekendScore` row exists in this league's season. `null` if no scoring has happened. This anchors both `afterRaceName`/`afterSessionType` and `positionChange` below.
- `afterRaceName` = the `Name` of the race weekend at `latestScoredRound`. May lag behind `round` between weekends — that's intentional ("you're heading into round X, latest scoring is from {previous race}"). `null` if `latestScoredRound` is `null`.
- `afterSessionType` = the latest `SessionType` (in chronological order via `WeekendSessions.InOrder`) for the weekend at `latestScoredRound` that has a result row. For each session in the weekend's order, `EXISTS`-check the appropriate result table:
  - `SessionType.Sprint` → `EXISTS DriverRacingResult WHERE RaceWeekendId = X AND SessionType = Sprint`
  - `SessionType.Qualifying` → `EXISTS DriverQualifyingResult WHERE RaceWeekendId = X` (note: this enum value never appears in `DriverRacingResult`; qualifying lives in its own table)
  - `SessionType.GrandPrix` → `EXISTS DriverRacingResult WHERE RaceWeekendId = X AND SessionType = GrandPrix`
  - Pick the latest one in the weekend's chronological order that has rows. `null` if `latestScoredRound` is `null`. The user-facing label transform (`GrandPrix` → "Grand Prix") happens on the frontend.
- `positionChange = positionAt(latestScoredRound - 1) - positionAt(latestScoredRound)`, where `positionAt(R)` sorts teams by the same tie-break using only `TeamRaceWeekendScore` rows where `Round <= R`. `null` when `latestScoredRound` is `null`, when `latestScoredRound == 1`, or when the team has no rows at round `latestScoredRound - 1` (e.g. joined late).
- `standings` ordering (uses every available scoring row for the team — equivalent to `Round <= latestScoredRound`):
  1. `totalPoints` DESC (sum of `TeamRaceWeekendScore.TotalPoints` for this team across the season)
  2. `weekendWins` DESC — count of race weekends where this team had the **strictly highest** `TeamRaceWeekendScore.TotalPoints` among the league's teams (ties at the top of a weekend → no win for anyone that weekend)
  3. `highestSingleRoundPoints` DESC — max `TeamRaceWeekendScore.TotalPoints` row this team has
  4. `teamId` ASC — final deterministic tiebreak
- Standings include every team in the league, even those with zero scoring rows (`totalPoints: 0`, `weekendWins: 0`, `highestSingleRoundPoints: 0`).

### Session ordering (`WeekendSessions` helper)

The chronological order of sessions in an F1 weekend is not encoded anywhere in the codebase today (`SessionType` distinguishes racing-result rows; `WeekendFormat` only signals presence/absence of a sprint). To avoid sprinkling that knowledge across the standings query (and any future feature that needs it), do two small things:

**1. Extend the existing `SessionType` enum** with `Qualifying = 2`. The enum is already named generally; the fact that it's currently only used on `DriverRacingResult` is incidental, not definitional. Adding the value is source-only — no migration, since the column stores int and existing rows are unaffected.

```csharp
// api/F1CompanionApi/Data/Entities/SessionType.cs
public enum SessionType
{
    GrandPrix = 0,
    Sprint = 1,

    /// <summary>
    /// Qualifying session. Note: qualifying results are stored in
    /// <see cref="DriverQualifyingResult"/>, not <see cref="DriverRacingResult"/>.
    /// Querying `DriverRacingResult.SessionType == Qualifying` will always return zero rows.
    /// </summary>
    Qualifying = 2,
}
```

**2. Add a small static helper** that owns the chronological order:

```csharp
// api/F1CompanionApi/Domain/Models/WeekendSessions.cs

public static class WeekendSessions
{
    /// <summary>
    /// Sessions that occur in the given weekend format, in F1 chronological order.
    /// Standard weekends: Qualifying -> Grand Prix.
    /// Sprint weekends:   Sprint -> Qualifying -> Grand Prix.
    /// </summary>
    public static IReadOnlyList<SessionType> InOrder(WeekendFormat format) =>
        format switch
        {
            WeekendFormat.Sprint   => new[] { SessionType.Sprint, SessionType.Qualifying, SessionType.GrandPrix },
            WeekendFormat.Standard => new[] { SessionType.Qualifying, SessionType.GrandPrix },
            _ => throw new ArgumentOutOfRangeException(nameof(format)),
        };
}
```

User-facing labels are deliberately not here — the response ships `SessionType` directly and the frontend owns presentation (`GrandPrix` → "Grand Prix"). This helper is the seam that a future "Session entity" refactor (see `docs/plans/draft-issue-session-entity.md`) would replace. Keeping the chronological-order knowledge in one place now means that swap is a one-file change later.

### `LeagueStandings` contract (frontend)

```ts
// web/src/contracts/LeagueStandings.ts
export interface StandingsEntry {
  teamId: number;
  teamName: string;
  ownerId: number;
  ownerName: string;
  position: number;
  totalPoints: number;
  positionChange: number | null;
}

// Numeric enum to match the backend's wire format (no JsonStringEnumConverter
// is registered; existing `WeekendFormat` ships the same way).
export enum SessionType {
  GrandPrix = 0,
  Sprint = 1,
  Qualifying = 2,
}

export interface LeagueStandings {
  leagueId: number;
  round: number | null;
  totalRounds: number;
  afterRaceName: string | null;
  afterSessionType: SessionType | null;
  standings: StandingsEntry[];
}

// Display transform — backend ships the canonical enum, frontend renders.
export const sessionTypeLabel: Record<SessionType, string> = {
  [SessionType.Sprint]: 'Sprint',
  [SessionType.Qualifying]: 'Qualifying',
  [SessionType.GrandPrix]: 'Grand Prix',
};
```

## Commits

Four commits, each independently passing build, lint, format, and tests.

---

### Commit 1 — Branch setup + tracked planning artifacts

**Scope:** Create the working branch and commit the planning/design artifacts that exist today but aren't tracked. No source code changes; this commit just gets the supporting docs into version control before implementation begins so reviewers can see the design context for the subsequent commits.

**Implementation:**

1. **Create branch** from `main`: `git checkout -b feature/issue-51-leaderboard-redesign` (matches the project's branch-naming convention seen in recent merges, e.g. `fix/issue-148-qualifying-dsq`).
2. **Copy this plan** to `docs/plans/51-leaderboard-redesign.md`. This matches the existing `docs/plans/` numbering convention (`12-race-weekend-model.md`, `50-team-page-redesign.md`, `148-qualifying-dsq.md`).
3. **Track the mockup designs** at `docs/mockups/design_handoff_leaderboard_redesign/` (currently untracked per `git status`). All five files in that directory: `README.md`, `Leaderboard.html`, `leaderboard.jsx`, `data.jsx`, `tweaks-panel.jsx`, `ios-frame.jsx`.
4. **Track the future-issue draft** at `docs/plans/draft-issue-session-entity.md` (created earlier in plan mode; currently untracked). This is the Session-entity refactor draft, kept around so the idea isn't lost — once it becomes a real GH issue it can be deleted from this folder, but keeping the draft committed in the meantime ensures it isn't lost on branch deletion.

**Tests:** none — this commit changes no code paths. `npm run web:build` and `npm run api:build` should remain green simply because no source files were touched.

**Done when:**
- Branch `feature/issue-51-leaderboard-redesign` exists locally.
- `docs/plans/51-leaderboard-redesign.md` exists and matches the contents of this plan.
- `git status` reports no untracked files in `docs/mockups/design_handoff_leaderboard_redesign/` or `docs/plans/`.
- `npm run web:build && npm run api:build` pass (sanity check that nothing broke).

---

### Commit 2 — Backend: standings endpoint

**Scope:** New `GET /api/leagues/{id}/standings` endpoint with full query, ordering, position-change logic, the `WeekendSessions` helper, and tests. No frontend changes; existing `/leagues/{id}` untouched.

**Implementation:**

1. **Add DTOs**
   - `Api/Models/StandingsEntryResponse.cs` — `TeamId, TeamName, OwnerId, OwnerName, Position, TotalPoints, PositionChange (int?)`
   - `Api/Models/LeagueStandingsResponse.cs` — `LeagueId, Round (int?), TotalRounds, AfterRaceName (string?), AfterSessionType (SessionType?), Standings (List<StandingsEntryResponse>)`. Enums ship as numeric values: the project does not register `JsonStringEnumConverter` (verified — no hits in `api/F1CompanionApi`), and the existing `RaceWeekendResponse.WeekendFormat` round-trips as `0|1` (the frontend `RaceWeekend` contract types it as numeric). Match that: `afterSessionType` will serialize as `0|1|2`.

2. **Add `WeekendSessions` helper** at `Domain/Models/WeekendSessions.cs`. See "Session ordering" below for the exact shape.

3. **Extend `LeagueService`** with `Task<LeagueStandingsResponse?> GetLeagueStandingsAsync(int leagueId)` (returns `null` for missing league → 404). Add the same signature to the existing `ILeagueService` interface (same file, line 10).

   No constructor changes (see "Backend (touched)" rationale above).

   Internal logic:
   - Load league with `Include(LeagueTeams).ThenInclude(Team).ThenInclude(Owner)` and project to `(teamId, teamName, ownerId, ownerName)`. Return `null` if league not found.
   - Resolve current season inline: `var seasonId = await _dbContext.Seasons.Where(s => s.IsCurrent).Select(s => (int?)s.Id).FirstOrDefaultAsync();`. Neither `League` nor `Team` carries `SeasonId` (verified); the season context is the global active season.
   - Load `TeamRaceWeekendScore` rows joined to `RaceWeekend` for those team ids and that season — projection: `(teamId, round, totalPoints)`. The entity has navigation property `RaceWeekend` (verified) so the LINQ shape is `_dbContext.TeamRaceWeekendScores.Where(s => teamIds.Contains(s.TeamId) && s.RaceWeekend.SeasonId == seasonId).Select(s => new { s.TeamId, s.RaceWeekend.Round, s.TotalPoints }).ToListAsync()`.
   - Resolve current race weekend inline (mirror `RaceWeekendService.cs:45-48` semantics — first race where `RaceDate >= now`): `var currentRaceWeekend = await _dbContext.RaceWeekends.Where(r => r.SeasonId == seasonId && r.RaceDate >= DateTime.UtcNow).OrderBy(r => r.Round).FirstOrDefaultAsync();`. Take its `Round` for the response's `round` field (nullable when there is no upcoming weekend, i.e., season over).
   - `totalRounds = await _dbContext.RaceWeekends.CountAsync(r => r.SeasonId == seasonId)`.
   - `latestScoredRound = max(round)` across the loaded score rows (nullable).
   - For each team, compute aggregates across all loaded rows for that team:
     - `totalPoints = sum(points)`
     - `weekendWins`: per-round, find the team with the **strictly highest** points among league teams; count weekends where this team is the unique top.
     - `highestSingleRoundPoints = max(points)` (0 if no rows).
   - Sort with the 4-key comparator; assign `Position = index + 1`.
   - Compute prior standings the same way restricted to rows where `round <= latestScoredRound - 1`; build a `Dictionary<teamId, position>`.
   - `positionChange = priorPosition - currentPosition` (`null` if `latestScoredRound` is `null`, equals `1`, or the team has no rows at the prior round).
   - Resolve `afterRaceName` + `afterSessionType` from the race weekend at `latestScoredRound`. Iterate `WeekendSessions.InOrder(raceWeekend.WeekendFormat)` and `EXISTS`-check the appropriate result table for each session; the response carries the latest `SessionType` value that has rows. Both fields `null` if `latestScoredRound` is `null`.

4. **Endpoint registration**
   - In `Api/Endpoints/LeagueEndpoints.cs`, add `MapGet("/leagues/{id:int}/standings", ...)` to the `leaguesGroup` defined at line 13. Chain `.RequireAuthorization()` to match every other route in this group (lines 17, 23, 29, 35, 41, 47, 58 all use it).
   - Returns `Results.Ok(...)` on success, `Results.NotFound()` when the service returns `null`.
   - No new DI registration needed — `LeagueService` is already wired.

5. **Tests** — two layers. xUnit naming convention `{MethodName}_{Scenario}_{ExpectedOutcome}` per `api/CLAUDE.md`. Standings logic stays inside the `GetLeagueStandingsAsync` instance method; tests follow the established `LeagueServiceTests` pattern (Moq for `ILogger`, `CreateInMemoryContext()` helper, `UseInMemoryDatabase(Guid.NewGuid().ToString())` per test). This intentionally extends the legacy EF-InMemory pattern that the rest of `LeagueServiceTests` uses — the consistency tradeoff (uniform shape across all `LeagueService` tests, single future refactor target) outweighs the divergence-from-prod risk for this read-only logic, which is also covered against real Postgres in the integration layer.

   **`F1CompanionApi.UnitTests/Domain/Models/WeekendSessionsTests.cs`** — pure helper, no DI:
   - `[Fact] InOrder_Standard_ReturnsQualifyingThenGrandPrix`
   - `[Fact] InOrder_Sprint_ReturnsSprintThenQualifyingThenGrandPrix`

   **`F1CompanionApi.UnitTests/Services/LeagueServiceTests.cs`** — extend with `GetLeagueStandingsAsync` cases. Use `[Theory]` + `[InlineData]` for the parametric tie-break matrix, `[Fact]` for everything else:
   - `[Fact] GetLeagueStandingsAsync_UnknownLeague_ReturnsNull`
   - `[Fact] GetLeagueStandingsAsync_LeagueWithNoTeams_ReturnsEmptyStandings` (also: `round` set if a current weekend exists, `afterRaceName`/`afterSessionType` null)
   - `[Fact] GetLeagueStandingsAsync_NoScoresYet_AllZerosWithNullAfterFields`
   - `[Theory] GetLeagueStandingsAsync_TieBreak_*` — rows covering (equal totals → wins decides), (equal totals + wins → highest single round decides), (everything equal → teamId asc).
   - `[Theory] GetLeagueStandingsAsync_PositionChange_*` — one Theory, four `[InlineData]` rows: first-scored round → all null; team climbed → positive; team fell → negative; team with no prior-round rows → null. Same code path, different inputs/expected outputs.
   - `[Fact] GetLeagueStandingsAsync_WeekendWins_TieAtTop_NoWinForAnyone`
   - `[Theory] GetLeagueStandingsAsync_AfterSessionType_*` — Standard vs Sprint formats × which sessions have results.
   - `[Fact] GetLeagueStandingsAsync_BetweenWeekends_RoundAdvancesButAfterFieldsLag` — verifies the deliberate `round` (current upcoming) vs `latestScoredRound` (last with scoring) split.

   **`F1CompanionApi.IntegrationTests/Scenarios/LeagueStandingsTests.cs`** — `WebApplicationFactory` + Testcontainers Postgres. Inherit `IntegrationTestBase`; use `factory.CreateAuthenticatedAsync()` for auth. Closest reference to mirror: `Scenarios/RaceWeekendScoringTests.cs` (same DB-touching scoring/standings topic). Covers SQL correctness, EF query behavior, HTTP pipeline. Each test catches a failure mode the unit tests can't see:
   - `[Fact]` `GET /leagues/{id}/standings` for an unknown league → HTTP 404 (catches: endpoint correctly translates the service's `null` to a 404 response, not 500/200/empty body — purely an HTTP-pipeline concern).
   - `[Fact]` Seeded happy path: 1 league, 3 teams, 2 race weekends with `TeamRaceWeekendScore` rows (mixed, including a tie). Assert ordering, positions, `positionChange`, `afterRaceName`/`afterSessionType`. **The assertion overlap with unit tests is intentional**: the unit tests run the logic against EF InMemory, which translates LINQ differently than Npgsql against Postgres (case sensitivity, null handling, GroupBy ordering, decimal precision). This test catches the failure mode where the logic is correct in C# but the actual SQL EF generates produces different results on real Postgres. Not redundant — it's the layer that catches LINQ-translation drift.
   - `[Fact]` Unauthenticated request → HTTP 401 (use a plain `factory.CreateClient()` without `CreateAuthenticatedAsync()` — mirrors the pattern in `Scenarios/RaceWeekendScoringTests.cs`).

**Done when:**
- `npm run api:test:unit` and `npm run api:test:integration` pass.
- `npm run api:format:check` and `npm run api:build` pass.
- New endpoint returns the documented JSON for a seeded league via `curl`.

---

### Commit 3 — Frontend: data wiring (no UI change)

**Scope:** Add the standings contract + service + extend the route loader to fetch standings in parallel. The existing `Leaderboard.tsx` and `League.tsx` continue to render the current UI; the new `standings` field is fetched and typed (by widening the existing `LeagueLoaderData` interface) but unused by the components. This is a transitional/wiring commit. The `getRouteApi` migration and `LeagueLoaderData` interface removal are intentionally deferred to commit 4 (where we're rewriting the test file anyway, and where introducing `getRouteApi` doesn't require updating an existing `vi.mock('@tanstack/react-router', ...)` to add a `getRouteApi` stub).

**Implementation:**

1. **Contract** at `web/src/contracts/LeagueStandings.ts` per the "Data shapes" / "LeagueStandings contract" section above.

2. **Service** at `web/src/services/standingsService.ts`. Mirror the exact 404→null pattern from `getLeagueById` in `leagueService.ts:31-39`:
   ```ts
   import type { LeagueStandings } from '@/contracts/LeagueStandings';
   import { apiClient } from '@/lib/api';
   import { isApiError } from '@/utils/errors';

   export async function getLeagueStandings(leagueId: number): Promise<LeagueStandings | null> {
     try {
       return await apiClient.get<LeagueStandings>(
         `/leagues/${leagueId}/standings`,
         'get league standings',
       );
     } catch (error) {
       if (isApiError(error) && error.status === 404) {
         return null;
       }
       throw error;
     }
   }
   ```

3. **Route loader** — extend the existing loader at `web/src/router.tsx:491-512` (single loader; do not create a second one). After the Zod param validation, run both fetches in parallel:
   ```ts
   const [league, standings] = await Promise.all([
     getLeagueById(leagueId),
     getLeagueStandings(leagueId),
   ]);
   if (!league || !standings) throw notFound({ routeId: LEAGUE_ROUTE_ID });
   return { league, standings };
   ```
   Defensive `null` check on `standings` mirrors the existing `league` check; the two endpoints should agree, but if they ever diverge we want a clean 404, not a runtime crash inside the component.

4. **Widen `LeagueLoaderData` interface** in both `Leaderboard.tsx:8-10` and `League.tsx:26` to add the `standings` field:
   ```ts
   interface LeagueLoaderData {
     league: League;
     standings: LeagueStandings;
   }
   ```
   Both components continue to use the existing `useLoaderData({ from: '...' }) as LeagueLoaderData` pattern. **The `getRouteApi` migration and removal of the duplicated interface are deferred to commit 4** — switching APIs in this commit would require simultaneously updating `Leaderboard.test.tsx`'s `vi.mock('@tanstack/react-router', ...)` to add a `getRouteApi` stub (since the current mock factory only exports `useLoaderData`/`useRouteContext`/`Link`). Doing it in commit 4 is cleaner because we're deleting that test file there anyway.

5. **Mock factory** — add `createMockLeagueStandings` to `web/src/tests/test-utils/mockFactories.ts` alongside the existing `createMockTeam` / `createMockDriver`. Defaults: `{ leagueId: 1, round: 1, totalRounds: 24, afterRaceName: null, afterSessionType: null, standings: [] }`. Signature accepts a `Partial<LeagueStandings>` for field-by-field overrides (mirrors the existing factories' override pattern).

6. **Tests** — two changes:

   **Update `web/src/components/Leaderboard/Leaderboard.test.tsx`** — the existing tests still mock `useLoaderData` and consume the `LeagueLoaderData` cast. With the interface now including `standings: LeagueStandings`, the mocked `useLoaderData` return value needs to include a `standings` field too (otherwise TypeScript fails the cast). Add `standings: createMockLeagueStandings()` to each mock invocation — that's the only change. **Do not delete this file** — it's deleted in commit 4 when its replacement integration test lands.

   **Add `web/src/tests/integration/league-loader.integration.test.tsx`** — small, loader-only integration test. Copy the shape of `src/tests/integration/account.integration.test.tsx`. Mounts the league route with MSW handlers for both `/leagues/{id}` and `/leagues/{id}/standings`. The route's `notFoundComponent` (currently defined at `router.tsx:522-528`) renders an `<h1>League Not Found</h1>` heading — the test asserts on that heading text via `getByRole('heading', { name: /league not found/i })` to confirm the not-found path was taken.
   - 404 from `/leagues/{id}` → "League Not Found" heading renders.
   - 404 from `/leagues/{id}/standings` → "League Not Found" heading renders (verifies the defensive null check).
   - 200 from both → existing `League` UI mounts (smoke-level — assert by league name in the heading, not detailed leaderboard structure since that's about to change in commit 4).

**Done when:**
- `npm run web:test`, `npm run web:lint`, `npm run web:format:check`, `npm run web:build` all pass.
- Existing leaderboard renders unchanged in the browser (`npm run web:dev`); navigate to a league page and confirm no visual or behavior regression.
- DevTools Network tab shows both `GET /leagues/{id}` and `GET /leagues/{id}/standings` firing in parallel on the league page.

---

### Commit 4 — Frontend: leaderboard UI redesign

**Scope:** Replace `Leaderboard.tsx` with the design-handoff UI, add the supporting components, add CSS tokens, rewrite tests. The data is already in the loader from commit 3; this commit is pure presentation + interaction.

**Implementation:**

1. **CSS tokens** in `web/src/index.css`. Append to `:root` and `.dark` exactly as specified in `docs/mockups/design_handoff_leaderboard_redesign/README.md` "Design Tokens" section. Use the constant `17%` directly in the `color-mix(...)` expression at usage sites (do not expose `--row-highlight-strength`).

2. **Components** — each as its own top-level folder under `web/src/components/`, matching the project's one-folder-per-component convention:

   - **`web/src/components/PositionDelta/PositionDelta.tsx`** — exact behavior from the handoff §Components:
     - Props: `value: number | null`, `variant?: 'block' | 'inline'`.
     - Glyph style locked to `arrow` (↑ / ↓). Flat / null → `–` in `var(--muted-foreground)`.
     - `aria-label`: `"Up N positions"` / `"Down N positions"` / `"No position change"`. Glyphs `aria-hidden`.

   - **`web/src/components/LeaderboardHeader/LeaderboardHeader.tsx`** — props: `league: League`, `standings: LeagueStandings`.
     - `<h1>` `league.name` + optional `<p>` `league.description`.
     - Chip row with two chips, **only when `standings.round != null`**:
       - `Round {standings.round} / {standings.totalRounds}`
       - `After {standings.afterRaceName} {sessionTypeLabel[standings.afterSessionType]}` (uses the `sessionTypeLabel` map from the contract)
     - Chip row uses Tailwind `flex flex-wrap` on desktop and `-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden` on `<sm`. No `Next` chip.
     - Empty-scoring case (`standings.round == null`): render header with name + description only, no chip row.

3. **Rewrite `Leaderboard.tsx`** — switch from the cast-based `useLoaderData({ from: '...' }) as LeagueLoaderData` pattern to the typed `getRouteApi` pattern used in `Account.tsx:11,25,29`:
   ```ts
   import { getRouteApi } from '@tanstack/react-router';
   const routeApi = getRouteApi('/_authenticated/_team-required/league/$leagueId');
   // inside component:
   const { league, standings } = routeApi.useLoaderData();
   ```
   Drop the local `interface LeagueLoaderData` declaration. Apply the same change to `League.tsx` (drop the interface at line 26, switch its `useLoaderData` call at line 40 to `routeApi.useLoaderData()`). Identify the viewer's own row via `useRouteContext` → `profile.id === entry.ownerId` (existing pattern).

   **Data flow:** the route loader (extended in commit 3) fires `getLeagueById(leagueId)` and `getLeagueStandings(leagueId)` in parallel — two HTTP calls to two endpoints, once per page load. `Leaderboard.tsx` is the only component that calls `routeApi.useLoaderData()`. It passes `league` and `standings` down to `LeaderboardHeader` as props. No component re-fetches; no `LeaderboardHeader`-side `useLoaderData()`. This keeps `LeaderboardHeader` route-agnostic (testable as a leaf with no router scaffolding) at the cost of one level of explicit prop-drilling.
   - Render `<LeaderboardHeader />` then both layouts in the DOM:
     - Desktop table: `<div className="hidden sm:block">` containing the 5-column CSS grid (`52px 1fr 70px 96px 36px`) per the handoff §Layouts. Header row + body rows. Each body row a `<Link>` (TanStack Router) styled as a button.
     - Mobile cards: `<div className="sm:hidden">` containing the vertical card stack per the handoff.
   - Routing per row: own team → `<Link to="/my-team">`; others → `<Link to="/team/$teamId" params={{ teamId: String(entry.teamId) }}>`. The existing `beforeLoad` guard on `/team/$teamId` redirects own-team accidents to `/my-team`, so this is double-safe.
   - Numbers: `toLocaleString()` for `totalPoints`. `tabular-nums` everywhere numeric.
   - "My team" treatment: tint + border per handoff §"My team" row treatment, both layered (this is the WCAG-passing combination). **In addition**, augment the row's `aria-label` for the viewer's row: `"Open {teamName}, your team, position {N}"`. This gives screen-reader users the same "this is you" signal that sighted users get from the visual treatment, and gives integration tests a semantic hook to assert against (instead of asserting on a CSS class — which is implementation, not behavior). Note this is a deliberate addition to the design handoff, which only specified the visual signal.
   - Empty state: when `standings.standings.length === 0`, render the existing `bg-card rounded-lg p-8 text-center` "No teams in this league yet." card (preserve current behavior).
   - **Remove** the existing "You" Badge and "View" button — design specifies the row-tint-and-border treatment is the only "this is you" signal, and the whole row click-through replaces the button.

4. **Tests** — two layers, per `web/CLAUDE.md`'s rules.

   **Delete** `web/src/components/Leaderboard/Leaderboard.test.tsx`. It mocks `@tanstack/react-router` to stub `useLoaderData`, which `web/CLAUDE.md` calls out as the wrong layer for route components. Replaced by the integration test below.

   **Add `web/src/components/PositionDelta/PositionDelta.test.tsx`** (leaf component, props in / DOM out):
   - Up / down / flat / null values render the right glyph and number.
   - `aria-label` matches `"Up N positions"` / `"Down N positions"` / `"No position change"`.
   - Glyph is `aria-hidden`.

   **Add `web/src/tests/integration/leaderboard.integration.test.tsx`** — copy the shape of `src/tests/integration/account.integration.test.tsx`. Build a per-test route tree with the real `leagueRoute` loader (mirrored inline as that file does), real components, MSW for the `/leagues/{id}` and `/leagues/{id}/standings` calls. (The loader-level 404 cases from commit 3's `league-loader.integration.test.tsx` already cover the loader path; this file focuses on rendered UI.)
   - Cases:
     - Empty standings → renders empty-state card ("No teams in this league yet.").
     - Standard happy path: position, team name, owner name, formatted total (`toLocaleString`), delta glyph for up/down/flat/null all render.
     - Own row exposes a "your team" signal in its accessible name: `getByRole('button', { name: /your team, position 4/ })` resolves to the viewer's row. Other rows do not contain "your team" in their accessible name. This tests the user-perceivable signal (what a screen reader announces), not the CSS class that makes the visual treatment.
     - Own-team row link points to `/my-team`; other rows point to `/team/$teamId`.
     - Header chips render when `round` is set; both chips hidden when `round == null`.
     - "After" chip uses the frontend `sessionTypeLabel` map: API ships `2` (`SessionType.Qualifying`), chip renders `"Qualifying"`; API ships `0` (`SessionType.GrandPrix`), chip renders `"Grand Prix"`.
     - Other rows' `aria-label` matches `"Open {teamName}, position {N}"` (own row matches `"Open {teamName}, your team, position {N}"`).
   - **Do not** test the table-vs-card breakpoint swap with `matchMedia` mocking — both layouts render in the DOM (Tailwind class controls visibility), so unscoped queries will see both. Disambiguate via accessible names rather than `data-testid` (more idiomatic RTL): the table element gets `aria-label="Leaderboard table"` and the cards container gets `<ul aria-label="Leaderboard cards">`. Tests then use `getByRole('table', { name: 'Leaderboard table' })` and `getByRole('list', { name: 'Leaderboard cards' })`. This also benefits real screen-reader users.

**Done when:**
- `npm run web:test`, `npm run web:lint`, `npm run web:format:check`, `npm run web:build` all pass.
- Manual verification (see Verification below).

---

## Verification

Branch + docs (commit 1):

1. `git log --oneline -1` shows the new commit on `feature/issue-51-leaderboard-redesign`.
2. `git status` shows a clean tree with no untracked files in `docs/mockups/design_handoff_leaderboard_redesign/` or `docs/plans/`.
3. `npm run web:build && npm run api:build` pass (no source touched, so should be unchanged).

Backend (commit 2):

1. `npm run api:test` — unit + integration green.
2. Start API + DB locally; seed a league with 3 teams and 2 scored race weekends (use existing `/score` endpoint after submitting results, or hand-insert via the dev DB).
3. `curl -H "Authorization: Bearer $JWT" http://localhost:5077/api/leagues/{id}/standings | jq` — verify shape, ordering, positionChange, afterSessionType match expectations.

Frontend wiring (commit 3):

1. `npm run web:test` — green, including the new `league-loader.integration.test.tsx`.
2. `npm run web:dev` + `npm run api:watch`. Sign in, navigate to a league page. The page renders **identically** to before — no visual change. DevTools Network tab shows both `GET /leagues/{id}` and `GET /leagues/{id}/standings` firing in parallel.
3. Navigate to a league id that doesn't exist → "League Not Found" page renders (existing `notFoundComponent`). Same outcome whether the 404 originates from `/leagues/{id}` or `/leagues/{id}/standings`.

Frontend UI (commit 4):

1. `npm run test:all` — full unit/integration suite green.
2. `npm run web:dev` + `npm run api:watch`. Sign in, navigate to a league with scoring data:
   - Header shows name, description, both chips.
   - Table renders on desktop ≥640px; cards render on mobile (resize browser to confirm swap).
   - Own row has tint + border; visible in both light and dark mode (toggle via OS).
   - Up/down/flat deltas display in the right colors.
   - Click own row → `/my-team`; click another row → `/team/$teamId`.
   - Keyboard: Tab through rows; focus ring visible (`ring-ring`). Enter activates the link.
3. Navigate to a league with **no** scoring data: header shows name+description, no chips; table shows all teams with `0` totals and flat dashes.
4. Navigate to a league with **no teams**: empty-state card renders.
5. Lighthouse / DevTools accessibility: own-row border passes WCAG 1.4.11 (3:1 against `--card`) — already validated by the design but worth a quick check post-implementation in both themes.
6. Sentry / browser console: no new errors.

E2E coverage is **not** required for this issue per `CLAUDE.md`'s testing strategy — the changes are component-level UI plus a new read endpoint, both of which are covered by component/integration layers. An E2E here would just re-walk the same path with no new failure mode.
