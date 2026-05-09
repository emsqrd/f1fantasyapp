# Endpoint Authorization Audit (gh #159)

## Context

A sweep of every API endpoint to confirm that each verifies the caller's right to access or modify the resource. Today, four endpoints leak data across users:

- `GET /api/teams` — no authentication at all; returns every team in the database.
- `GET /api/teams/{id}` — no authentication at all; returns any team's roster.
- `GET /api/leagues/{id}` — authenticated, but no membership check; any signed-in user can read **private** leagues.
- `GET /api/leagues/{id}/standings` — same shape: no membership check on private leagues.
- `GET /api/leagues` — authenticated, but returns all leagues including private ones (in scope as part of the sweep).

A broader scan of the other endpoint files (`MeEndpoints`, `LineupEndpoints`, `RaceWeekendResultEndpoints`, `RaceWeekendScoringEndpoints`, `SeasonEndpoints`, `RaceWeekendEndpoints`, `DriverEndpoints`, `ConstructorEndpoints`, `LeagueEndpoints` non-listed routes) found no further gaps: every other route is either correctly authenticated and resource-scoped (`/me/*` derives the user from the JWT; `POST /leagues/{id}/invite` already enforces ownership inside `LeagueInviteService`) or is intentionally public reference data.

Decisions made up-front (one approach each, no alternatives below):

1. `GET /teams` → **delete** the endpoint (no production caller; `getTeams()` in `web/src/services/teamService.ts` is unused).
2. `GET /teams/{id}` → require authentication only; any authenticated user may view a team. Matches the existing `/team/$teamId` UX where the link arrives from a league standings page the user is already viewing.
3. `GET /leagues/{id}` and `GET /leagues/{id}/standings` → public leagues remain visible to any authenticated user; private leagues require league membership (403 otherwise).
4. `GET /leagues` → **delete**. `/me/leagues` and `/leagues/available` already serve the two legitimate views.

## Critical files

Backend
- `api/F1CompanionApi/Api/Endpoints/LeagueEndpoints.cs` — endpoint definitions and handlers for `/leagues/*`.
- `api/F1CompanionApi/Api/Endpoints/TeamEndpoints.cs` — endpoint definitions and handlers for `/teams/*`.
- `api/F1CompanionApi/Domain/Services/LeagueService.cs` — add `IsUserLeagueMemberAsync` helper alongside the existing `GetLeaguesForUserAsync` (which already does the same `LeagueTeams.Any(lt => lt.Team.UserId == userId)` filter at line 192).

Frontend
- `web/src/services/teamService.ts` — remove unused `getTeams()` (line 33–35).
- `web/src/services/teamService.test.ts` — remove `describe('getTeams', ...)` block.

Tests
- `api/F1CompanionApi.IntegrationTests/Scenarios/AuthorizationTests.cs` — extend with the new resource-scoped cases (the existing single test only covers anonymous-401 on `/me/profile`).
- Reuse helpers: `Factory.CreateAuthenticatedAsync()` / `WithDbAsync()` / `db.CreateTeamAsync()` (see `LeagueInviteTests.cs` for the established pattern for setting up two users + a league).

## Implementation — three commits, each self-contained

### Commit 1: Enforce league membership on `GET /leagues/{id}` and `GET /leagues/{id}/standings`

Why first: highest blast radius (private-league leak) and introduces the shared membership helper used elsewhere if needed.

Backend
- Add to `ILeagueService` and `LeagueService`:
  ```csharp
  Task<bool> IsUserLeagueMemberAsync(int leagueId, int userId);
  ```
  Implementation: `_dbContext.LeagueTeams.AnyAsync(lt => lt.LeagueId == leagueId && lt.Team.UserId == userId)`.
- Modify `GetLeagueByIdAsync` handler (`LeagueEndpoints.cs:120`):
  - Inject `IUserProfileService`.
  - After the existing 404 check, if `league.IsPrivate && !await leagueService.IsUserLeagueMemberAsync(id, user.Id)` → `Results.Problem(detail: "You are not a member of this league", statusCode: StatusCodes.Status403Forbidden)`. Log a warning at the same call site, mirroring the existing log style.
- Modify `GetLeagueStandingsAsync` handler (`LeagueEndpoints.cs:141`):
  - Same change. Note: standings response does not currently include `IsPrivate`, so resolve it via `ILeagueService` or extend the standings response to carry it. Recommended path: load the `League` once via `ILeagueService` (or a small `IsPrivateAsync` lookup) before the standings call, since `GetLeagueStandingsAsync` already does a separate league fetch internally — the duplication is minor.

Tests (`AuthorizationTests.cs`)
- `PublicLeague_NonMemberCanViewDetailsAndStandings_ReturnsOk`
- `PrivateLeague_MemberCanViewDetailsAndStandings_ReturnsOk`
- `PrivateLeague_NonMemberCannotViewDetails_Returns403`
- `PrivateLeague_NonMemberCannotViewStandings_Returns403`
- `League_DoesNotExist_Returns404` (preserve existing behavior — 404 must win over 403 to avoid leaking existence)

