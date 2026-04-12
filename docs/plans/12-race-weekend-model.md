# Plan: Scrap `feat/12-race-entity-refactor` and rebuild against the F1 concept model

## Context

The `feat/12-race-entity-refactor` branch has two commits landed and a third pending. All three are renames-around-a-symptom rather than fixes-to-the-cause:

- **Commit 1 (Circuit extraction)** is conceptually sound on its own.
- **Commit 2 (`Race` → `SeasonRace`, `RaceId` → `SeasonRaceId`)** renames the entity but preserves the core modeling mistake: the entity models a **race weekend** (owns a circuit, dates, lock deadline, a boolean `HasSprint` weekend-format hack, and is the parent of qualifying + sprint + grand-prix session results), yet is still called a "race."
- **Commit 3 (pending: `/rounds`, `IRoundService`, `RoundResponse`)** promotes the ordinal to a resource. Per `docs/research/f1-concepts.md`, a **Round** is "the sequential position assigned to a race weekend" — an index, not the thing indexed. And it leaves intact `SessionType.Race` (which really means Grand Prix), `/results/race` (same), and `DriverRaceResult` (which holds both Sprint and Grand Prix session results).

The branch was triggered by the `SessionType.Race` naming collision — but that collision is itself a symptom. "Race" is not a session type in the F1 concept model; the racing sessions are **Sprint** and **Grand Prix**. The refactor renamed around this instead of resolving it.

**The intended outcome:** a domain model whose nouns match `docs/research/f1-concepts.md`, so future work doesn't keep tripping over the same naming fog.

---

## Target domain model

| Concept (per concepts doc) | Entity / enum | Notes |
|---|---|---|
| Race Weekend | `RaceWeekend` | Replaces `Race` / `SeasonRace`. Full field set: `SeasonId` (FK), `Round` (ordinal within season), `Name` (the Grand Prix event name, e.g. "Australian Grand Prix" — varies per season even for same circuit), `CircuitId` (FK) + `Circuit` navigation, `RaceDate`, `LockDeadline?`, `WeekendFormat` (replaces `HasSprint`). Unique index `(SeasonId, Round)`. |
| Circuit | `Circuit` | Unchanged from current Commit 1 design. |
| Grand Prix Qualifying results | `DriverQualifyingResult` (FK `RaceWeekendId`) | Stays separate — qualifying only has `Position`. Conflating with racing results would make the schema dishonest. |
| Sprint + Grand Prix results | `DriverRacingResult` (FK `RaceWeekendId`, `SessionType`) | Rename of `DriverRaceResult`. "Racing" mirrors the concepts doc's session category. Discriminator distinguishes Sprint vs Grand Prix. Fields: `GridPosition`, `FinishPosition?`, `Overtakes`, `FastestLap`, `Status` (`RacingStatus`). Unique index `(DriverId, RaceWeekendId, SessionType)`. |
| Racing session type | `SessionType` enum: `GrandPrix`, `Sprint` | Rename of current `{Race, Sprint}`: `Race` → `GrandPrix`. Scoped to racing sessions only; qualifying doesn't use it (only one scored qualifying session exists). |
| Racing classification status | `RacingStatus` enum: `Classified`, `DNF`, `DSQ`, `DNS` | Rename of current `RaceStatus`. Mirrors `DriverRacingResult` parent naming. |
| Weekend format | `WeekendFormat` enum `{ Standard, Sprint }` on `RaceWeekend` | Replaces the `HasSprint` boolean. Enum is more honest about the closed set of formats. |

Dependent entities (`LineupEntry`, `TeamRaceScore`, `DriverRaceScore`, `ConstructorRaceScore`) rename their FK `SeasonRaceId` / `RaceId` → `RaceWeekendId` and navigation properties `.SeasonRace` / `.Race` → `.RaceWeekend`.

**API surface:**

