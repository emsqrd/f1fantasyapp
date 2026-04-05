# Scoring Engine (Issue #57)

## Context

The scoring engine translates race results into fantasy team scores. It follows the same `ApplicationDbContext`-injected service pattern as the rest of the codebase. Session-level calculation methods are synchronous (pure math on entity objects), while the top-level async methods load their own data from the DB.

**Entity-first scoring:** The engine scores every driver and constructor for a race first, persisting those scores independently of team rosters. Team scores are then assembled from the persisted entity scores in a separate step. This separation means entity scores can be recalculated without re-scanning every team, and team assembly is a simple lookup against pre-computed values.

**Progressive scoring:** Calling `ScoreRaceEntitiesAsync` at any point during a weekend scores whatever results have been ingested so far. The captain 2× multiplier is applied when assembling team scores in `ScoreTeamsForRaceAsync`.

This unblocks the scoring orchestration layer (#61) which will handle when to trigger scoring.

**Authoritative scoring rules:** `docs/research/fantasy-rules/decisions/scoring.md`

## Design Decisions

**Matches existing service pattern.** Injects `ApplicationDbContext` and `ILogger<ScoringService>`, registered as scoped in `ServiceExtensions.cs`. Interface + implementation in same file.

**Entity-first, then team assembly.** `ScoreRaceEntitiesAsync` scores all drivers and constructors for a race, persisting results to `DriverRaceScore` and `ConstructorRaceScore`. `ScoreTeamsForRaceAsync` reads those persisted scores and assembles `TeamRaceScore` records, applying the captain multiplier at this step. This keeps entity scoring independent of team configuration.

**Domain model records in `Domain/Models/`.** Distinct from `Api/Models/` (HTTP DTOs).

**Constants in `Domain/Constants/`.** `BudgetConstants.cs` lives alongside `ScoringConstants.cs`. Uses `FrozenDictionary<int, int>` for position point tables.

**Session methods are synchronous, top-level methods are async.** Session scoring methods take entity objects and do pure math. `ScoreRaceEntitiesAsync` and `ScoreTeamsForRaceAsync` query the DB then call the session methods.

**Captain multiplier applied at team assembly.** The multiplier is applied to an entity's `TotalPoints` in `ScoreTeamsForRaceAsync`, not per-session at the driver level. This keeps driver and constructor scores captain-agnostic and reusable across teams.

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
  - Constants: `SprintOvertakeBonus = 1`, `RaceOvertakeBonus = 1`, `SprintFastestLapBonus = 2`, `RaceFastestLapBonus = 3`, `SprintDnfPenalty = -5`, `RaceDnfPenalty = -10`, `CaptainMultiplier = 2`

**`api/F1CompanionApi/Domain/Models/DriverSessionScore.cs`**
- Record with: `PositionPoints`, `PositionChangePoints`, `OvertakePoints`, `FastestLapPoints`, `PenaltyPoints`
- Computed property: `Total` = sum of all components
- Static field: `Empty` returning all-zero record

**`api/F1CompanionApi/Domain/Models/DriverWeekendScore.cs`**
- Record with: `DriverId`, `Qualifying` (`int?`), `Sprint` (`DriverSessionScore?`), `Race` (`DriverSessionScore?`)
- Computed property: `TotalPoints` = sum of all sessions

**`api/F1CompanionApi/Domain/Models/ConstructorWeekendScore.cs`**
- Record with: `ConstructorId`, `Qualifying` (`int?`), `Sprint` (`DriverSessionScore?`), `Race` (`DriverSessionScore?`)
- Computed per-session totals: `QualifyingTotal`, `SprintTotal`, `RaceTotal`
- `Total` = sum of session totals

### Tests

**`api/F1CompanionApi.UnitTests/Domain/Constants/ScoringConstantsTests.cs`**
- Verify each position table returns correct points for all positions including boundary

**`api/F1CompanionApi.UnitTests/Domain/Models/DriverSessionScoreTests.cs`**
- `Total` sums all components correctly
- `Empty` returns zero total

**`api/F1CompanionApi.UnitTests/Domain/Models/DriverWeekendScoreTests.cs`**
- `TotalPoints` sums session totals with nullable handling

**`api/F1CompanionApi.UnitTests/Domain/Models/ConstructorWeekendScoreTests.cs`**
- Per-session totals correctly aggregate both drivers' raw points
- Null sessions contribute zero

---

## Commit 2: Session-level scoring methods

Core calculation logic: qualifying, sprint, and race scoring for individual drivers.

### New Files

**`api/F1CompanionApi/Domain/Services/ScoringService.cs`** (interface + implementation in same file)

Constructor: `ScoringService(ApplicationDbContext dbContext, ILogger<ScoringService> logger)`

```
IScoringService:
  int CalculateDriverQualifyingPoints(DriverQualifyingResult result)
  DriverSessionScore CalculateDriverSprintPoints(DriverRaceResult result)
  DriverSessionScore CalculateDriverRacePoints(DriverRaceResult result)
```

`CalculateDriverQualifyingPoints`:
- Look up position in qualifying table → returns position points as `int`

`CalculateDriverSprintPoints` / `CalculateDriverRacePoints`:
- Both delegate to a private `CalculateDriverSessionPoints` with the appropriate table and constants
- If classified: PositionPoints from table, PositionChange = GridPosition - FinishPosition, Overtakes × bonus
- If DNF/DSQ/DNS: PenaltyPoints applied, PositionChange = 0, Overtakes still counted
- FastestLap: bonus regardless of status
- Returns `DriverSessionScore`

### Modified Files

**`api/F1CompanionApi/Extensions/ServiceExtensions.cs`** — add `services.AddScoped<IScoringService, ScoringService>()`

### Tests

**`api/F1CompanionApi.UnitTests/Services/ScoringServiceTests.cs`**

Qualifying tests:
- Correct points for P1 (10), P10 (1), P11+ (0)

Sprint tests:
- Position points for classified (P1=8, P8=1, P9+=0)
- Position gain/loss
- Overtake points, fastest lap bonus (+2)
- DNF penalty (-5, no position change, overtakes still counted)
- Fastest lap with DNF (-5 + 2 = -3 net)

Race tests:
- Position points (P1=25, P10=1, P11+=0)
- Position gain/loss
- Overtakes, fastest lap (+3)
- DNF/DSQ/DNS penalty (-10), fastest lap with DNF (-10 + 3 = -7)
- Worked examples: dominant (25 race pts), mid-field mover (14 total)

---

## Commit 3: Weekend aggregation and constructor scoring

Combines per-session driver scores into a weekend view, aggregates constructor scores from their drivers.

### Methods Added to `IScoringService`

```
DriverWeekendScore CalculateDriverWeekendPoints(
    int driverId,
    DriverQualifyingResult? qualifying,
    DriverRaceResult? sprint,
    DriverRaceResult? race)

ConstructorWeekendScore CalculateConstructorWeekendPoints(
    int constructorId,
    DriverWeekendScore driver1,
    DriverWeekendScore driver2)
```

`CalculateDriverWeekendPoints`:
- Calls qualifying/sprint/race methods only when the respective result is non-null
- Returns assembled `DriverWeekendScore`

`CalculateConstructorWeekendPoints`:
- Sums both drivers' session scores using a private `SumDriverSessions` helper
- Sessions where neither driver participated produce `null`

### Tests

Weekend:
- Standard weekend sums all sessions
- Null sprint / null qualifying → zero contribution
- Partial weekend (sprint only) → only sprint points

Constructor:
- Per-session totals sum both drivers' raw points
- Worked example: McLaren (43 pts)
- One driver DNF: penalty flows through in the appropriate session total

---

## Commit 4: Persistence entities for entity and team scores

New DB entities to store calculated scores. These are written by the scoring service and read back when assembling team scores.

### New Files

**`api/F1CompanionApi/Data/Entities/DriverRaceScore.cs`**
- Unique index on `(DriverId, RaceId)`
- Per-session point breakdowns: qualifying position points; sprint and race components (position, position change, overtakes, fastest lap, penalty, total)
- `TotalPoints` (across all sessions), `CalculatedAt`

**`api/F1CompanionApi/Data/Entities/ConstructorRaceScore.cs`**
- Same shape as `DriverRaceScore` but keyed on `ConstructorId`

**`api/F1CompanionApi/Data/Entities/TeamRaceScore.cs`**
- Unique index on `(TeamId, RaceId)`
- `TotalPoints`, `CalculatedAt`

### Migration

`dotnet ef migrations add AddEntityRaceScores --project F1CompanionApi`

---

## Commit 5: `ScoreRaceEntitiesAsync` and `ScoreTeamsForRaceAsync`

Top-level async methods that load data from the DB, orchestrate calculation, and persist results.

### Methods Added to `IScoringService`

```
Task ScoreRaceEntitiesAsync(int raceId)
Task ScoreTeamsForRaceAsync(int raceId)
```

`ScoreRaceEntitiesAsync`:
1. Load the `Race` record (throws if not found)
2. Load all qualifying results and race results for the race
3. Load active `SeasonDriver` records for the race's season
4. Score each driver who appears in either result set via `CalculateDriverWeekendPoints`
5. Group season drivers by constructor; score each constructor via `CalculateConstructorWeekendPoints` (throws if a constructor doesn't have results for both drivers)
6. Delete existing `DriverRaceScore` and `ConstructorRaceScore` rows for the race, insert new ones — committed atomically

`ScoreTeamsForRaceAsync`:
1. Load `DriverRaceScore`, `ConstructorRaceScore`, and `LineupEntry` rows for the race
2. Group lineup entries by team; for each entry look up the entity's `TotalPoints` and apply `CaptainMultiplier` if `IsCaptain`
3. Delete existing `TeamRaceScore` rows for the race, insert new ones

### Tests

`ScoreRaceEntitiesAsync`:
- Standard weekend: correct per-field and total driver scores persisted
- Sprint weekend: sprint components populated
- Constructor scores: components aggregated from both drivers
- Constructor missing one driver's results: throws `InvalidOperationException`
- Race not found: throws `InvalidOperationException`
- Called twice: replaces existing scores (idempotent)
- No results: nothing persisted

`ScoreTeamsForRaceAsync`:
- Single driver entry: correct total persisted
- Captain driver: total is doubled
- Multiple teams with mixed driver/constructor entries: all teams scored correctly
- Called twice: replaces existing team scores (idempotent)

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

## Key Files

| File | Action |
|------|--------|
| `api/F1CompanionApi/Domain/Constants/BudgetConstants.cs` | Moved (from `Domain/`) |
| `api/F1CompanionApi/Domain/Constants/ScoringConstants.cs` | New |
| `api/F1CompanionApi/Domain/Models/DriverSessionScore.cs` | New |
| `api/F1CompanionApi/Domain/Models/DriverWeekendScore.cs` | New |
| `api/F1CompanionApi/Domain/Models/ConstructorWeekendScore.cs` | New |
| `api/F1CompanionApi/Domain/Services/ScoringService.cs` | New |
| `api/F1CompanionApi/Extensions/ServiceExtensions.cs` | Modified (DI registration) |
| `api/F1CompanionApi/Domain/Services/TeamService.cs` | Modified (namespace update) |
| `api/F1CompanionApi/Domain/Exceptions/BudgetExceededException.cs` | Modified (namespace update) |
| `api/F1CompanionApi/Api/Mappers/TeamResponseMapper.cs` | Modified (namespace update) |
| `api/F1CompanionApi/Data/Entities/DriverRaceScore.cs` | New |
| `api/F1CompanionApi/Data/Entities/ConstructorRaceScore.cs` | New |
| `api/F1CompanionApi/Data/Entities/TeamRaceScore.cs` | New |
| `api/F1CompanionApi.UnitTests/Domain/Constants/ScoringConstantsTests.cs` | New |
| `api/F1CompanionApi.UnitTests/Domain/Models/*.cs` | New (3 files) |
| `api/F1CompanionApi.UnitTests/Services/ScoringServiceTests.cs` | New |
