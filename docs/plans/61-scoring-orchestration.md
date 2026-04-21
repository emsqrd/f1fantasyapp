# Issue #61 — Scoring Orchestration Implementation Plan

## Context

Issue #61 wires the merged scoring engine (#57) into the ingestion flow so players see scores update after each F1 session and team lineups carry forward after each Grand Prix. The refinement doc (`docs/plans/61-scoring-orchestration-refinement.md`) settled the design (Q1–Q9); this plan turns those decisions into three self-contained commits.

Dependencies: #57 (scoring engine, merged), #12 (RaceWeekend rename, merged), #63 (API key auth, merged on main). The `"ApiKeyOnly"` policy is registered at `api/F1CompanionApi/Extensions/ServiceExtensions.cs:138`.

### Design refinements over earlier drafts

Through review we narrowed the API surface considerably:
- **No response DTOs on either endpoint.** Both `/score` and `/advance-lineups` return `204 No Content` on success. The caller already knows `seasonId` and `round`; returning them back is speculative surface. Errors go through `GlobalExceptionHandler` → ProblemDetails as usual.
- **End-of-season is not exceptional.** It happens on schedule once a year and isn't an error. The service no-ops silently when there's no Round N+1; the script handles the operator-facing "final round" message at the orchestration layer, since it already knows the season schedule from FastF1.
- **Next-round-locked is exceptional** ("shouldn't happen" outside of a badly delayed ingest) and maps to 409 via a typed exception, consistent with the codebase's `SlotOccupiedException → 409` pattern.
- **Row-count reporting dropped.** Existing `ScoreRaceEntitiesAsync` / `ScoreTeamsForRaceAsync` return `Task` (verified at `ScoringService.cs:12-13`). Changing those signatures to return counts is scope creep; idempotency is verified by tests, not by response payload.
- **Observability via structured logs, not response bodies.** When the service no-ops (end-of-season) or skips teams (per-team idempotency), it logs at `Information` with `ILogger<T>` named placeholders (per `api/CLAUDE.md`) so the operator can see *why* in `fly logs -a f1fantasyapp`.

## Setup

Before Commit 1, establish the branch and check in the plan document alongside the refinement doc so the team has both artifacts versioned together.

1. From `main`: `git checkout -b feat/61-scoring-orchestration`.
2. Copy this plan to `docs/plans/61-scoring-orchestration.md` (the canonical home per `CLAUDE.md`; `~/.claude/plans/sorted-nibbling-quail.md` remains only as the draft origin).
3. Commit with a `docs:` message, e.g. `docs: add implementation plan for scoring orchestration (#61)`.

This is a pre-flight step, not a commit gate — no build/test needed beyond format check on the markdown.

## Route layout

```
POST /seasons/{seasonId}/race-weekends/{round}/score
POST /seasons/{seasonId}/race-weekends/{round}/advance-lineups
```

Siblings of `/results/*`. Neither takes a request body; both return 204 on success.

---

## Commit 1 — Extract `ResolveRaceWeekendIdAsync` to shared helper (pure refactor)

No behavior change; existing tests continue to pass. Kept as its own commit so the following feature commits can focus narrowly on new behavior. Precedent in recent git history: `refactor(api): tighten API key auth scope and add failure logging`.

**`api/F1CompanionApi/Api/Endpoints/RaceWeekendEndpointHelpers.cs`** (new):
```csharp
internal static class RaceWeekendEndpointHelpers
{
    public static async Task<int?> ResolveRaceWeekendIdAsync(
        IRaceWeekendService raceWeekendService, ILogger logger, int seasonId, int round)
    {
        var id = await raceWeekendService.GetIdByRoundAsync(seasonId, round);
        if (id is null)
            logger.LogWarning(
                "Race weekend for season {SeasonId}, round {Round} not found", seasonId, round);
        return id;
    }
}
```

**`api/F1CompanionApi/Api/Endpoints/RaceWeekendResultEndpoints.cs`** — delete the private `ResolveRaceWeekendIdAsync` at `:61-76`; update its four call sites (`:93`, `:148`, `:209`, `:270` — confirm during implementation) to call `RaceWeekendEndpointHelpers.ResolveRaceWeekendIdAsync`.

**Tests:** no new tests. Verify existing `RaceWeekendResultEndpointsTests.cs` still passes.