Quality gates: `npm run api:test:integration && npm run api:format:check`.

### Commit 2: Require auth on `GET /teams/{id}`; delete `GET /teams`

Backend (`TeamEndpoints.cs`)
- Delete the `GetTeamsAsync` handler and its `app.MapGet("/teams", GetTeamsAsync)...` registration (lines 21, 54–63).
- Add `.RequireAuthorization()` to the `GetTeamById` registration (line 23).

Frontend
- `web/src/services/teamService.ts`: delete `getTeams()` (lines 33–35).
- `web/src/services/teamService.test.ts`: delete the `describe('getTeams', ...)` block.

Tests — additions
- Backend integration (`AuthorizationTests.cs`):
  - `GetTeamById_Unauthenticated_Returns401`
  - `GetTeamById_Authenticated_ReturnsOk`
  - `GetTeams_Endpoint_Removed_Returns404`

Tests — removals (these reference the deleted handler and would fail to compile)
- `api/F1CompanionApi.UnitTests/Api/Endpoints/TeamEndpointsTests.cs`:
  - Delete test `GetTeamsAsync_MultipleTeams_ReturnsAllTeams` (around line 37).
  - Delete test `GetTeams_EmptyDatabase_ReturnsEmptyList` (around line 260).
  - Delete the `InvokeGetTeamsAsync` private helper (around lines 369–380) and any unused imports it brought in.
- `web/src/services/teamService.test.ts`:
  - Delete the entire `describe('getTeams', ...)` block (around lines 117–149) — three `it` cases.

Quality gates: `npm run api:test:integration && npm run web:test && npm run web:lint && npm run web:format:check && npm run api:format:check`.

### Commit 3: Delete `GET /leagues`

Backend
- `LeagueEndpoints.cs`: delete `GetLeaguesAsync` and its registration (lines 21–25, 94–103).
- `LeagueService.cs`: confirm no other caller of `GetLeaguesAsync()`; if none, remove it from `ILeagueService` and `LeagueService` (lines 13, 103–112).

Frontend
- Grep `web/src/` for `'/leagues'` (exact) and `getLeagues(` to confirm no caller. If any caller exists, redirect to `/me/leagues` or `/leagues/available` per intent and adjust callers + tests.

Tests — additions (`AuthorizationTests.cs`)
- `GetAllLeagues_Endpoint_Removed_Returns404`

Tests — removals (these reference the deleted endpoint and service method)
- `api/F1CompanionApi.UnitTests/Api/Endpoints/LeagueEndpointsTests.cs`:
  - Delete `GetLeaguesAsync_LeaguesExist_ReturnsOkWithLeagues` (around line 106).
  - Delete `GetLeaguesAsync_NoLeagues_ReturnsOkWithEmptyCollection` (around line 146).
  - Delete `GetLeaguesAsync_ServiceReturnsEmptyCollection_ReturnsOkWithEmptyCollection` (around line 164).
  - Delete the `InvokeGetLeaguesAsync` private helper (around lines 965–980).
- `api/F1CompanionApi.UnitTests/Services/LeagueServiceTests.cs` (only if `ILeagueService.GetLeaguesAsync` is removed):
  - Delete `GetLeaguesAsync_NoLeagues_ReturnsEmptyCollection` (around line 194).
  - Delete `GetLeaguesAsync_MultipleLeagues_ReturnsAllLeagues` (around line 209).
- `web/src/services/`: no `getLeagues()` exists — confirmed. The frontend uses `getMyLeagues` / `getAvailableLeagues` instead, so no frontend deletions needed.

Quality gates: same as Commit 2.

## Verification

End-to-end manual checks (after all three commits land):

```bash
# Private-league membership enforcement (uses two users in a private league)
npm run api:watch                                     # in one shell
# In another shell, with two valid Supabase JWTs:
curl -H "Authorization: Bearer $JWT_MEMBER"     http://localhost:5077/api/leagues/$ID    # 200
curl -H "Authorization: Bearer $JWT_NONMEMBER"  http://localhost:5077/api/leagues/$ID    # 403
curl -H "Authorization: Bearer $JWT_NONMEMBER"  http://localhost:5077/api/leagues/$ID/standings  # 403

# Removed surfaces return 404
curl -H "Authorization: Bearer $JWT" http://localhost:5077/api/teams       # 404
curl -H "Authorization: Bearer $JWT" http://localhost:5077/api/leagues     # 404

# Auth required on teams/{id}
curl http://localhost:5077/api/teams/1                                    # 401
curl -H "Authorization: Bearer $JWT" http://localhost:5077/api/teams/1    # 200 or 404
```

Automated:
- `npm run api:test` — unit + integration including the new authorization scenarios.
- `npm run web:test` — confirms removed `getTeams` did not break adjacent tests.
- `npm run e2e` — the existing browser suite exercises the league-details and team-detail flows; smoke check for regressions.
