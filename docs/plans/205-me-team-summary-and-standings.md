# Plan: `/me/team/summary` and `/me/standings` endpoints (issue #205)

## Context

The Home page needs two aggregate reads to drive the score cards and the my-leagues table. Today no endpoint surfaces season-total points, the latest scored race for the caller's team, or per-league position across all of the caller's memberships. The composition is shaped specifically for the Home page: a single team-summary blob plus one row per league membership.

Both endpoints are authed and scoped to the authed caller's team in the current season. They follow the established `/me/*` patterns: group-level `.RequireAuthorization()`, service-backed handlers, mapper extensions per source entity, response DTOs in `Api/Models/`.

**Decisions:**

- **No team** → `404 Not Found` for `/me/team/summary`; `[]` for `/me/standings`. The summary represents a single resource (the team's season summary) that doesn't exist without a team; standings is a collection that's legitimately empty when the caller has no memberships.
- **No current season** (offseason) → `?? throw new InvalidOperationException("No active season found.")`. Matches `LeagueStandingsService.cs:147` precedent. Broader offseason UX is a separate product decision (see research synthesis: F1 Fantasy locks for ~3.5 months; FPL keeps last-season data as a read-only "trophy room").
- **Service placement** → extend `TeamService` and `LeagueStandingsService`. Each will need `ISeasonService` injected if it doesn't have it already.

---

## Commit 1 — `GET /me/team/summary` *(implemented)*

### Files

- `api/F1CompanionApi/Api/Models/TeamSummaryResponse.cs` — `{ int? SeasonTotalPoints, TeamSummaryLastRaceResponse? LastRace }`.
- `api/F1CompanionApi/Api/Models/TeamSummaryLastRaceResponse.cs` — `{ required int Round, required string Name, required int TotalScore }`.
- `api/F1CompanionApi/Api/Mappers/TeamSummaryResponseMapper.cs` — `(this IReadOnlyList<TeamRaceWeekendScore>, TeamRaceWeekendScore? latest) → TeamSummaryResponse`.
- `api/F1CompanionApi/Api/Mappers/TeamSummaryLastRaceResponseMapper.cs` — `(this TeamRaceWeekendScore) → TeamSummaryLastRaceResponse`.
- `api/F1CompanionApi/Domain/Services/TeamService.cs` + `ITeamService.cs` — add `Task<TeamSummaryResponse?> GetTeamSummaryAsync(int userId)`; inject `ISeasonService`.
- `api/F1CompanionApi/Api/Endpoints/MeEndpoints.cs` — register `teamGroup.MapGet("/summary", ...)` + handler.
- `api/F1CompanionApi.IntegrationTests/Scenarios/MeTeamSummaryTests.cs` — integration tests.
- `api/F1CompanionApi.UnitTests/Services/TeamServiceTests.cs` — update constructor wiring to include new `ISeasonService` mock.

### Mapper split (container/child precedent)

`TeamSummaryResponse` is a container DTO; `TeamSummaryLastRaceResponse` is its nested child. Codebase convention for container/child is one mapper file per source entity, mirroring `TeamResponseMapper` (Team), `TeamDriverResponseMapper` (TeamDriver), `TeamConstructorResponseMapper` (TeamConstructor). The aggregate mapper accepts a pre-selected `latest` so selection logic stays in the service; the mapper is decision-free.

### Service shape

```csharp
public async Task<TeamSummaryResponse?> GetTeamSummaryAsync(int userId)
{
    _logger.LogDebug("Fetching team summary for user {UserId}", userId);

    var team = await _dbContext.Teams.FirstOrDefaultAsync(t => t.UserId == userId);
    if (team is null) return null;  // handler → 404

    var currentSeason =
        await _seasonService.GetCurrentSeasonAsync()
        ?? throw new InvalidOperationException("No active season found.");

    var scoredRaces = await _dbContext
        .TeamRaceWeekendScores.AsNoTracking()
        .Include(s => s.RaceWeekend)
        .Where(s => s.TeamId == team.Id && s.RaceWeekend.SeasonId == currentSeason.Id)
        .ToListAsync();

    var latest = scoredRaces.OrderByDescending(s => s.RaceWeekend.Round).FirstOrDefault();
    return scoredRaces.ToResponseModel(latest);
}
```

### Handler shape

Matches `SeasonEndpoints.GetCurrentSeasonAsync` / `GetSeasonByIdAsync` precedent: null-check → `LogWarning` → `Results.Problem(detail:..., statusCode: Status404NotFound)`.

```csharp
var summary = await teamService.GetTeamSummaryAsync(user.Id);
if (summary is null)
{
    logger.LogWarning("User {UserId} has no team", user.Id);
    return Results.Problem(
        detail: "User has no team",
        statusCode: StatusCodes.Status404NotFound
    );
}
return Results.Ok(summary);
```

### Tests

Service is a thin EF query + trivial in-memory pick; no extractable pure logic. All tests at the HTTP seam via `IntegrationTestBase` + `CreateAuthenticatedAsync` + `TestDataBuilder`. Distinct failure modes only:

- **Auth boundary** — unauthenticated → 401.
- **No team** — authed caller with no team → 404.
- **Team but no scored races** — populated response with null fields. Different EF code path from "no team," so warrants its own test.
- **Happy path** — multiple current-season scored rounds + one prior-season race seeded to verify the season WHERE clause. Asserts sum, latest-round pick by `Round` (not insertion or `RaceDate`), and prior-season exclusion in a single fixture.

---

## Commit 2 — `GET /me/standings`

### Files

- `api/F1CompanionApi/Api/Models/MyLeagueStandingResponse.cs` (new) — `{ required int LeagueId, required string LeagueName, required int TotalTeams, int? Position, int? TotalPoints }`.
- `api/F1CompanionApi/Api/Mappers/MyLeagueStandingResponseMapper.cs` (new) — `(this LeagueTeam membership, int totalTeams, TeamLeagueStanding? latestStanding) → MyLeagueStandingResponse`. Pure shape transformation; service pre-computes `totalTeams` and `latestStanding`.
- `api/F1CompanionApi/Domain/Services/LeagueStandingsService.cs` + `ILeagueStandingsService.cs` — add `Task<IReadOnlyList<MyLeagueStandingResponse>> GetUserStandingsAsync(int userId)`.
- `api/F1CompanionApi/Api/Endpoints/MeEndpoints.cs` — register `meGroup.MapGet("/standings", ...)` + handler.
- `api/F1CompanionApi.IntegrationTests/Scenarios/MeStandingsTests.cs` (new) — integration tests.

### Service shape

Resolve team, league memberships, total-teams-per-league, and latest standing per (team, league) within the current season. Materialise standings then group in memory — bounded by `leagues-per-user × races-per-season` (max ~15 × ~24 ≈ 360 rows).

```csharp
public async Task<IReadOnlyList<MyLeagueStandingResponse>> GetUserStandingsAsync(int userId)
{
    _logger.LogDebug("Fetching standings for user {UserId}", userId);

    var team = await _dbContext.Teams.FirstOrDefaultAsync(t => t.UserId == userId);
    if (team is null) return Array.Empty<MyLeagueStandingResponse>();

    var memberships = await _dbContext
        .LeagueTeams.AsNoTracking()
        .Include(lt => lt.League)
        .Where(lt => lt.TeamId == team.Id)
        .ToListAsync();
    if (memberships.Count == 0) return Array.Empty<MyLeagueStandingResponse>();

    var leagueIds = memberships.Select(m => m.LeagueId).ToList();

    var totalTeamsByLeague = await _dbContext
        .LeagueTeams.Where(lt => leagueIds.Contains(lt.LeagueId))
        .GroupBy(lt => lt.LeagueId)
        .Select(g => new { LeagueId = g.Key, Count = g.Count() })
        .ToDictionaryAsync(x => x.LeagueId, x => x.Count);

    var currentSeason =
        await _seasonService.GetCurrentSeasonAsync()
        ?? throw new InvalidOperationException("No active season found.");

    var latestByLeague = (
        await _dbContext.TeamLeagueStandings.AsNoTracking()
            .Include(ls => ls.RaceWeekend)
            .Where(ls => ls.TeamId == team.Id
                      && leagueIds.Contains(ls.LeagueId)
                      && ls.RaceWeekend.SeasonId == currentSeason.Id)
            .ToListAsync()
    )
        .GroupBy(ls => ls.LeagueId)
        .ToDictionary(g => g.Key, g => g.OrderByDescending(s => s.RaceWeekend.Round).First());

    return memberships
        .Select(m => m.ToResponseModel(
            totalTeamsByLeague.GetValueOrDefault(m.LeagueId, 0),
            latestByLeague.GetValueOrDefault(m.LeagueId)
        ))
        .ToList();
}
```

### Handler shape

Collection endpoint — always returns a list, no null-mapping needed:

```csharp
return Results.Ok(await leagueStandingsService.GetUserStandingsAsync(user.Id));
```

### Tests

Same reasoning as Commit 1 — thin EF + in-memory grouping. All tests at the HTTP seam. Distinct failure modes only:

- **Auth boundary** — unauthenticated → 401.
- **Empty state** — authed caller with no team → `[]`. (Empty memberships collapse to the same path; one test covers both since the early-returns share a shape.)
- **Happy path / multi-league fan-out** — caller's team in three leagues with mixed state: League A has multiple current-season scored rounds (asserts `position`/`totalPoints` reflect the latest round); League B is a member but has no scored race in the current season (asserts null fields while still listing the league); League C has a scored standing only in a *prior* season (asserts current-season WHERE clause excludes it, row remains listed with nulls). Each league has additional non-caller teams so `totalTeams` is exercised end-to-end.

---

## Verification

From repo root:

```bash
npm run api:test:integration   # Testcontainers Postgres — Docker Desktop required
npm run api:test:unit          # sanity
npm run api:format:check       # CSharpier + dotnet format
npm run api:build              # warns-as-errors
```

Manual smoke once both commits land:

```bash
npm run api:watch
# in another terminal, with a valid Supabase JWT in $TOKEN:
curl -H "Authorization: Bearer $TOKEN" http://localhost:5077/api/me/team/summary
curl -H "Authorization: Bearer $TOKEN" http://localhost:5077/api/me/standings
```

Expected: shapes match the issue's documented JSON; nullable fields serialise as `null` when empty; `/me/team/summary` returns 404 (not 200-null) when the caller has no team.
