# Plan: Refactor Race → SeasonRace + Circuit Extraction + /rounds API

## Context

The `Race` entity conflates event identity (a circuit/grand prix) with season occurrence (a specific round with dates and results). This causes data redundancy across seasons, a latent multi-season bug in the ingestion script, and naming confusion with `SessionType.Race`. This refactoring normalizes circuit data into its own entity, renames the entity to `SeasonRace`, and shifts the API resource from `/races` to `/rounds` to eliminate the naming collision.

GitHub issue: #12

## Design Decisions

- **Circuit entity properties**: `Name` (circuit name, e.g., "Albert Park Circuit"), `Location` (e.g., "Melbourne"), `Country` (e.g., "Australia"). Skip `TrackLength`/`Laps` per YAGNI. The GP event name (e.g., "Australian Grand Prix") stays on `SeasonRace.Name` — a circuit can host differently-named GPs across seasons (e.g., Bahrain hosted both "Bahrain GP" and "Sakhir GP" in 2020).
- **Response shape**: Nest circuit data under a `circuit` object in `RoundResponse`
- **FK naming**: Full rename `RaceId` → `SeasonRaceId` across all 6 dependent entities, DB columns, services, and DTOs
- **API result DTOs**: Rename `RaceId` → `roundId` in `DriverQualifyingResultResponse` and `DriverRaceResultResponse` (API consumers think in rounds, not SeasonRaces)
- **Service naming**: `IRaceService` → `IRoundService`; `IRaceResultService` stays (domain concept is "race result")
- **Scoring admin endpoint**: Deferred to separate issue (no admin auth pattern exists yet)
- **Round resolution**: Endpoint layer resolves `{round}` → surrogate ID via `IRoundService`; internal service-to-service calls keep using surrogate IDs

---

## Commit 1: Extract Circuit entity from Race

Create the `Circuit` entity and normalize circuit data out of `Race`. Includes a data migration to populate circuits from existing race rows.

### What moves where

From seed data like: `('Australian Grand Prix', 'Melbourne', 'Melbourne Grand Prix Circuit', 'Australia')`

| Current Race column | Destination | Rationale |
|---|---|---|
| `Name` ("Australian Grand Prix") | Stays on `SeasonRace.Name` | GP event name — can vary per season for the same circuit |
| `Circuit` ("Melbourne Grand Prix Circuit") | `Circuit.Name` | Circuit name — the physical venue, reusable across seasons |
| `Location` ("Melbourne") | `Circuit.Location` | City — property of the circuit |
| `Country` ("Australia") | `Circuit.Country` | Country — property of the circuit |

### New files
- `Data/Entities/Circuit.cs` — entity with `Name` (required), `Location` (required), `Country` (required), inheriting `BaseEntity`. Unique index on `Name`.
- `Api/Models/CircuitResponse.cs` — DTO with `Id`, `Name`, `Location`, `Country`

### Modified files

**Data layer:**
- `Data/Entities/Race.cs` — remove `Circuit` (string), `Location`, `Country` properties; add `CircuitId` (int, required) and `Circuit` (navigation property, type `Circuit`)
- `Data/ApplicationDbContext.cs` — add `DbSet<Circuit> Circuits`; add `OnModelCreating` config for SeasonRace→Circuit relationship (many-to-one, delete: Restrict)

**Migration:**
- Generated via `dotnet ef migrations add ExtractCircuitEntity`
- Schema-only: creates Circuits table, adds `CircuitId` FK to Races, drops `Circuit`/`Location`/`Country` columns
- After applying the migration, re-run the updated `seed.sql` to populate Circuits and re-seed Races with `CircuitId` references

**API layer:**
- `Api/Models/RaceResponse.cs` — replace `Location` (string), `Circuit` (string), `Country` (string) with `Circuit` (CircuitResponse)
- `Api/Mappers/RaceResponseMapper.cs` — map nested `CircuitResponse` from eager-loaded `Circuit` nav property
- `Domain/Services/RaceService.cs` — add `.Include(r => r.Circuit)` to all queries

**Frontend:**
- `web/src/contracts/Race.ts` — replace flat `circuit`/`location`/`country` with nested `circuit: { id, name, location, country }`

**Seed script:**
- `api/supabase/seed.sql` — split the current `INSERT INTO "Races"` block: first insert distinct circuits into a new `INSERT INTO "Circuits"` block, then reference `CircuitId` (via subquery on circuit name) in the `INSERT INTO "Races"` block. Remove `Circuit`, `Location`, `Country` inline values from the Races insert.

