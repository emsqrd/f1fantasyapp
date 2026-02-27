# Plan: Captain Selection (Issue #47)

## Context

Users need to designate one driver on their team as captain for each race round. The captain receives 2x points for that round (only if they finish and score). This feature builds on the `LineupEntry` snapshot system added in #46 — the captain flag will live on `LineupEntry` so it's automatically captured in the pre-lock lineup snapshot used by the scoring engine.

**Design decisions confirmed:**
- Captain can be set when lineup is incomplete (any filled driver slot is eligible)
- No captain at lock time is valid — user simply forfeits the 2x bonus that round
- Deselecting captain (tapping again) leaves no captain selected

---

## Step 0 — Feature Branch

```bash
git checkout -b feat/captain-selection
```

---

## Commit 1 — Docs & Mockups

Create plan and UI mockup files before any code changes. User reviews mockups and selects badge direction before frontend is implemented.

**Files to create:**
- `docs/plans/47-captain-selection.md` — copy of this plan
- `docs/mockups/captain-badge-mockups.html` — 4–5 HTML mockups of the captain badge UI (styled to match existing Tailwind dark-theme cards)

**Mockup options to include:**
1. Gold "C" circle overlay on top-left of abbreviation circle
2. Crown icon in top-right corner (Lucide-style SVG)
3. Gold card border + "CAPTAIN" text label at top
4. Abbreviation circle turns gold with "C" superscript badge
5. Thin gold top-strip banner with "Captain" text

Commit: `docs: add captain selection plan and UI mockups`

---

## Commit 2 — Backend: IsCaptain Migration

Add `IsCaptain` bool flag to `LineupEntry` entity and run migration.

**Files to modify:**
- `api/F1CompanionApi/Data/Entities/LineupEntry.cs` — add `public bool IsCaptain { get; set; }`

**New migration:**
```bash
dotnet ef migrations add AddCaptainFlagToLineupEntry --project F1CompanionApi
dotnet ef database update --project F1CompanionApi
```

The existing unique index `(TeamId, RaceId, EntityType, SlotPosition)` already prevents duplicate slot entries. The "at most one captain" constraint will be enforced in application logic (the set-captain service method clears any prior captain before setting the new one).

`IsCaptain` defaults to `false` in C#, so **no changes are needed** to `AddDriverToTeamAsync` — every new `LineupEntry` will automatically have `IsCaptain = false`. The flag is only flipped to `true` via the dedicated captain endpoint.

Commit: `feat(api): add IsCaptain flag to LineupEntry`

---

## Commit 3 — Backend: Captain Endpoint + Team Response

New endpoint to set/clear captain. Updated team response to expose current captain.

### Service Layer

Add to `ITeamService` interface and `TeamService`:

```csharp
Task SetCaptainAsync(int teamId, int? driverId, int userId);
```

**Logic in `SetCaptainAsync`:**
1. Call `GetCurrentRaceOrThrowIfLockedAsync()` — rejects if locked
2. Validate team ownership
3. If `driverId` is not null: validate driver has a `LineupEntry` for `(TeamId, RaceId, EntityType=Driver)` — i.e., the driver is actually in the current lineup
4. Clear `IsCaptain` on any existing captain entry for `(TeamId, RaceId)`
5. If `driverId` is not null: set `IsCaptain = true` on that driver's `LineupEntry`
6. SaveChanges

**Files to modify:**
- `api/F1CompanionApi/Domain/Services/TeamService.cs`
- `api/F1CompanionApi/Domain/Services/ITeamService.cs`

### New Endpoint

Add to `MeEndpoints.cs` (inside the `teamGroup`):

```
PUT /me/team/captain
Body: { "driverId": 42 }   // or null to deselect
Response: 204 NoContent
```

**Files to modify:**
- `api/F1CompanionApi/Api/Endpoints/MeEndpoints.cs`
- `api/F1CompanionApi/Api/Models/SetCaptainRequest.cs` (new)

### Team Response Update

`GET /api/me/team/` must include current captain so the frontend can render the badge.

Add `CaptainDriverId: int?` to `TeamDetailsResponse`. The mapper queries `LineupEntries` for the current race to find the captain:

