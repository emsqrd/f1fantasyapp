# Plan — gh issue #148 (qualifying DSQ breaks `/score`)

## Context

`POST /api/seasons/{id}/race-weekends/{round}/score` throws `InvalidOperationException`
from `ScoringService.ScoreConstructors` (`api/F1CompanionApi/Domain/Services/ScoringService.cs:318-323`)
after qualifying ingestion if any driver was DSQ'd / withdrew / failed to qualify. Real-world
example: 2026 Australian GP (round 1) — VER, STR, SAI all DSQ'd from quali.

Three layers compound to produce the bug:

1. `DriverQualifyingResult` (`api/F1CompanionApi/Data/Entities/DriverQualifyingResult.cs:1-14`)
   has only `DriverId` + `required int Position` — no way to record a non-classified entry.
2. `build_qualifying_payload` in `api/scripts/ingest_results.py:218-243` skips any row with
   NaN `Position`. DSQ'd quali drivers have NaN `Position` upstream, so they are silently dropped.
3. `ScoreDrivers` (`ScoringService.cs:257-267`) builds the driver set from the union of
   qualifying + grand-prix/sprint rows. After qualifying-only ingestion, a DSQ'd driver appears in neither,
   so `ScoreConstructors` (`:300-336`) sees only one of the constructor's two drivers and throws.

Goal: make non-classified qualifying entries first-class so they're persisted, returned by
`ScoreDrivers`, and produce a 0-point qualifying score. The `ScoreConstructors` invariant stays —
it now only fires for the original case it was written for (driver missing from **both** quali and
weekend, i.e. genuine roster/data drift).

## Reuse audit

The user asked to confirm what existing mapping logic can be reused before inventing new code.

### C# side — pattern is fully reusable

Grand prix / sprint already implement exactly the shape qualifying needs. Both share
`DriverRacingResult` (`Data/Entities/DriverRacingResult.cs:1-19`) which has:

- `int? FinishPosition` (nullable)
- `required RacingStatus Status` (`Data/Entities/RacingStatus.cs` — `Classified=0, DNF=1, DSQ=2, DNS=3`)

Mirroring patterns to copy verbatim:

- API model: `RacingResultItem` (`Api/Models/RacingResultItem.cs:1-13`) — nullable position + required Status.
- API response: `DriverRacingResultResponse` (`Api/Models/DriverRacingResultResponse.cs:1-16`).
- Validation cross-field rule: `ValidateRaceItems` (`Domain/Services/RaceWeekendResultService.cs:218-249`),
  specifically lines 234-247 enforcing `Status==Classified ⇔ FinishPosition!=null`.
- Scoring null-handling: `GetPositionPoints` (`ScoringService.cs:119-125`) **already** returns 0
  for null position. `CalculateDriverQualifyingPoints` (`:36-39`) calls into it. No scoring code
  needs to change once the field becomes nullable — null flows through to 0 with no math edit.
- Scoring penalty: grand prix / sprint apply `dnfPenalty` when `Status != Classified`
  (`CalculateDriverSessionPoints:97-102`). **Qualifying does not apply a penalty.**
  `docs/research/fantasy-rules/decisions/scoring.md:27` is explicit:
  > Qualifying retirements carry no penalty.
  So no change to `CalculateDriverQualifyingPoints` — null Position → 0 points, end of story.

### Python side — unify on `ClassifiedPosition`, retire `map_status`

`map_status` (`api/scripts/ingest_results.py:200-215`) currently reads FastF1's free-text
`Status` column ("Finished", "Disqualified", "Retired", "Lapped", "+ 1 Lap", "Crash",
"Gearbox", "Did not start", …) and collapses to `RacingStatus`. Two problems with that source:

1. It **doesn't exist for qualifying.** Verified by a fresh, non-cached load of 2026 R1
   qualifying (network fetch, all seven artifacts pulled fresh): `Status` is empty string for
   all 22 drivers. (`ClassifiedPosition` is also empty for plain qualifying — verified the
   same way; FastF1's docs over-promise on that field for current-season qualifying. The
   single signal qualifying gives us is `Position is NaN`.)