---

## Commit 2 — `POST /score` endpoint + `ScoreRaceWeekendAsync` orchestrator

**Why the orchestrator sits on the service, not the endpoint:** team scoring derives from entity scoring — that ordering is a domain invariant, not an API concern. The endpoint stays pure routing; exception→HTTP translation stays in `GlobalExceptionHandler` (pattern: `SlotOccupiedException`, `TeamFullException`).

### Changes

**`api/F1CompanionApi/Domain/Services/ScoringService.cs`** — add to `IScoringService`:
```csharp
Task ScoreRaceWeekendAsync(int raceWeekendId);
```

Implementation wraps the two existing methods:
```csharp
public async Task ScoreRaceWeekendAsync(int raceWeekendId)
{
    _logger.LogInformation("Scoring race weekend {RaceWeekendId}", raceWeekendId);

    try { await ScoreRaceEntitiesAsync(raceWeekendId); }
    catch (Exception ex) when (ex is not ScoringStepFailedException)
    { throw new ScoringStepFailedException("Entities", ex); }

    try { await ScoreTeamsForRaceAsync(raceWeekendId); }
    catch (Exception ex) when (ex is not ScoringStepFailedException)
    { throw new ScoringStepFailedException("Teams", ex); }

    _logger.LogInformation("Scored race weekend {RaceWeekendId} (entities + teams)", raceWeekendId);
}
```

Existing `ScoreRaceEntitiesAsync` / `ScoreTeamsForRaceAsync` stay public for now — their tests remain valid. Making them internal is a follow-up.

**`api/F1CompanionApi/Domain/Exceptions/ScoringStepFailedException.cs`** (new)
- `string Step { get; }` — values `"Entities"` / `"Teams"` (two callsites, no enum needed).
- Inner exception carried.
- Message: `$"{Step} scoring failed: {inner.Message}"`.
- XML `<summary>` per `api/CLAUDE.md`: explain both what triggers the exception and why it's considered exceptional (mirror `SlotOccupiedException`'s doc style).

**`api/F1CompanionApi/Domain/Exceptions/GlobalExceptionHandler.cs`** — add one case before the generic catch-all near line 137:
```csharp
ScoringStepFailedException ex => (
    StatusCodes.Status500InternalServerError,
    $"{ex.Step} Scoring Failed",     // "Entities Scoring Failed" / "Teams Scoring Failed"
    ex.Message
),
```
The handler already logs 5xx at `LogError` and preserves the inner exception on `ProblemDetails` — both are desired here.

**`api/F1CompanionApi/Api/Endpoints/RaceWeekendScoringEndpoints.cs`** (new)
- Static class, `[ExcludeFromCodeCoverage]` on the `Map…` method (mirrors `RaceWeekendResultEndpoints.cs:11`).
- `var group = app.MapGroup("/seasons/{seasonId}/race-weekends/{round}").RequireAuthorization();`
- `group.MapPost("/score", ScoreRaceWeekendAsync).RequireAuthorization("ApiKeyOnly").WithName("ScoreRaceWeekend").WithDescription(...);`
- Private handler: inject `IRaceWeekendService`, `IScoringService`, `int seasonId`, `int round`, `[FromServices] ILogger logger`. Call `RaceWeekendEndpointHelpers.ResolveRaceWeekendIdAsync(...)`.
  - 404 if id is null.
  - Otherwise: `await scoring.ScoreRaceWeekendAsync(raceWeekendId.Value); return Results.NoContent();`
  - No try/catch; exceptions bubble to `GlobalExceptionHandler`.

**`api/F1CompanionApi/Api/Endpoints/Endpoints.cs`** — add `.MapRaceWeekendScoringEndpoints()` to the chain in `MapEndpoints`.

### Tests

**Service tests** — extend `api/F1CompanionApi.UnitTests/Services/ScoringServiceTests.cs`:
- `ScoreRaceWeekendAsync_HappyPath_ScoresEntitiesAndTeams` — seed a scorable weekend; assert `DriverRaceWeekendScores` and `TeamRaceWeekendScores` rows exist.
- `ScoreRaceWeekendAsync_EntitiesThrows_WrapsAsScoringStepFailedWithEntitiesStep` — provoke a failure in entity scoring; assert `Step == "Entities"`.
- `ScoreRaceWeekendAsync_TeamsThrows_WrapsAsScoringStepFailedWithTeamsStep` — if no organic way to provoke via in-memory DB, rely on the endpoint-level mocked coverage below and skip this service test with a note.
- `ScoreRaceWeekendAsync_IsIdempotent_RepeatCallProducesIdenticalRows`.