**Tests (update Race entity construction to use CircuitId + Circuit entity):**
- `F1CompanionApi.UnitTests/Services/RaceServiceTests.cs`
- `F1CompanionApi.UnitTests/Services/RaceResultServiceTests.cs`
- `F1CompanionApi.UnitTests/Api/Endpoints/RaceEndpointsTests.cs`
- `F1CompanionApi.UnitTests/Api/Endpoints/RaceResultEndpointsTests.cs`
- Any scoring/team service tests that create `Race` instances
- `web/src/services/raceService.test.ts`
- `web/src/components/Team/Team.test.tsx` (if it creates mock Race objects with circuit/location/country)

---

## Commit 2: Rename Race → SeasonRace, RaceId → SeasonRaceId

Pure rename at the entity and data layer. Migration renames the table and all FK columns.

### Renames
- `Data/Entities/Race.cs` → `Data/Entities/SeasonRace.cs` (class `Race` → `SeasonRace`)

### Modified files

**Data layer:**
- `Data/ApplicationDbContext.cs`:
  - `DbSet<Race> Races` → `DbSet<SeasonRace> SeasonRaces`
  - All `OnModelCreating` references: `Entity<Race>` → `Entity<SeasonRace>`, `.Race` nav props → `.SeasonRace`
- `Data/Entities/Season.cs`: `ICollection<Race> Races` → `ICollection<SeasonRace> SeasonRaces`
- 6 dependent entities — for each, rename FK property + navigation property:
  - `DriverQualifyingResult.cs`: `RaceId` → `SeasonRaceId`, `Race Race` → `SeasonRace SeasonRace`
  - `DriverRaceResult.cs`: same pattern
  - `LineupEntry.cs`: same pattern
  - `TeamRaceScore.cs`: same pattern
  - `DriverRaceScore.cs`: same pattern
  - `ConstructorRaceScore.cs`: same pattern
  - Update `[Index(...)]` attributes on each to use `nameof(SeasonRaceId)`
  - Update `OnModelCreating` FK configs: `.HasForeignKey(x => x.RaceId)` → `.HasForeignKey(x => x.SeasonRaceId)`, `.Race` → `.SeasonRace`

**Services:**
- `Domain/Services/RaceService.cs`: `_dbContext.Races` → `_dbContext.SeasonRaces`
- `Domain/Services/RaceResultService.cs`: `_dbContext.Races` → `_dbContext.SeasonRaces`; all `RaceId` references → `SeasonRaceId`
- `Domain/Services/ScoringService.cs`: `_dbContext.Races` → `_dbContext.SeasonRaces`; all `RaceId` → `SeasonRaceId` in queries/entity creation
- `Domain/Services/TeamService.cs`: `_dbContext.Races` → `_dbContext.SeasonRaces`; `Race?` → `SeasonRace?` for private helpers; `le.RaceId` → `le.SeasonRaceId`; `RaceId = ...` → `SeasonRaceId = ...` in LineupEntry creation

**Mappers:**
- `Api/Mappers/RaceResponseMapper.cs`: parameter type `Race` → `SeasonRace`

**Migration:**
- `RenameTable(name: "Races", newName: "SeasonRaces")`
- `RenameColumn` for `RaceId` → `SeasonRaceId` on each of the 6 dependent tables
- Update index names accordingly

**Seed script:**
- `api/supabase/seed.sql` — rename `INSERT INTO "Races"` to `INSERT INTO "SeasonRaces"`, update `ON CONFLICT` clause accordingly

**Tests:** Update all entity type references and FK property names across all test files.

> **Note:** API DTOs (`RaceResponse`, etc.) are NOT renamed in this commit — that happens in Commit 3 alongside the route change.

---

## Commit 3: Rename API routes /races → /rounds, rename services and DTOs

Changes the public API surface, renames services to match, and updates the frontend and ingestion script.

### Renames
- `Api/Endpoints/RaceEndpoints.cs` → `Api/Endpoints/RoundEndpoints.cs`
- `Api/Endpoints/RaceResultEndpoints.cs` → `Api/Endpoints/RoundResultEndpoints.cs`
- `Domain/Services/RaceService.cs` → `Domain/Services/RoundService.cs` (interface `IRaceService` → `IRoundService`)
- `Api/Models/RaceResponse.cs` → `Api/Models/RoundResponse.cs`
- `Api/Mappers/RaceResponseMapper.cs` → `Api/Mappers/RoundResponseMapper.cs`
- `web/src/contracts/Race.ts` → `web/src/contracts/Round.ts`
- `web/src/services/raceService.ts` → `web/src/services/roundService.ts`

### Route changes
| Before | After |
|---|---|
| `GET /api/races?seasonId=` | `GET /api/rounds?seasonId=` |
| `GET /api/races/{id}` | `GET /api/rounds/{round}` |
| `PUT /api/races/{raceId}/results/qualifying` | `PUT /api/rounds/{round}/results/qualifying` |
| `GET /api/races/{raceId}/results/qualifying` | `GET /api/rounds/{round}/results/qualifying` |
| `PUT /api/races/{raceId}/results/race` | `PUT /api/rounds/{round}/results/race` |
| `GET /api/races/{raceId}/results/race` | `GET /api/rounds/{round}/results/race` |
| `PUT /api/races/{raceId}/results/sprint` | `PUT /api/rounds/{round}/results/sprint` |
| `GET /api/races/{raceId}/results/sprint` | `GET /api/rounds/{round}/results/sprint` |