```csharp
// In GetUserTeamAsync or mapper:
var currentRace = await _dbContext.Races
    .Where(r => r.RaceDate >= now)
    .OrderBy(r => r.RaceDate)
    .FirstOrDefaultAsync();

int? captainDriverId = currentRace is null ? null :
    await _dbContext.LineupEntries
        .Where(le => le.TeamId == teamId
                  && le.RaceId == currentRace.Id
                  && le.EntityType == LineupEntityType.Driver
                  && le.IsCaptain)
        .Select(le => (int?)le.EntityId)
        .FirstOrDefaultAsync();
```

**Files to modify:**
- `api/F1CompanionApi/Api/Models/TeamDetailsResponse.cs` — add `CaptainDriverId`
- `api/F1CompanionApi/Api/Mappers/TeamMapper.cs` — update mapper
- `api/F1CompanionApi/Domain/Services/TeamService.cs` — update `GetUserTeamAsync`

### Tests

- `TeamService_SetCaptainAsync_SetsFlag` — happy path
- `TeamService_SetCaptainAsync_ClearsExistingCaptain` — prior captain is cleared
- `TeamService_SetCaptainAsync_ThrowsIfLocked` — roster locked
- `TeamService_SetCaptainAsync_ThrowsIfDriverNotInLineup` — driver not in team
- `TeamService_SetCaptainAsync_WithNullDriverId_ClearsCapitain` — deselect
- `MeEndpoints_SetCaptain_Returns204`
- `MeEndpoints_SetCaptain_Returns404WhenNoTeam`
- `TeamService_GetUserTeam_IncludesCaptainDriverId` — team response includes captain

**Test files:**
- `api/F1CompanionApi.UnitTests/Services/TeamServiceTests.cs`
- `api/F1CompanionApi.UnitTests/Api/Endpoints/MeEndpointsTests.cs`

Commit: `feat(api): add captain endpoint and expose captain in team response`

---

## Commit 4 — Frontend: Captain Badge & Toggle

> **Depends on user mockup review.** Badge implementation will follow the approved design direction.

### Contracts

`web/src/contracts/Team.ts`:
- Add `captainDriverId: number | null` to `Team` interface

### Service

`web/src/services/teamService.ts`:
- Add `setCaptain(driverId: number | null): Promise<void>` using `apiClient.put('/me/team/captain', { driverId })`

### DriverCard

`web/src/components/DriverCard/DriverCard.tsx`:
- Add props: `isCaptain: boolean`, `onSetCaptain?: () => void`
- Render captain badge (per approved mockup design) when `isCaptain`
- Render "Set as captain" tap target (e.g., the badge area, or the card itself) when `driver` is present and `!readOnly`
- Tapping the active captain badge deselects (`onSetCaptain` called with `null`)
- Badge is hidden / non-interactive when `readOnly`

### DriverPicker

`web/src/components/DriverPicker/DriverPicker.tsx`:
- Accept `captainDriverId: number | null` and `onSetCaptain: (driverId: number | null) => void` props
- Pass `isCaptain={driver.id === captainDriverId}` and appropriate `onSetCaptain` callback to each `DriverCard`

### Team Page

`web/src/components/Team/Team.tsx`:
- Read `captainDriverId` from team loader data
- Wire up `setCaptain` call (via local state + optimistic update or loader invalidation)
- Pass `onSetCaptain` down to `DriverPicker`

### Tests

- `DriverCard` — renders captain badge when `isCaptain`, calls `onSetCaptain` on click, hides badge in readOnly
- `DriverPicker` — passes correct `isCaptain` to each slot
- `teamService.setCaptain` — calls correct endpoint

Commit: `feat(web): add captain badge and selection UI`

---

## Verification

### Manual (End-to-End)

1. Start both servers: `npm run web:dev` + `npm run api:watch`
2. Navigate to team page — no driver is captain initially
3. Click a driver card's captain toggle → badge appears, `PUT /me/team/captain` fires with 204
4. Click another driver → first badge clears, new badge appears
5. Click captain badge again → badge clears (no captain)
6. Fast-forward past lock deadline (or wait) → captain toggle is disabled, badge still visible in read-only mode
7. Remove the captain driver → badge disappears (LineupEntry deleted, no captain)

### Automated

```bash
npm run api:test   # backend unit tests
npm run web:test   # frontend unit tests
npm run test:all   # full suite
```

### Build

```bash
npm run web:build
npm run api:build
```