**Endpoint tests** — new `api/F1CompanionApi.UnitTests/Api/Endpoints/RaceWeekendScoringEndpointsTests.cs`, mirror `RaceWeekendResultEndpointsTests.cs:323-349` (reflection on private static handlers). Mock `IScoringService` + `IRaceWeekendService`:
- 404 when `GetIdByRoundAsync` returns null.
- Happy path returns `Results.NoContent()`.
- `ScoringStepFailedException` thrown by the mocked service bubbles out of the handler (no swallowing).

**Handler test** — extend `GlobalExceptionHandlerTests.cs`:
- `ScoringStepFailedException` with `Step = "Entities"` → 500, title `"Entities Scoring Failed"`.
- `ScoringStepFailedException` with `Step = "Teams"` → 500, title `"Teams Scoring Failed"`.

---

## Commit 3 — `POST /advance-lineups` endpoint + `LineupService`

### Naming

`ILineupService`, not `ILineupAdvancementService`. The broader name stakes out `LineupEntry` as a first-class lifecycle (per-round snapshots + captain) separate from team CRUD. In this PR the class contains only `AdvanceLineupAsync`; a follow-up PR migrates existing `LineupEntry` writes from `TeamService.cs:217-227`, `:286-297`, `:421-433`, and `SetCaptainAsync` (`:577-585`) onto it.

### New files

**`api/F1CompanionApi/Domain/Services/ILineupService.cs`** + **`LineupService.cs`**
```csharp
public interface ILineupService
{
    Task AdvanceLineupAsync(int raceWeekendId);
}
```

**`api/F1CompanionApi/Domain/Exceptions/NextRoundLockedException.cs`** (new)
- Properties: `int NextRound`, `DateTime LockedAt` (matches `RaceWeekend.LockDeadline` at `RaceWeekend.cs:13` — `DateTime?`, not `DateTimeOffset?`).
- Message: `$"Cannot advance lineups: Round {NextRound} is locked as of {LockedAt:O}"`.
- XML `<summary>`: triggered when `advance-lineups` is called on a weekend whose next round's `LockDeadline` has passed; exceptional because it implies ingest is badly delayed and operator intervention is required (per refinement doc Q5).

### Service logic

```csharp
public async Task AdvanceLineupAsync(int raceWeekendId)
{
    var n = await _db.RaceWeekends.FindAsync(raceWeekendId)
        ?? throw new ArgumentException($"RaceWeekend {raceWeekendId} not found");

    var nextRW = await _db.RaceWeekends
        .FirstOrDefaultAsync(rw => rw.SeasonId == n.SeasonId && rw.Round == n.Round + 1);

    if (nextRW is null)
    {
        _logger.LogInformation(
            "Advance-lineups no-op for race weekend {RaceWeekendId} (season {SeasonId}, round {Round}): no Round {NextRound} exists — end of season",
            raceWeekendId, n.SeasonId, n.Round, n.Round + 1);
        return;
    }

    if (nextRW.LockDeadline is { } deadline && deadline <= DateTime.UtcNow)
        throw new NextRoundLockedException(nextRW.Round, deadline);

    // Target rows: N entries for teams that have zero N+1 entries.
    var rowsToCopy = await _db.LineupEntries
        .Where(le => le.RaceWeekendId == n.Id &&
                     !_db.LineupEntries.Any(x => x.RaceWeekendId == nextRW.Id && x.TeamId == le.TeamId))
        .ToListAsync();

    if (rowsToCopy.Count == 0)
    {
        _logger.LogInformation(
            "Advance-lineups no-op for race weekend {RaceWeekendId}: no rows to copy (teams already have Round {NextRound} entries or had no Round {Round} lineup)",
            raceWeekendId, nextRW.Round, n.Round);
        return;
    }

    // LineupEntry has no audit user fields (see LineupEntry.cs — no BaseEntity inheritance);
    // just set CreatedAt, mirroring TeamService.cs:217-227.
    var now = DateTime.UtcNow;
    var newRows = rowsToCopy.Select(le => new LineupEntry
    {
        TeamId = le.TeamId,
        RaceWeekendId = nextRW.Id,
        EntityId = le.EntityId,
        EntityType = le.EntityType,
        SlotPosition = le.SlotPosition,
        IsCaptain = le.IsCaptain,
        CreatedAt = now,
    });
    _db.LineupEntries.AddRange(newRows);
    await _db.SaveChangesAsync();

    var teamsCopied = rowsToCopy.Select(r => r.TeamId).Distinct().Count();
    _logger.LogInformation(
        "Advanced lineups for race weekend {RaceWeekendId}: {TeamsCopied} teams copied to Round {NextRound}",
        raceWeekendId, teamsCopied, nextRW.Round);
}
```