### Key behavioral change: round-number routing
- `GET /rounds/{round}` takes a **round number** (not surrogate ID)
- `IRoundService` gets a new method: `ResolveRoundAsync(int round, int? seasonId = null)` → returns surrogate ID (int?) by querying `SeasonRaces.Where(r => r.Round == round && r.SeasonId == seasonId)`
- Default `seasonId` resolution uses `ISeasonService.GetCurrentSeasonAsync()` (same pattern as existing `GetRacesAsync`)
- Result endpoints call `IRoundService.ResolveRoundAsync(round)` first, then pass the surrogate ID to `IRaceResultService` (unchanged interface)

### Modified files

**Endpoints:**
- `RoundEndpoints.cs`: route group `/rounds`, `GET /{round}` handler resolves via `IRoundService`
- `RoundResultEndpoints.cs`: route group `/rounds/{round}/results`, each handler calls `roundService.ResolveRoundAsync(round)` then delegates to `IRaceResultService`
- `Endpoints.cs`: `.MapRaceEndpoints().MapRaceResultEndpoints()` → `.MapRoundEndpoints().MapRoundResultEndpoints()`

**Service:**
- `IRoundService` / `RoundService`:
  - `GetRacesAsync` → `GetRoundsAsync` (returns `IEnumerable<RoundResponse>`)
  - `GetRaceByIdAsync` → `GetByRoundAsync(int round, int? seasonId)` (returns `RoundResponse?`)
  - New: `ResolveRoundAsync(int round, int? seasonId)` → returns `int?` (surrogate ID)
- `Extensions/ServiceExtensions.cs`: registration `IRaceService, RaceService` → `IRoundService, RoundService`

**DTOs:**
- `RoundResponse`: renamed from `RaceResponse`, same properties
- `DriverQualifyingResultResponse`: `RaceId` → `RoundId`
- `DriverRaceResultResponse`: `RaceId` → `RoundId`
- Corresponding mapper updates for the property renames

**Frontend:**
- `web/src/contracts/Round.ts`: interface `Race` → `Round`
- `web/src/services/roundService.ts`: `getRaces()` → `getRounds()` hitting `/rounds`; `getRaceById(id)` → `getRoundByNumber(round)` hitting `/rounds/{round}`
- `web/src/router.tsx`: update imports, function calls, type annotations
- `web/src/components/Team/Team.tsx`: `Race[]` → `Round[]`, update imports

**Ingestion script** (`scripts/ingest_results.py`):
- `fetch_races()` → `fetch_rounds()`: hits `GET /api/rounds`
- `find_race()` → `find_round()`: same logic (search by round number), but now inherently scoped to current season since the API returns current season only — **fixes the latent multi-season bug**
- `submit_results()`: URL changes from `/api/races/{race_id}/results/{session_type}` to `/api/rounds/{round_number}/results/{session_type}` — uses round number directly, no longer needs to extract surrogate ID

**Tests (rename files + update content):**
- `RaceEndpointsTests.cs` → `RoundEndpointsTests.cs`
- `RaceResultEndpointsTests.cs` → `RoundResultEndpointsTests.cs`
- `RaceServiceTests.cs` → `RoundServiceTests.cs`
- `RaceResultServiceTests.cs` — keep name (service name unchanged), update DTO property references
- `web/src/services/raceService.test.ts` → `roundService.test.ts`

---

## Verification

After each commit:
```bash
dotnet build F1CompanionApi/F1CompanionApi.csproj
dotnet test F1CompanionApi.UnitTests/F1CompanionApi.UnitTests.csproj
dotnet csharpier format .
dotnet format style --exclude **/Migrations/**
dotnet format analyzers --exclude **/Migrations/**
cd ../web && npm run typecheck && npm run test
```

After Commit 3 (full end-to-end):
- Start the API and verify `GET /api/rounds` returns round data with nested circuit objects
- Verify `GET /api/rounds/1` returns round 1 of the current season
- Run the ingestion script against a test round to confirm the new routes work
- Verify the frontend loads and displays team/race data correctly

## Risk Notes

- **Commit 1** requires re-seeding after the migration since existing Race rows will be dropped (CircuitId FK is non-nullable). Coordinate migration + re-seed in production.
- **Commit 3** is a coordinated breaking change — API, frontend, and ingestion script must deploy together.
- The migration `Down` methods for Commits 1-2 should be functional but won't be tested extensively (one-way migration in practice).