2. Its mapping for grand prix / sprint **has latent bugs.** Verified against 2026 AUS grand
   prix data:
   - **Stroll**: `Status="Lapped"` paired with `ClassifiedPosition="R"`. `map_status` matches
     `"Lap" in status` → CLASSIFIED, leaves him with `finishPosition=17`. Per `scoring.md:103`
     ("a driver listed as DNF or Not Classified receives 0 finish points and the −10
     penalty"), an FIA `R` classification is DNF — current code is wrong.
   - **Piastri / Hülkenberg**: `Status="Did not start"` paired with `ClassifiedPosition="W"`.
     `map_status` falls through to DNF (catch-all); the FIA `W` classification is DNS. Same
     point total under `scoring.md:103` ("DNF / DSQ / DNS are treated identically"), so no
     fantasy-points change — but the stored Status is wrong.

`ClassifiedPosition` is a small, structured field (integer string or one of `R`/`D`/`E`/`W`/
`F`/`N`) that already encodes the four `RacingStatus` buckets we care about, and it's reliable
for grand prix / sprint. So: **replace `map_status` with one helper that reads
`ClassifiedPosition` for grand prix / sprint and falls back to `Position is NaN` for
qualifying** (where the column is empty). Single source of truth, kills the free-text
dependency, and fixes the Stroll-class bug as a side effect.

Verified empirical state of FastF1 columns:

| Column | Grand Prix / Sprint | **Qualifying (actual behavior)** |
|---|---|---|
| `Position` | populated even for non-classified (it's a finishing rank) | populated; **NaN** for non-classified |
| `ClassifiedPosition` | populated: integer or `R`/`D`/`E`/`W`/`F`/`N` | **always empty string** for all drivers (incl. DSQ'd) |
| `Status` | populated, free-text ("Lapped"/"Did not start"/"Crash"/…) | **always empty string** |
| `Q1`/`Q2`/`Q3` | n/a | populated for runners; **NaT for DSQ'd drivers** (FastF1 wipes their times) |

For qualifying, `Position is NaN` is the only available bit. We can't disambiguate DSQ vs DNS
vs DNF from the data, so the auto-ingest emits one canonical non-classified bucket (DSQ —
matches the case the issue documents and the most common modern cause). The API/entity still
accepts all four `RacingStatus` values so a future manual correction or alternate source can
record the precise reason.

## Plan — ordered commits

Each commit is independently buildable, lintable, testable, formatted. Tests ship with their
implementation. Order: branch + plan → data model → API → ingest, so each layer's tests can use
the previous.

---

### Commit 1 — branch off `main` and check the plan into `docs/plans/`

**Steps**

1. From `main`, create a new branch — e.g. `git checkout -b fix/issue-148-qualifying-dsq`.
2. Copy this plan file from `~/.claude/plans/plan-gh-issue-148-graceful-leaf.md` to
   `docs/plans/issue-148-qualifying-dsq.md` (project convention per `CLAUDE.md`:
   *"Write the plan to `docs/plans/` when producing a full plan."*).
3. Commit just the new plan file. No code changes in this commit.

This commit gives the rest of the work a stable, reviewable starting point and puts the plan
under version control alongside the changes it describes.

---

### Commit 2 — backend: Status as a first-class field on qualifying results

**Files**

- `api/F1CompanionApi/Data/Entities/DriverQualifyingResult.cs` — change `required int Position`
  to `int? Position`; add `required RacingStatus Status`.
- `api/F1CompanionApi/Api/Models/QualifyingResultItem.cs` — same shape change.
- `api/F1CompanionApi/Api/Models/DriverQualifyingResultResponse.cs` — same shape change
  (nullable Position, required Status).
- `api/F1CompanionApi/Api/Mappers/DriverQualifyingResultResponseMapper.cs` — pass Status through;
  Position is already pass-through.
- `api/F1CompanionApi/Domain/Services/RaceWeekendResultService.cs`:
  - `SubmitQualifyingResultsAsync` (`:51-90`) — set `Status = i.Status` on the entity.
  - `ValidateQualifyingItems` (`:202-212`) — add the same cross-field rule used in
    `ValidateRaceItems:234-247`, adapted for `Position` instead of `FinishPosition`:
    `Status==Classified ⇒ Position!=null`; `Status!=Classified ⇒ Position==null`.
- New EF migration:
  ```
  dotnet ef migrations add AllowNullPositionAndAddStatusToDriverQualifyingResult --project F1CompanionApi
  ```
  Expected generated operations:
  - `AlterColumn` on `DriverQualifyingResults.Position` → `nullable: true`.
  - `AddColumn` `DriverQualifyingResults.Status` int, `nullable: false`, `defaultValue: 0`.
  Existing rows backfill to `Classified` (value 0), which is correct because every existing row
  has a non-null Position.

**Tests (in this commit)**

- Update existing `RaceWeekendResultServiceTests.cs` and `ScoringServiceTests.cs` constructions of
  `DriverQualifyingResult` / `QualifyingResultItem` to include `Status = RacingStatus.Classified`.
  Compile-time enforced by the `required` modifier.
- `RaceWeekendResultServiceTests`:
  - `SubmitQualifyingResultsAsync_PersistsDsqEntry_WithNullPosition` — payload contains one
    `{driverId, position: null, status: DSQ}`; verify entity stored with those values.
  - `SubmitQualifyingResultsAsync_ThrowsArgumentException_WhenClassifiedHasNullPosition`.
  - `SubmitQualifyingResultsAsync_ThrowsArgumentException_WhenNonClassifiedHasPosition`.
- `ScoringServiceTests`:
  - `CalculateDriverQualifyingPoints_ReturnsZero_WhenPositionIsNull` (covers the null path
    already provided by `GetPositionPoints`).

**No changes** to `ScoringService.cs` — null Position → 0 via `GetPositionPoints`; the
`ScoreConstructors` invariant is preserved.

---

### Commit 3 — integration test: DSQ qualifying scoring round-trip

Goal: exercise the full HTTP pipeline against a real Postgres to prove the issue-148 500 is gone.

**Files**

- `api/F1CompanionApi.IntegrationTests/Scenarios/QualifyingDsqScoringTests.cs` (new). Inherits
  `IntegrationTestBase`. Uses `factory.CreateAuthenticatedAsync()`.

**Seed (minimal — just the constructor pair the bug fires on, no full grid):**

Inside `WithDbAsync` block, using the existing `TestDataBuilder` extensions
(`api/F1CompanionApi.IntegrationTests/Support/TestDataBuilder.cs`):

- `db.CreateCurrentSeasonAsync()` → season
- `db.CreateRaceWeekendAsync(season.Id, raceDate, round: 1)` → race weekend
- `db.CreateDriverAsync("AAA", "First", "One")` and `db.CreateDriverAsync("BBB", "First",
  "Two")` → the two drivers of one constructor
- `db.CreateConstructorAsync("TestCo")` → constructor
- Two `SeasonDriver` rows linking the drivers to the constructor with `IsActive=true`. No
  shared helper exists for this; add inline as `db.SeasonDrivers.Add(new SeasonDriver { ... })`
  twice (3–4 lines). Optionally extract a `CreateSeasonDriverAsync` extension on
  `TestDataBuilder` if it cleans up the test, but YAGNI is fine here.

**Scenario**

1. `PUT /api/seasons/{id}/race-weekends/1/results/qualifying` with two entries: one DSQ
   driver `{driverId: AAA.Id, position: null, status: 2 /* DSQ */}`, one classified driver
   `{driverId: BBB.Id, position: 1, status: 0 /* Classified */}`.
2. `POST /api/seasons/{id}/race-weekends/1/score`. Assert 200 (the previous failure surface).
3. `GET /api/seasons/{id}/race-weekends/1/results/qualifying` — DSQ entry round-trips with
   `position: null, status: 2`.
4. Via `WithDbAsync`, read `DriverRaceWeekendScore` for AAA — assert
   `QualifyingPositionPoints == 0`.
5. Via `WithDbAsync`, read `ConstructorRaceWeekendScore` for the constructor — assert it
   exists (this row is what `ScoreConstructors:318` previously threw on).

---

### Commit 4 — Python ingest: unified `ClassifiedPosition` mapping, replaces `map_status`

**Files**

- `api/scripts/ingest_results.py`:
  - **Delete** `map_status` (`:200-215`) and the `_CLASSIFIED_STATUSES` constant (`:27`).
  - **Add** `map_session_status(row) -> RacingStatus`:
    ```python
    def map_session_status(row) -> RacingStatus:
        """Map a FastF1 SessionResults row to a RacingStatus.

        Reads ClassifiedPosition for grand-prix and sprint sessions (FIA's official
        classification). Falls back to Position-NaN for qualifying, where FastF1
        leaves ClassifiedPosition empty.
        """
        cp = str(row.get("ClassifiedPosition") or "").strip()
        if cp == "":
            # Qualifying: only signal is Position
            return (RacingStatus.CLASSIFIED
                    if not pd.isna(row.get("Position"))
                    else RacingStatus.DSQ)
        if cp.isdigit():
            return RacingStatus.CLASSIFIED
        if cp in ("D", "E"):
            return RacingStatus.DSQ
        if cp in ("W", "F"):
            return RacingStatus.DNS
        # 'R', 'N', or any unknown letter
        return RacingStatus.DNF
    ```
  - **Update** `build_race_payload` (`:246-284`) — replace `map_status(row.get("Status",""))`
    with `map_session_status(row)`. No other change needed; downstream
    `if pd.isna(finish) or status != RacingStatus.CLASSIFIED: finish_position = None`
    logic continues to work and now correctly drops Stroll's `Position=17` for an `R`
    classification.
  - **Update** `build_qualifying_payload` (`:218-243`):
    - Stop skipping rows with NaN `Position`. The "driver missing from API" guard stays.
    - Compute `status = map_session_status(row)`.
    - `position = int(row["Position"])` if `status == CLASSIFIED` else `None`.
    - Payload item: `{driverId, position: int|None, status: int(status)}`.

- `api/scripts/test_ingest_results.py`:
  - **Delete** `TestMapStatus`.
  - **Add** `TestMapSessionStatus` with cases for each branch:
    - integer-string CP (`'1'`, `'17'`) → CLASSIFIED
    - `'D'`, `'E'` → DSQ
    - `'W'`, `'F'` → DNS
    - `'R'`, `'N'` → DNF
    - unknown letter (e.g. `'X'`) → DNF (catch-all)
    - empty CP + non-NaN Position → CLASSIFIED (qualifying classified path)
    - empty CP + NaN Position → DSQ (qualifying non-classified path)
  - **Update** `TestBuildRacePayload` rows: switch the synthetic data from `Status="…"`
    to `ClassifiedPosition="…"`. Add a regression case for the Stroll bug:
    `ClassifiedPosition="R"` + `Position=17` → payload row has `finishPosition=None`,
    `status=DNF`.
  - **Update** `TestBuildQualifyingPayload` for the new payload shape (`status` field
    always present; `position` is `int` or `None`); add a NaN-Position → DSQ case.

Order note: this commit lands the unified mapper alongside the qualifying behavior change. It
does not depend on commits 2–3 to compile/run; pytest exercises the script in isolation. The
runtime behavior of `build_race_payload` does change for grand-prix sessions where
`ClassifiedPosition` differs from what `Status` would have implied — see verification step for
the post-deploy re-ingest of 2026 R1 grand prix.

---

## Confirmed decisions

1. **Auto-ingest emits a single canonical non-classified status (DSQ).** FastF1 doesn't expose
   enough qualifying data to distinguish DSQ / DNS / DNF (see Python-side reuse audit above).
   The API still accepts all four `RacingStatus` values, so a future caller (manual correction
   tool, alternate data source) can record the precise reason when it's known.

2. **No penalty for any non-Classified qualifying status.** Per `scoring.md:27` qualifying
   retirements carry no penalty; there is no `QualifyingDnfPenalty` in `ScoringConstants`. The
   null-Position → 0 path in `GetPositionPoints` already implements this correctly.

3. **No backfill of local Supabase seed data.** Existing rows all have a Position, so the
   migration's `defaultValue: 0` (Classified) is correct as-is.

4. **Grand prix / sprint mapping unified onto `ClassifiedPosition` as part of this PR.**
   Explicitly in scope. Replaces `map_status` with one source-of-truth mapper. Drives two
   real corrections in stored data:
   - **Stroll 2026 AUS GP**: was stored CLASSIFIED with `finishPosition=17`; under the new
     mapping he becomes DNF with `finishPosition=null` (per `scoring.md:103`'s rule that an
     FIA `R` classification is DNF). One real fantasy-points change in 2026 R1 — Stroll
     loses the position-points for P17 and gains the −10 penalty.
   - **Piastri / Hülkenberg 2026 AUS GP**: were stored DNF; under the new mapping they
     become DNS. **No fantasy-points change** (DNF / DSQ / DNS scored identically per
     `scoring.md:103`); just a more accurate stored Status.
   Operational consequence: 2026 R1 grand prix data needs to be re-ingested after the script
   change ships — see verification.

## What this plan does NOT fix

A driver missing from **both** qualifying and grand-prix/sprint results (full-weekend no-show with stale
`SeasonDrivers`) still throws at `ScoreConstructors:318`. That is the original case the throw
was written for and is intentionally preserved.

## Critical files

| File | Change |
|---|---|
| `api/F1CompanionApi/Data/Entities/DriverQualifyingResult.cs` | nullable Position; add Status |
| `api/F1CompanionApi/Api/Models/QualifyingResultItem.cs` | nullable Position; add Status |
| `api/F1CompanionApi/Api/Models/DriverQualifyingResultResponse.cs` | nullable Position; add Status |
| `api/F1CompanionApi/Api/Mappers/DriverQualifyingResultResponseMapper.cs` | pass Status through |
| `api/F1CompanionApi/Domain/Services/RaceWeekendResultService.cs` | extend `ValidateQualifyingItems`; set Status in `SubmitQualifyingResultsAsync` |
| `api/F1CompanionApi/Data/Migrations/<ts>_AddStatusToDriverQualifyingResult.cs` | new (generated) |
| `api/F1CompanionApi.UnitTests/Services/RaceWeekendResultServiceTests.cs` | update + add cases |
| `api/F1CompanionApi.UnitTests/Services/ScoringServiceTests.cs` | update + add null-Position case |
| `api/F1CompanionApi.IntegrationTests/Scenarios/QualifyingDsqScoringTests.cs` | new |
| `api/scripts/ingest_results.py` | replace `map_status` with `map_session_status` (reads `ClassifiedPosition`); update both `build_qualifying_payload` and `build_race_payload` to call it |
| `api/scripts/test_ingest_results.py` | replace `TestMapStatus` with `TestMapSessionStatus`; switch `TestBuildRacePayload` synthetic rows from `Status` to `ClassifiedPosition`; update `TestBuildQualifyingPayload` for new shape |

`api/F1CompanionApi/Domain/Services/ScoringService.cs` — **no edits.** Existing null-Position
handling in `GetPositionPoints` is sufficient.

## Verification

- `npm run api:test` (unit + integration) passes.
- `npm run api:format:check` clean.
- Python: `cd api/scripts && python3 -m pytest test_ingest_results.py` passes.
- Manual repro from the issue, against local stack with 2026 AUS GP data:
  ```
  cd api/scripts
  source .venv/bin/activate
  python3 ingest_results.py --round 1
  ```
  Expected:
  1. **Qualifying** submission accepted; `/score` returns 200; no `InvalidOperationException`
     in `dotnet watch` output. VER, STR, SAI persisted with `position=null`, `status=DSQ`.
  2. **Grand prix** submission accepted; `/score` returns 200. Stroll persisted with
     `status=DNF` and `finishPosition=null` (correction from the previous CLASSIFIED storage
     under the old mapper). Piastri and Hülkenberg persisted with `status=DNS` (correction
     from previous DNF storage; same fantasy points either way).
- `GET /api/seasons/{id}/race-weekends/1/results/qualifying` returns the three DSQ entries
  with `position: null, status: 2`.
- `GET /api/seasons/{id}/race-weekends/1/results/grand-prix` returns Stroll with
  `finishPosition: null, status: 1 /* DNF */`, and Piastri/Hülkenberg with
  `status: 3 /* DNS */`.
- Driver scores for round 1: VER, STR, SAI show 0 qualifying points; Stroll's grand-prix
  total reflects the −10 DNF penalty rather than position points for P17. Constructor scores
  compute for all 11 constructors.