| Resource | Route |
|---|---|
| Current season | `GET /api/seasons/current` |
| List weekends in a season | `GET /api/seasons/{seasonId}/race-weekends` |
| Get one weekend by round | `GET /api/seasons/{seasonId}/race-weekends/{round}` |
| Qualifying results | `GET/PUT /api/seasons/{seasonId}/race-weekends/{round}/results/qualifying` |
| Sprint results | `GET/PUT /api/seasons/{seasonId}/race-weekends/{round}/results/sprint` |
| Grand Prix results | `GET/PUT /api/seasons/{seasonId}/race-weekends/{round}/results/grand-prix` |

`seasonId` is explicit in the path — the current "resolve current season inside the service" pattern goes away entirely. Frontend passes current-season id from a single `/seasons/current` lookup (or similar), not from implicit server-side resolution.

Service naming: `IRaceWeekendService` / `RaceWeekendService` (was `IRaceService`); `IRaceWeekendResultService` / `RaceWeekendResultService` (was `IRaceResultService`). No `IRoundService` — round is a lookup key, not a resource.

---

## Execution plan

### Step 1: Scrap the branch

No PR has been opened from the branch, so cleanup is local-only:

```bash
git checkout main
git branch -D feat/12-race-entity-refactor
```

Archive the existing plan: rename `docs/plans/12-race-entity-refactor.md` → `docs/plans/12-race-entity-refactor.archived.md` so its rationale remains discoverable.

### Step 2: Refine issue #12 and cut a fresh branch

Issue #12's problem statement (overloaded "Race," circuit redundancy, awkward season lookups, latent multi-season ingestion bug) still stands. Its proposed solution was a partial fix — `Race` → `SeasonRace` + Circuit extraction + `/rounds` + `/results/race` — that left the "Race" overload partially intact. Update the issue so the proposed solution completes the fix:

- Target entity is `RaceWeekend`, not `SeasonRace`.
- `/rounds/{round}/results/race` is replaced by three explicit routes under `/seasons/{seasonId}/race-weekends/{round}/results/`: `/qualifying`, `/sprint`, `/grand-prix`.
- `SessionType.Race` → `GrandPrix`; `RaceStatus` → `RacingStatus`; `DriverRaceResult` → `DriverRacingResult`.
- `HasSprint` boolean → `WeekendFormat` enum.
- `POST /admin/rounds/{round}/score` admin endpoint remains deferred.

Then cut branch `feat/12-race-weekend-model` (or similar), and commit `docs/plans/12-race-weekend-model.md` reflecting the commit sequence below as the first commit so reviewers see the target before the implementation.

### Step 3: Commit sequence

Each commit independently builds, tests, lints, formats. Each is a gate.

**Commit A — Extract `Circuit` entity from `Race`**
- Create `Data/Entities/Circuit.cs` (`Name`, `Location`, `Country`, unique index on `Name`).
- Create `Api/Models/CircuitResponse.cs`.
- Drop `Circuit`/`Location`/`Country` columns from `Race`; add `CircuitId` FK.
- Migration: `ExtractCircuitEntity`. Re-seed `supabase/seed.sql` with separate `Circuits` insert, then `Races` referencing `CircuitId`.
- Update `RaceResponse` / `RaceResponseMapper` / `RaceService` to nest circuit.
- Update `web/src/contracts/Race.ts` and consumers to use nested circuit.
- Update tests that construct `Race` instances.