**No budget check** (per `rules.md` §Budget Cap — carried lineups may exceed cap after price drift).

### Registration

`api/F1CompanionApi/Extensions/ServiceExtensions.cs:AddServices` (scoped, alongside existing services):
```csharp
services.AddScoped<ILineupService, LineupService>();
```

### Handler mapping

Extend `GlobalExceptionHandler.cs`:
```csharp
NextRoundLockedException ex => (
    StatusCodes.Status409Conflict,
    "Next Round Locked",
    ex.Message
),
```

### Endpoint

**`api/F1CompanionApi/Api/Endpoints/LineupEndpoints.cs`** (new file, separate from `RaceWeekendScoringEndpoints.cs` so the file name tracks the service split; future lineup lifecycle endpoints — driver add/remove, captain set — will also land here when migrated from `TeamService` in the follow-up PR).

```csharp
public static class LineupEndpoints
{
    [ExcludeFromCodeCoverage]
    public static IEndpointRouteBuilder MapLineupEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/seasons/{seasonId}/race-weekends/{round}")
            .RequireAuthorization();

        group.MapPost("/advance-lineups", AdvanceLineupsAsync)
            .RequireAuthorization("ApiKeyOnly")
            .WithName("AdvanceLineups")
            .WithDescription("Copy Round N lineups to Round N+1. Called once per weekend after scoring the GP.");

        return app;
    }

    private static async Task<IResult> AdvanceLineupsAsync(
        IRaceWeekendService raceWeekendService,
        ILineupService lineupService,
        int seasonId, int round,
        [FromServices] ILogger logger)
    {
        var id = await RaceWeekendEndpointHelpers.ResolveRaceWeekendIdAsync(
            raceWeekendService, logger, seasonId, round);
        if (id is null)
            return Results.Problem(detail: "Race weekend not found", statusCode: 404);

        await lineupService.AdvanceLineupAsync(id.Value);
        return Results.NoContent();
    }
}
```

Register in `Endpoints.cs:MapEndpoints` by chaining `.MapLineupEndpoints()` alongside `.MapRaceWeekendScoringEndpoints()`.

