# Scoring Engine (Issue #57)

## Context

The scoring engine translates race results into fantasy team scores. It follows the same `ApplicationDbContext`-injected service pattern as the rest of the codebase. The session-level calculation methods are synchronous (pure math on entity objects), while the top-level `CalculateTeamRaceScoreAsync` loads its own data from the DB.

**Progressive scoring:** The engine works at any point during a weekend. After each event (sprint → qualifying → race), calling the engine returns the team's cumulative score with per-session breakdowns. The captain 2× multiplier applies per-session so progressive totals reflect it immediately.

This unblocks the scoring orchestration layer (#61) which will handle when to trigger scoring and persisting `TeamRaceScore` records.

**Authoritative scoring rules:** `docs/research/fantasy-rules/decisions/scoring.md`

## Design Decisions

**Matches existing service pattern.** Injects `ApplicationDbContext` and `ILogger<ScoringService>`, registered as scoped in `ServiceExtensions.cs`. Interface + implementation in same file.

**Score models mirror the data model separation.** `DriverQualifyingResult` and `DriverRaceResult` are already separate entities, so the score models follow suit: `DriverQualifyingScore` (position points only) and `DriverSessionScore` (full breakdown for sprint/race).

**Per-session scoring for both drivers and constructors.** A team's qualifying score = sum of driver qualifying scores (captain-adjusted) + sum of constructor qualifying scores. Constructor and driver scoring happen together per session, not as separate aggregation steps.

**Domain model records in `Domain/Models/`.** New directory, distinct from `Api/Models/` (HTTP DTOs).

**Constants in `Domain/Constants/`.** New directory. Move `BudgetConstants.cs` here alongside new `ScoringConstants.cs`. Uses `FrozenDictionary<int, int>` for position point tables.

**Session methods are synchronous, top-level method is async.** Session scoring methods take entity objects and do pure math. `CalculateTeamRaceScoreAsync` queries the DB then calls the session methods.

**Qualifying cancelled = no qualifying results exist.** If there are no `DriverQualifyingResult` rows for a race, position change is not scored for the race session.

---

## Commit 1: Move `BudgetConstants` to `Domain/Constants/`, add scoring constants and domain model records

Establishes the organizational structure and vocabulary: point tables, penalty values, and result record types.

### Moved Files

**`api/F1CompanionApi/Domain/BudgetConstants.cs`** → **`api/F1CompanionApi/Domain/Constants/BudgetConstants.cs`**
- Update namespace from `F1CompanionApi.Domain` to `F1CompanionApi.Domain.Constants`
- Update references in: `TeamService.cs`, `BudgetExceededException.cs`, `TeamResponseMapper.cs`, `BudgetExceededExceptionTests.cs`

### New Files

**`api/F1CompanionApi/Domain/Constants/ScoringConstants.cs`**
- Namespace: `F1CompanionApi.Domain.Constants`
- Static class with:
  - `QualifyingPositionPoints`: `FrozenDictionary<int, int>` — P1=10..P10=1
  - `SprintPositionPoints`: `FrozenDictionary<int, int>` — P1=8..P8=1
  - `RacePositionPoints`: `FrozenDictionary<int, int>` — P1=25, P2=18, P3=15, P4=12, P5=10, P6=8, P7=6, P8=4, P9=2, P10=1
  - Constants: `SprintFastestLapBonus = 2`, `RaceFastestLapBonus = 3`, `SprintDnfPenalty = -5`, `RaceDnfPenalty = -10`, `CaptainMultiplier = 2`
  - Static helper: `int GetPositionPoints(FrozenDictionary<int, int> table, int position)` — returns mapped value or 0

**`api/F1CompanionApi/Domain/Models/DriverQualifyingScore.cs`**
- Record with: `DriverId`, `PositionPoints`

**`api/F1CompanionApi/Domain/Models/DriverSessionScore.cs`**
- Record with: `DriverId`, `SessionName` (string), `PositionPoints`, `PositionChangePoints`, `OvertakePoints`, `FastestLapPoints`, `PenaltyPoints`
- Computed property: `Total` = sum of all components
- Static factory: `Empty(int driverId, string sessionName)` returning all-zero record

**`api/F1CompanionApi/Domain/Models/DriverWeekendScore.cs`**
- Record with: `DriverId`, `Qualifying` (DriverQualifyingScore?), `Sprint` (DriverSessionScore?), `Race` (DriverSessionScore?), `IsCaptain`
- Computed per-session adjusted values (captain 2× applied per session):
  - `AdjustedQualifying` = `(Qualifying?.PositionPoints ?? 0) * Multiplier`
  - `AdjustedSprint` = `(Sprint?.Total ?? 0) * Multiplier`
  - `AdjustedRace` = `(Race?.Total ?? 0) * Multiplier`
- `RawTotal` = sum of raw session values
- `AdjustedTotal` = sum of adjusted session values (equivalent to `RawTotal * Multiplier`)
- Private `Multiplier` = `IsCaptain ? CaptainMultiplier : 1`

**`api/F1CompanionApi/Domain/Models/ConstructorWeekendScore.cs`**
- Record with: `ConstructorId`, `Driver1` (DriverWeekendScore), `Driver2` (DriverWeekendScore)
- Per-session totals (uses raw driver totals, not captain-adjusted):
  - `QualifyingTotal` = sum of both drivers' qualifying position points
  - `SprintTotal` = sum of both drivers' sprint totals
  - `RaceTotal` = sum of both drivers' race totals
- `Total` = `QualifyingTotal + SprintTotal + RaceTotal`

**`api/F1CompanionApi/Domain/Models/TeamRaceScoreBreakdown.cs`**
- Record with: `TeamId`, `RaceId`, `DriverScores` (list of DriverWeekendScore), `ConstructorScores` (list of ConstructorWeekendScore)
- Per-session team totals:
  - `QualifyingTotal` = sum of drivers' `AdjustedQualifying` + sum of constructors' `QualifyingTotal`
  - `SprintTotal` = sum of drivers' `AdjustedSprint` + sum of constructors' `SprintTotal`
  - `RaceTotal` = sum of drivers' `AdjustedRace` + sum of constructors' `RaceTotal`
- `TotalPoints` = `QualifyingTotal + SprintTotal + RaceTotal`

### Tests

**`api/F1CompanionApi.UnitTests/Domain/Constants/ScoringConstantsTests.cs`**
- Verify each position table returns correct points for all positions including boundary (P10/P8/P11+)
- Verify `GetPositionPoints` returns 0 for out-of-range positions

**`api/F1CompanionApi.UnitTests/Domain/Models/DriverSessionScoreTests.cs`**
- `Total` sums all components correctly (positive, negative, mixed)
- `Empty` returns zero total

**`api/F1CompanionApi.UnitTests/Domain/Models/DriverWeekendScoreTests.cs`**
- `RawTotal` sums session totals (with nullable handling)
- `AdjustedTotal` doubles when captain, unchanged when not
- Per-session adjusted values double when captain
- Null sessions contribute zero to both raw and adjusted

**`api/F1CompanionApi.UnitTests/Domain/Models/ConstructorWeekendScoreTests.cs`**
- Per-session totals correctly sum both drivers' raw points
- Captain multiplier on one driver doesn't affect constructor totals
- Null sessions contribute zero

**`api/F1CompanionApi.UnitTests/Domain/Models/TeamRaceScoreBreakdownTests.cs`**
- Per-session team totals combine driver adjusted + constructor totals
- `TotalPoints` = sum of session totals

---

## Commit 2: Session-level scoring methods

Core calculation logic: qualifying, sprint, and race scoring for individual drivers.

### New Files

**`api/F1CompanionApi/Domain/Services/ScoringService.cs`** (interface + implementation in same file)

Constructor: `ScoringService(ApplicationDbContext dbContext, ILogger<ScoringService> logger)`

```
IScoringService:
  DriverQualifyingScore CalculateDriverQualifyingPoints(DriverQualifyingResult result)
  DriverSessionScore CalculateDriverSprintPoints(DriverRaceResult result)
  DriverSessionScore CalculateDriverRacePoints(DriverRaceResult result, bool qualifyingOccurred = true)
```

`CalculateDriverQualifyingPoints`:
- Look up position in qualifying table → PositionPoints
- Returns `DriverQualifyingScore`

`CalculateDriverSprintPoints`:
- If classified: PositionPoints from sprint table, PositionChange = GridPosition - FinishPosition, Overtakes from result
- If DNF/DSQ/DNS: PenaltyPoints = -5, PositionChange = 0, but Overtakes still counted
- FastestLap: +2 regardless of status
- Returns `DriverSessionScore`

`CalculateDriverRacePoints(result, qualifyingOccurred)`:
- Same structure as sprint but with race table, +3 fastest lap, -10 penalty
- If `qualifyingOccurred == false`: PositionChange = 0
- Returns `DriverSessionScore`

### Modified Files

**`api/F1CompanionApi/Extensions/ServiceExtensions.cs`** — add `services.AddScoped<IScoringService, ScoringService>()`

### Tests

**`api/F1CompanionApi.UnitTests/Services/ScoringServiceTests.cs`**

Uses in-memory DbContext (same pattern as other service tests).

Qualifying tests:
- Correct points for P1 (10), P10 (1), P11+ (0)

Sprint tests:
- Position points for classified (P1=8, P8=1, P9+=0)
- Position gain (grid 5, finish 2 → +3)
- Position loss (grid 2, finish 5 → -3)
- Overtake points from result
- Fastest lap bonus (+2)
- DNF/DSQ/DNS penalty (-5, no position change, overtakes still counted)
- Fastest lap with DNF (-5 + 2 = -3 net)

Race tests:
- Position points (P1=25, P10=1, P11+=0)
- Position gain/loss
- Overtakes, fastest lap (+3)
- DNF/DSQ/DNS penalty (-10), fastest lap with DNF (-10 + 3 = -7)
- Cancelled qualifying skips position change
- Worked examples from scoring doc: dominant (35), mid-field mover (14)

---

## Commit 3: Weekend aggregation and constructor scoring

Combines per-session driver scores into a weekend view, aggregates constructor scores from their drivers.

### Methods Added to `IScoringService`

```
DriverWeekendScore CalculateDriverWeekendPoints(
    DriverQualifyingResult? qualifying,
    DriverRaceResult? sprint,
    DriverRaceResult? race,
    bool isCaptain,
    bool qualifyingOccurred = true)

ConstructorWeekendScore CalculateConstructorWeekendPoints(
    int constructorId,
    DriverWeekendScore driver1,
    DriverWeekendScore driver2)
```

`CalculateDriverWeekendPoints`:
- Calls `CalculateDriverQualifyingPoints` if qualifying is non-null, else null
- Calls `CalculateDriverSprintPoints` if sprint is non-null, else null
- Calls `CalculateDriverRacePoints` if race is non-null, else null (passes `qualifyingOccurred`)
- Returns assembled `DriverWeekendScore` with captain flag

`CalculateConstructorWeekendPoints`:
- Simple assembly; computed properties on the record handle per-session and total aggregation

### Tests

Weekend:
- Standard weekend sums all sessions
- Sprint null → zero sprint contribution
- Qualifying null → zero qualifying contribution
- Captain doubles each session independently (AdjustedQualifying, AdjustedSprint, AdjustedRace)
- Captain DNF: race penalty is doubled (-20 from race)
- Worked example: dominant driver (P1 quali + P1 race = 35, as captain = 70)
- Partial weekend: sprint only → only sprint points in result

Constructor:
- Per-session totals sum both drivers' raw points correctly
- Captain multiplier on one driver doesn't affect constructor per-session totals
- Worked example: McLaren (43 pts from scoring doc)
- One driver DNF: penalty flows through in the appropriate session

---

## Commit 4: Team race score calculation

Top-level async method that loads data from the DB and orchestrates the calculation. Works progressively — call it after any session's results are ingested.

### Method Added to `IScoringService`

```
Task<TeamRaceScoreBreakdown> CalculateTeamRaceScoreAsync(int teamId, int raceId)
```

Logic:
1. Load lineup entries for `(teamId, raceId)` from DB
2. Load all qualifying results for the race
3. Load all race results for the race (both `SessionType.Race` and `SessionType.Sprint`)
4. Load season drivers for the race's season (to map constructors → their two drivers)
5. Determine `qualifyingOccurred` = qualifying results exist for this race
6. Separate lineup entries into drivers (`EntityType.Driver`) and constructors (`EntityType.Constructor`)
7. For each driver entry: find their qualifying/sprint/race results, determine captain from `IsCaptain`, call `CalculateDriverWeekendPoints`
8. For each constructor entry: find the constructor's two drivers via `SeasonDriver` mappings, retrieve their already-calculated `DriverWeekendScore`s, call `CalculateConstructorWeekendPoints`
9. Assemble and return `TeamRaceScoreBreakdown`

### New Files (temporary — remove before merging PR)

**`api/F1CompanionApi/Api/Endpoints/DebugScoringEndpoints.cs`**
- `GET /api/debug/score/{teamId}/{raceId}` → calls `IScoringService.CalculateTeamRaceScoreAsync`, returns `TeamRaceScoreBreakdown` as JSON
- `.WithTags("Debug")`, no authorization required
- Registered in `Endpoints.MapEndpoints()` via `.MapDebugScoringEndpoints()`

> **⚠ REMOVE BEFORE MERGE:** `DebugScoringEndpoints.cs` and its registration in `Endpoints.cs` must be removed before the PR is merged.

### Tests

Uses in-memory DbContext seeded with full test data.

- Scores all driver entries for standard weekend
- Constructor per-session totals match sum of their drivers' raw session points
- Captain multiplier reflected in per-session team totals
- No captain set → no multiplier
- Sprint weekend with all session types
- Driver with no results → zero points (not an error)
- No qualifying results → position change not scored for race
- Partial weekend (sprint only ingested) → SprintTotal populated, QualifyingTotal and RaceTotal zero
- Per-session team totals: `QualifyingTotal` = drivers' adjusted qualifying + constructors' qualifying
- Full integration example: multi-driver team, captain set, sprint weekend, includes DNFs — verify per-session and total points match hand-calculated expectation

---

## Verification

After each commit:
```bash
cd api && dotnet build F1CompanionApi/F1CompanionApi.csproj
cd api && dotnet build F1CompanionApi.UnitTests/F1CompanionApi.UnitTests.csproj
cd api && dotnet test F1CompanionApi.UnitTests/F1CompanionApi.UnitTests.csproj
cd api && dotnet csharpier format .
cd api && dotnet format style --exclude **/Migrations/**
cd api && dotnet format analyzers --exclude **/Migrations/**
```

## Pre-Merge Checklist

- [ ] Remove `api/F1CompanionApi/Api/Endpoints/DebugScoringEndpoints.cs`
- [ ] Remove `.MapDebugScoringEndpoints()` call from `Endpoints.cs`

## Key Files

| File | Action |
|------|--------|
| `api/F1CompanionApi/Domain/Constants/BudgetConstants.cs` | Moved (from `Domain/`) |
| `api/F1CompanionApi/Domain/Constants/ScoringConstants.cs` | New |
| `api/F1CompanionApi/Domain/Models/DriverQualifyingScore.cs` | New |
| `api/F1CompanionApi/Domain/Models/DriverSessionScore.cs` | New |
| `api/F1CompanionApi/Domain/Models/DriverWeekendScore.cs` | New |
| `api/F1CompanionApi/Domain/Models/ConstructorWeekendScore.cs` | New |
| `api/F1CompanionApi/Domain/Models/TeamRaceScoreBreakdown.cs` | New |
| `api/F1CompanionApi/Domain/Services/ScoringService.cs` | New |
| `api/F1CompanionApi/Extensions/ServiceExtensions.cs` | Modified (DI registration) |
| `api/F1CompanionApi/Domain/Services/TeamService.cs` | Modified (namespace update) |
| `api/F1CompanionApi/Domain/Exceptions/BudgetExceededException.cs` | Modified (namespace update) |
| `api/F1CompanionApi/Api/Mappers/TeamResponseMapper.cs` | Modified (namespace update) |
| `api/F1CompanionApi.UnitTests/Domain/Constants/ScoringConstantsTests.cs` | New |
| `api/F1CompanionApi.UnitTests/Domain/Models/*.cs` | New (4 files) |
| `api/F1CompanionApi.UnitTests/Services/ScoringServiceTests.cs` | New |