**Commit B — Rename `Race` → `RaceWeekend`; `DriverRaceResult` → `DriverRacingResult`; `SessionType.Race` → `GrandPrix`; `RaceStatus` → `RacingStatus`; rename FK properties**
- `Data/Entities/Race.cs` → `RaceWeekend.cs` (class `Race` → `RaceWeekend`).
- `Data/Entities/DriverRaceResult.cs` → `DriverRacingResult.cs` (class rename).
- `Data/Entities/RaceStatus.cs` → `RacingStatus.cs` (enum rename; values unchanged).
- `SessionType` enum: `Race` → `GrandPrix` (keep value 0 so stored data is preserved); `Sprint` unchanged.
- Dependent entities: `RaceId` → `RaceWeekendId`, `.Race` nav → `.RaceWeekend` (6 entities: `DriverQualifyingResult`, `DriverRacingResult`, `LineupEntry`, `TeamRaceScore`, `DriverRaceScore`, `ConstructorRaceScore`). Update `[Index]` + `OnModelCreating` FK configs + index names.
- `ApplicationDbContext`: `DbSet<RaceWeekend> RaceWeekends`; `DbSet<DriverRacingResult> DriverRacingResults`; update all references.
- `Season.Races` → `Season.RaceWeekends`.
- Migration `RenameRaceToRaceWeekend`:
  - `RenameTable("Races", "RaceWeekends")`
  - `RenameTable("DriverRaceResults", "DriverRacingResults")`
  - `RenameColumn` for each FK: `RaceId` → `RaceWeekendId`
  - Rename affected indexes.
  - SessionType column values stay as 0 (`Race` → `GrandPrix`) and 1 (`Sprint`) — no data rewrite needed, just a code-level enum name change.
- Services: `RaceService.cs` → `RaceWeekendService.cs` (`IRaceService` → `IRaceWeekendService`); `RaceResultService.cs` → `RaceWeekendResultService.cs` (`IRaceResultService` → `IRaceWeekendResultService`). Update all entity type references, FK names, and `SessionType.Race` → `.GrandPrix` within both.
- Tests: update entity types, FK names, SessionType values, entity class name in mocks.
- Seed script: rename `Races` table in inserts.

**Commit C — Replace `HasSprint` boolean with `WeekendFormat` enum**
- New enum `WeekendFormat { Standard = 0, Sprint = 1 }` on `RaceWeekend`.
- Migration:
  - Add `WeekendFormat` column (int).
  - Backfill: `UPDATE "RaceWeekends" SET "WeekendFormat" = 1 WHERE "HasSprint" = true; UPDATE "RaceWeekends" SET "WeekendFormat" = 0 WHERE "HasSprint" = false;`
  - Drop `HasSprint` column.
- Update DTOs (`RaceResponse` still — renamed in Commit D), mappers, frontend contract, seed script.
- Tests: update fixture setup.

**Commit D — Add `GET /seasons/current`; nested API routes under `/seasons/{seasonId}/race-weekends`; rename endpoints, services, DTOs, frontend**
- `Api/Endpoints/SeasonEndpoints.cs`: add `GET /seasons/current` → returns the current `SeasonResponse` (or 404 if no active season). Backed by existing `ISeasonService.GetCurrentSeasonAsync()`.
- `Api/Endpoints/RaceWeekendEndpoints.cs` mounted at `/seasons/{seasonId}/race-weekends`.
- `Api/Endpoints/RaceWeekendResultEndpoints.cs` mounted at `/seasons/{seasonId}/race-weekends/{round}/results`, with dedicated handlers for each session:
  - `GET/PUT /qualifying` — delegates to `IRaceWeekendResultService` qualifying methods.
  - `GET/PUT /sprint` — delegates to `IRaceWeekendResultService` racing methods with `SessionType.Sprint`.
  - `GET/PUT /grand-prix` — delegates to `IRaceWeekendResultService` racing methods with `SessionType.GrandPrix`.
  - All six handlers resolve `(seasonId, round)` → `RaceWeekendId` via `IRaceWeekendService.ResolveAsync(seasonId, round)` before delegating. Extract the resolve-or-404 block into a shared private helper to avoid repeating it six times.
- `IRaceWeekendService` methods take explicit `int seasonId` — no null fallback, no `ISeasonService` dependency inside the service. (Commit E from the original plan is absorbed into D since `seasonId` is now in the path.)
- Rename remaining API-layer names:
  - `RaceResponse.cs` → `RaceWeekendResponse.cs` (class `RaceResponse` → `RaceWeekendResponse`)
  - `RaceResponseMapper.cs` → `RaceWeekendResponseMapper.cs`
  - Endpoint classes reference `IRaceWeekendResultService` (renamed in Commit B)