`NextRoundLockedException` bubbles to `GlobalExceptionHandler` → 409. Service silent no-ops still return 204 (there's nothing for the caller to act on; the reason lives in logs).

### Tests

**Service tests** — new `api/F1CompanionApi.UnitTests/Services/LineupServiceTests.cs` (in-memory DB with `Guid.NewGuid()` name, mirror `ScoringServiceTests.cs:19-31`):
- Copies drivers, constructors, and `IsCaptain` flag from N to N+1.
- Skips teams that already have ≥1 N+1 row; copies siblings that don't.
- Throws `NextRoundLockedException` with correct `NextRound` + `LockedAt` when `LockDeadline <= now`; no writes.
- No-ops (no throw, no writes) when no Round N+1 exists.
- Team with zero N entries produces zero N+1 entries.
- Over-cap carry: seed a team whose N lineup value exceeds cap, assert copy succeeds (documents the policy).
- Throws `ArgumentException` when `raceWeekendId` doesn't exist.
- **Log-assertion tests** (one per log path — the operator's "why didn't it advance?" signal IS the contract here). Use `Mock<ILogger<LineupService>>` with `It.IsAny<string>()` matchers to avoid brittle message wording; assert the call happens at `LogLevel.Information`:
  - End-of-season no-op path logs once.
  - No-rows-to-copy path logs once.
  - Happy path logs the "Advanced lineups" line once.

**Endpoint tests** — new `api/F1CompanionApi.UnitTests/Api/Endpoints/LineupEndpointsTests.cs` (mirror `RaceWeekendResultEndpointsTests.cs:323-349` reflection pattern):
- 404 on missing weekend.
- 204 on service success.
- Service-thrown `NextRoundLockedException` bubbles out of the handler (no swallowing).

**Handler test** — extend `GlobalExceptionHandlerTests.cs`:
- `NextRoundLockedException` → 409, title `"Next Round Locked"`, detail includes round + timestamp.

---

## Commit 4 — Python script orchestration

**File:** `api/scripts/ingest_results.py` (416 lines). Target lines verified: three `if payload:` branches at **~362 (quali) / ~376 (sprint) / ~389 (GP)**; `submit_results` at `:287`.

### Changes

1. **`post_score(session, api_url, season_id, round_number)`** — mirrors `submit_results` at `:287`: POST with no body to `/api/seasons/{season_id}/race-weekends/{round_number}/score`. Expects 204. On non-2xx raise `ApiError(f"Score season {season_id} round {round_number}", resp.status_code, resp.text)` (matches existing `ApiError` signature at `:45` / usage at `:299`). Before raising, attempt to parse response body as ProblemDetails JSON and prefer `title` (e.g., `"Entities Scoring Failed"`) as the body arg; fall back to raw `resp.text` if JSON parse fails or `title` is absent. On 204 print `"Scored race weekend (season {season_id}, round {round_number})"`.

2. **`post_advance_lineups(session, api_url, season_id, round_number)`** — POST no body to `.../advance-lineups`. Expects 204. On 409 raise `ApiError` preferring the ProblemDetails `detail` (which includes the locked round and timestamp) over raw body. On other non-2xx raise with parsed `title` or raw body. On 204 print `"Lineups advanced (season {season_id}, round {round_number} → {round_number + 1})"`.

3. **Wire into the three ingest branches**:
   - After each `submit_results(...)` call at lines ~362 / ~376 / ~389, immediately call `post_score(...)`.
   - In the **GP branch only**: after `post_score` returns, call `post_advance_lineups(...)` **only when the script knows there is a next round**. The `race_weekends` list is already fetched at `ingest_results.py:347` and in scope in the GP branch — derive `total_rounds = len(race_weekends)` locally, no refactor:
     ```python
     post_score(api_session, api_url, season_id, round_number)
     if round_number < len(race_weekends):
         post_advance_lineups(api_session, api_url, season_id, round_number)
     else:
         print(f"Final round of season {season_id} — no lineups to advance")
     ```

If any step raises `ApiError`, the script exits non-zero (existing behavior). The operator re-runs the script; all endpoints are idempotent, so repeat calls are safe.

### Tests

Extend `api/scripts/test_ingest_results.py` (uses `unittest.mock`). Patch the module-level session factory to capture URLs and bodies:
- Quali submit → score.
- Sprint submit → score.
- GP submit → score → advance (non-final round).
- Final-round GP: submit → score, then script prints the "no lineups to advance" message and does **not** call `/advance-lineups`.
- 409 from advance-lineups raises `ApiError` mentioning the round and timestamp.
- 500 with title `"Entities Scoring Failed"` surfaces "Entities Scoring Failed" in the error.
- 500 with title `"Teams Scoring Failed"` surfaces "Teams Scoring Failed".
- Non-JSON error body on 500 still produces a readable `ApiError` (doesn't crash on JSON parse).
- Advance is **not** called after qualifying or sprint.

---

## Critical files

- `api/F1CompanionApi/Api/Endpoints/RaceWeekendResultEndpoints.cs` — mirror pattern (route group `:16`, per-route `ApiKeyOnly` `:21,34,47`); private `ResolveRaceWeekendIdAsync` at `:61-76` gets hoisted to the new shared helper file and its four call sites updated.
- `api/F1CompanionApi/Api/Endpoints/RaceWeekendEndpointHelpers.cs` — new shared helper (created in Commit 1, used by all three endpoint files).
- `api/F1CompanionApi/Api/Endpoints/Endpoints.cs` — register new groups (`MapRaceWeekendScoringEndpoints`, `MapLineupEndpoints`).
- `api/F1CompanionApi/Domain/Services/ScoringService.cs` — interface `:10-14`; add `ScoreRaceWeekendAsync`.
- `api/F1CompanionApi/Domain/Exceptions/GlobalExceptionHandler.cs` — switch `:31`; new cases before generic catch-all near `:137`; ProblemDetails shape `:227-240`.
- `api/F1CompanionApi/Domain/Exceptions/SlotOccupiedException.cs` — reference style for new exception classes.
- `api/F1CompanionApi/Extensions/ServiceExtensions.cs` — scoped DI `:99-156`; `"ApiKeyOnly"` policy literal `:138`.
- `api/F1CompanionApi/Data/Entities/LineupEntry.cs:17-30` — `TeamId`, `RaceWeekendId`, `EntityId`, `EntityType`, `SlotPosition`, `IsCaptain`, `CreatedAt`.
- `api/F1CompanionApi/Data/Entities/RaceWeekend.cs:6-18` — `SeasonId`, `Round`, `LockDeadline` (nullable).
- `api/F1CompanionApi.UnitTests/Services/ScoringServiceTests.cs:19-31` — in-memory DB setup to mirror.
- `api/F1CompanionApi.UnitTests/Api/Endpoints/RaceWeekendResultEndpointsTests.cs:323-349` — reflection pattern for private static handlers.
- `api/F1CompanionApi.UnitTests/Domain/Exceptions/GlobalExceptionHandlerTests.cs` — extend with new exception cases.
- `api/scripts/ingest_results.py` (`:287 / ~362 / ~376 / ~389`) and `api/scripts/test_ingest_results.py`.

## Scope notes

- **Concurrency.** Correctness is already guarded: `LineupEntry.cs:10-16` declares a unique index on `(TeamId, RaceWeekendId, EntityType, SlotPosition)`, so two simultaneous `advance-lineups` calls racing on the same weekend cannot produce duplicates — the loser's `SaveChangesAsync` throws `DbUpdateException` (bubbles to `GlobalExceptionHandler` → 500). Acceptable for this issue: the script is single-operator and manually invoked; the scenario is vanishingly unlikely and the 500 is a reasonable terminal state.
- **No schema migration.** This issue touches no EF model fields; no `dotnet ef migrations add` needed.

## Out of scope (deferred follow-ups)

- Migrating existing `LineupEntry` writes from `TeamService.cs` (`:217-227`, `:286-297`, `:421-433`, `SetCaptainAsync` `:577-585`) into `ILineupService`.
- Making `ScoreRaceEntitiesAsync` / `ScoreTeamsForRaceAsync` internal once `ScoreRaceWeekendAsync` is the sole entry point.
- Partial-weekend UI handling ("race points = 0" mid-weekend).
- Bulk / backfill re-scoring endpoint.
- Operator tooling for late-ingest recovery when N+1 is already locked.
- Sentry / alerting — acceptance bar is "operator reads script output + `fly logs`".

## Issue hygiene

- Remove the `Blocked by: #12` / `Blocked by: #63` labels on issue #61 — both dependencies merged.

## Verification

**Per commit:**
```
npm run api:build
npm run api:test
npm run api:format:check
```

**End-to-end smoke test (after commit 3):**
1. `npm run api:watch`.
2. Seed a season with at least two sequential race weekends and a team with a complete lineup on Round N. Ensure Round N's `LockDeadline` has passed and N+1's has not.
3. Run the script against Round N (submits quali → score → [sprint → score if applicable] → GP → score → advance-lineups).
4. Verify via `mcp__supabase__execute_sql` (read-only):
   - `DriverRaceWeekendScores`, `ConstructorRaceWeekendScores`, `TeamRaceWeekendScores` rows exist for Round N.
   - `LineupEntry` rows exist for Round N+1 matching N (drivers, constructors, `IsCaptain` carried).
5. Re-run the script: row counts unchanged; N+1 lineup untouched (per-team skip fires). Check `fly logs` / local log output to confirm the "no rows to copy" info line appeared.
6. Temporarily set N+1 `LockDeadline` to past; re-run — `/advance-lineups` returns 409, no writes, earlier steps still succeed. Script exits non-zero with the locked-round detail.
7. Run the script against the season's final round — script prints `"Final round of season {id} — no lineups to advance"` and does not call `/advance-lineups`; score still runs; exit 0. (Optionally: confirm calling `/advance-lineups` manually on the final round returns 204 and produces the "end of season" log line.)