- DTOs: `RaceWeekendResponse`; `DriverQualifyingResultResponse` and `DriverRacingResultResponse` with FK field renamed to `raceWeekendId` (surface `round` + `seasonId` alongside for client convenience).
- Tests:
  - Add `SeasonEndpointsTests.cs` (new) covering `GET /seasons/current`: returns current season when one exists; returns 404 when no active season.
  - Add `RaceWeekendEndpointsTests.cs` (renamed from `RaceEndpointsTests.cs` / `RaceServiceTests.cs` equivalent) covering the renamed routes and `ResolveAsync` paths.
  - Rename `RaceResultEndpointsTests.cs` → `RaceWeekendResultEndpointsTests.cs`; update route paths and service references.
  - Rename `RaceServiceTests.cs` → `RaceWeekendServiceTests.cs`; update method names.
- Frontend:
  - `web/src/contracts/RaceWeekend.ts` with interface `RaceWeekend`.
  - `web/src/services/raceWeekendService.ts` with `getRaceWeekends(seasonId)`, `getRaceWeekend(seasonId, round)`.
  - `web/src/services/seasonService.ts` (new file — does not currently exist): `getCurrentSeason()` hitting `/seasons/current`.
  - App bootstrap (router loader or top-level context): preflight `getCurrentSeason()` once, cache the id, pass it to race-weekend calls. Existing initial-page-load bundle (`/api/me/profile` + `/api/me/team/`) becomes three concurrent requests; note this in `CLAUDE.md` where it currently documents two.
  - Update router and components.
- Ingestion script (`api/scripts/ingest_results.py`):
  - Takes `--round` as the only required parameter (same as today). Resolves current season by calling `GET /api/seasons/current` at startup — no `--season-id` flag needed.
  - `fetch_rounds()` → `fetch_race_weekends(season_id)`; hits `/api/seasons/{season_id}/race-weekends` using the resolved season id.
  - `submit_results()`: POST path is `/api/seasons/{season_id}/race-weekends/{round}/results/qualifying` for qualifying; `/api/seasons/{season_id}/race-weekends/{round}/results/sprint` or `/grand-prix` for racing sessions.

---

## Critical files

**To read before starting Commit B:**
- `api/F1CompanionApi/Domain/Services/ScoringService.cs` — uses `SessionType.Race` and `RaceStatus`; must be updated in lockstep with the enum renames.
- `api/F1CompanionApi/Domain/Services/TeamService.cs` — creates `LineupEntry` with `RaceId`, helper methods return `Race?`.
- `api/F1CompanionApi/Domain/Services/RaceResultService.cs` — renamed to `RaceWeekendResultService` and updated for entity type + enum renames.
- `api/F1CompanionApi/Data/ApplicationDbContext.cs` — `OnModelCreating` FK configs for all 6 dependents.
- `api/F1CompanionApi/Extensions/ServiceExtensions.cs` — DI registrations for both services being renamed.

**To read before starting Commit C:**
- `api/F1CompanionApi/Data/Entities/RaceWeekend.cs` — `HasSprint` boolean (renamed from `SeasonRace.cs` in Commit B).
- `api/F1CompanionApi/Api/Models/RaceResponse.cs` — `HasSprint` field in the response contract.
- `web/src/contracts/Race.ts` — frontend field that will become `weekendFormat`.

**To read before starting Commit D:**
- `api/F1CompanionApi/Api/Endpoints/Endpoints.cs` — endpoint registration chain.
- `web/src/router.tsx` — route setup and loader calls into the Race/Round service.
- `web/src/components/Team/Team.tsx` — consumes `Race[]`.
- `api/scripts/ingest_results.py` — external consumer of the API, must migrate paths in lockstep.

---

## Verification

After each commit:

```bash
# API
dotnet build api/F1CompanionApi/F1CompanionApi.csproj
dotnet test api/F1CompanionApi.UnitTests/F1CompanionApi.UnitTests.csproj
dotnet csharpier format .
dotnet format style --exclude **/Migrations/**
dotnet format analyzers --exclude **/Migrations/**

# Web
cd web && npm run typecheck && npm run test
```

After Commit D (end-to-end):

1. Apply migrations against a fresh dev DB; re-run `supabase/seed.sql`.
2. Start API + web dev server.
3. Hit `GET /api/seasons/{currentSeasonId}/race-weekends` — confirm payload has nested `circuit` object and `weekendFormat`.
4. Hit `GET /api/seasons/{currentSeasonId}/race-weekends/1` — confirm round 1 returns.
5. Run `ingest_results.py` end-to-end against a test weekend; confirm Grand Prix + Sprint submissions land in `DriverRacingResults` (with correct `SessionType`) and Qualifying submissions land in `DriverQualifyingResults`.
6. Load the team page in the browser; confirm no regressions in roster, scoring, or race schedule display.
7. Verify `ScoringService` output against a known race weekend (spot-check against a prior season's stored scores if available).

---

## Verified facts (shape the plan)

Verified via code inspection + user confirmation:

- **Migrations on `feat/12-race-entity-refactor` have NOT been deployed to production.** Local-only. Hard reset is operationally safe — no reversal migrations needed.
- **API consumers = web app + Python ingestion script.** No mobile clients, no external integrations. Route/DTO renames are self-contained to this repo.
- **Enums serialize as ints.** No `JsonStringEnumConverter` anywhere; renaming `SessionType.Race` → `GrandPrix` (keeping value 0) and `RaceStatus` → `RacingStatus` (values unchanged) preserves the wire format.
- **Frontend doesn't reference `RaceStatus` or `SessionType`.** Zero matches in `web/`. Rename has zero frontend impact for these enums.
- **No auto-generated API clients.** Frontend types are hand-written. No cascading client regeneration.
- **No `/admin` endpoints exist.** Nothing to update for admin-side naming.
- **Test blast radius is concentrated.** 133 matches for Race-related identifiers across 5 files. After hard reset to main, these revert to their original names: `TeamServiceTests.cs`, `ScoringServiceTests.cs`, `RaceResultServiceTests.cs`, `RaceResultEndpointsTests.cs`, `RaceServiceTests.cs`. No surprise files.
- **`GET /api/seasons/current` does NOT exist today.** Commit D will add it (see below).

## Open items to resolve during execution

- **Issue #12's proposed solution needs refining.** Its problem statement still applies; its proposed solution is a partial fix. Update the issue per Step 2 so reviewers see the completed target.
- **Seed source: `api/supabase/seed.sql` only.** (`seed-prices.sql` and `test-data-teams.sql` are scoped to concerns unaffected by this refactor.)
- **`docs/research/fantasy-rules/*` has 28 files mentioning "race."** Most will be generic F1 domain prose, but spot-check during Commit B: `decisions/scoring.md`, `scripts/scoring.py`, `reference/glossary-keywords.md`, `reference/glossary-concepts.md`. If they encode code-aligned entity names, update in lockstep.
- **Run a broader grep at start of Commit B.** `Race`, `RaceId`, `RaceStatus`, `SessionType.Race`, `DriverRaceResult`, `GetRace*` — catch stragglers beyond the files enumerated in this plan.

## Accepted design call

**`WeekendFormat { Standard, Sprint }` covers current and foreseeable F1 formats.** If the league introduces other variants (reverse-grid sprints, etc.), expand the enum. YAGNI-aligned.

## Risk notes

- **Commit A** requires re-seeding after the migration (non-nullable `CircuitId`). Coordinate migration + re-seed for every environment it's applied to.
- **Commits B + C + D** are collectively a coordinated breaking change — API, frontend, and ingestion script must deploy together. Ship all three in a single deploy window.
- **Commit C migration** drops the `HasSprint` column; ensure no in-flight query or DTO reference relies on it at deploy time.
- **Current-season caching**: if the frontend caches the current-season id for the lifetime of the session, a season rollover mid-session could leave a client making calls against a stale season. Accept this (caching invalidates on next page load) unless product requirements say otherwise.
