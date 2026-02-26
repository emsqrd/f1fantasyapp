# Lineup Snapshots — Implementation Plan (Issue #44)

## Context

Fantasy teams need a per-race record of their lineup at lock time to support scoring and historical views. The live `TeamDriver`/`TeamConstructor` tables are mutable; they cannot serve as a scoring input since changes after the snapshot are valid pre-lock edits.

The solution (Option A from research) is a snapshot table written on every add/remove operation — analogous to how FPL stores picks per gameweek. The roster lock already enforced by `ThrowIfRosterLockedAsync` prevents post-lock writes, so no separate freeze step is needed.

**Approach:** Individual rows per player per team per race. Write (insert) on add, hard-delete on remove. The snapshot always reflects the current team state for the upcoming race.

---

## Schema

> **Parent `Lineups` table considered and deferred.** A parent table would only add value if lineup-level computed fields (e.g., `transfers_used`, `transfer_penalty`) need to be cached. The transfer comparison query operates on individual entry rows regardless of schema (`EXCEPT` set difference on `entity_id + entity_type` filtered by `team_id + race_id`). A parent table can be introduced as an additive migration when the transfer system is built.

```
lineup_entries
  id            int PK (serial)
  team_id       int FK → teams (cascade delete)
  race_id       int FK → races (restrict delete)
  entity_id     int    -- driver or constructor id (no FK; polymorphic)
  entity_type   int    -- 0=Driver, 1=Constructor (C# enum)
  slot_position int
  created_at    timestamptz
  UNIQUE (team_id, race_id, entity_type, slot_position)
```

**Why slot-based unique key (not entity-based):** The domain allows the same constructor twice on one team. `UNIQUE (team_id, race_id, entity_id, entity_type)` would block this. The slot-based key correctly enforces "one entry per slot per type per team per race."

**Why NOT extend `BaseEntity`:** `BaseEntity` brings `UpdatedAt`, `DeletedAt`, and `IsDeleted` — none of which apply to lineup entries. `IsDeleted` implies soft-delete, but entries are hard-deleted when a player is dropped (always `false`, actively misleading). `UpdatedAt` implies mutability, but entries are write-once per slot. Defining `Id` and `CreatedAt` directly on the entity is more honest about the lifecycle and avoids dead schema columns.

---

## Step 0 — Setup

1. **Write this plan to the repo** as `docs/plans/44-lineup-snapshots.md` (canonical reference for implementation)
2. **Create a feature branch** from `main`: `feat/lineup-snapshots`

All implementation work happens on that branch. Reference `docs/plans/44-lineup-snapshots.md` during implementation — not this file.

---

## Critical Files

| File | Change |
|------|--------|
| `api/F1CompanionApi/Data/Entities/LineupEntityType.cs` | **NEW** — enum |
| `api/F1CompanionApi/Data/Entities/LineupEntry.cs` | **NEW** — entity |
| `api/F1CompanionApi/Data/ApplicationDbContext.cs` | Add `DbSet` + FK config in `OnModelCreating` |
| `api/F1CompanionApi/Data/Migrations/<ts>_AddLineupEntries.cs` | **NEW** — generated migration |
| `api/F1CompanionApi/Domain/Services/TeamService.cs` | Rename lock method + add snapshot sync |
| `api/F1CompanionApi.UnitTests/Services/TeamServiceTests.cs` | New snapshot test region |

---

## Commit 1 — Entity, Enum, DbContext, Migration

### `LineupEntityType.cs`

```csharp
namespace F1CompanionApi.Data.Entities;

public enum LineupEntityType
{
    Driver = 0,
    Constructor = 1,
}
```

### `LineupEntry.cs`

```csharp
using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Data.Entities;

/// <summary>
/// Records a single driver or constructor selection on a fantasy team for a specific race.
/// Written on every add (insert) and deleted on every remove. Always reflects the team's
/// current pre-lock lineup for the upcoming race. Used as the scoring engine input.
/// </summary>
[Index(nameof(TeamId), nameof(RaceId), nameof(EntityType), nameof(SlotPosition), IsUnique = true)]
public class LineupEntry
{
    public int Id { get; set; }
    public int TeamId { get; set; }
    public int RaceId { get; set; }
    public int EntityId { get; set; }
    public LineupEntityType EntityType { get; set; }
    public int SlotPosition { get; set; }
    public DateTime CreatedAt { get; set; }

    public Team Team { get; set; } = null!;
    public Race Race { get; set; } = null!;
}
```

### `ApplicationDbContext.cs` changes

Add to the DbSet block:
```csharp
public DbSet<LineupEntry> LineupEntries => Set<LineupEntry>();
```

Add to `OnModelCreating`:
```csharp
modelBuilder.Entity<LineupEntry>(entity =>
{
    entity
        .HasOne(le => le.Team)
        .WithMany()
        .HasForeignKey(le => le.TeamId)
        .OnDelete(DeleteBehavior.Cascade);

    entity
        .HasOne(le => le.Race)
        .WithMany()
        .HasForeignKey(le => le.RaceId)
        .OnDelete(DeleteBehavior.Restrict);
});
```

Do NOT add to `ConfigureAuditTrailForeignKeys` — `LineupEntry` has no base class and is not a `UserOwnedEntity`.

### Migration

```bash
dotnet ef migrations add AddLineupEntries --project F1CompanionApi
```

Review the generated migration for correct column types before committing.

---

## Commit 2 — TeamService Changes + Tests

### Service: Refactor lock check method

Rename `ThrowIfRosterLockedAsync` → `GetCurrentRaceOrThrowIfLockedAsync`, return `Race?`:

```csharp
private async Task<Race?> GetCurrentRaceOrThrowIfLockedAsync()
{
    var now = DateTime.UtcNow;
    var currentRace = await _dbContext
        .Races.Where(r => r.RaceDate >= now)
        .OrderBy(r => r.RaceDate)
        .FirstOrDefaultAsync();

    if (currentRace?.LockDeadline is not null && now >= currentRace.LockDeadline)
        throw new RosterLockedException(currentRace.Name, currentRace.LockDeadline.Value);

    return currentRace;
}
```

Update all 4 call sites from `await ThrowIfRosterLockedAsync();` to:
```csharp
var currentRace = await GetCurrentRaceOrThrowIfLockedAsync();
```

### Service: Add snapshot sync (after existing validation, before `SaveChangesAsync`)

**AddDriverToTeamAsync** — insert after `_dbContext.TeamDrivers.Add(teamDriver)`:
```csharp
if (currentRace is not null)
{
    _dbContext.LineupEntries.Add(new LineupEntry
    {
        TeamId = teamId,
        RaceId = currentRace.Id,
        EntityId = driverId,
        EntityType = LineupEntityType.Driver,
        SlotPosition = slotPosition,
        CreatedAt = DateTime.UtcNow,
    });
}
await _dbContext.SaveChangesAsync();  // single save — atomic
```

**RemoveDriverFromTeamAsync** — delete after `_dbContext.TeamDrivers.Remove(teamDriver)`:
```csharp
if (currentRace is not null)
{
    var entry = await _dbContext.LineupEntries.FirstOrDefaultAsync(le =>
        le.TeamId == teamId &&
        le.RaceId == currentRace.Id &&
        le.EntityId == teamDriver.DriverId &&
        le.EntityType == LineupEntityType.Driver);

    if (entry is not null)
        _dbContext.LineupEntries.Remove(entry);
}
await _dbContext.SaveChangesAsync();
```

Mirror these changes for `AddConstructorToTeamAsync` (EntityType.Constructor) and `RemoveConstructorFromTeamAsync`.

**Why a single `SaveChangesAsync`:** Keeps the team pick and snapshot atomic — either both land or neither does.

**Why null guard on `entry` in remove:** A snapshot row may not exist (e.g., data seeded before this feature). Removing the team pick still succeeds.

---

### Tests: New region in `TeamServiceTests.cs`

Add `#region Lineup Snapshot Tests` after the existing `RemoveConstructorFromTeamAsync Tests` region.

#### Test cases

| Test name | What it verifies |
|-----------|-----------------|
| `AddDriverToTeamAsync_WithUpcomingRace_CreatesLineupEntry` | Entry has correct TeamId, RaceId, EntityId, EntityType.Driver, SlotPosition |
| `AddDriverToTeamAsync_WithNoUpcomingRace_DoesNotCreateLineupEntry` | No race seeded → driver added, LineupEntries count == 0 |
| `AddDriverToTeamAsync_RaceHasNoLockDeadline_CreatesLineupEntry` | Null LockDeadline still produces a snapshot |
| `RemoveDriverFromTeamAsync_WithUpcomingRace_DeletesLineupEntry` | Add then remove → entry is null |
| `RemoveDriverFromTeamAsync_NoSnapshotExists_StillRemovesDriver` | Driver added directly to context (no snapshot) → remove succeeds, no throw |
| `AddConstructorToTeamAsync_WithUpcomingRace_CreatesLineupEntry` | EntityType.Constructor, correct EntityId/SlotPosition |
| `AddConstructorToTeamAsync_WithNoUpcomingRace_DoesNotCreateLineupEntry` | No race → constructor added, LineupEntries count == 0 |
| `RemoveConstructorFromTeamAsync_WithUpcomingRace_DeletesLineupEntry` | Add then remove → entry is null |
| `AddConstructorToTeamAsync_SameConstructorTwice_CreatesTwoLineupEntries` | Same constructor in slot 0 and slot 1 → 2 entries, unique constraint not violated |
| `AddDriverToTeamAsync_AtomicSave_TeamDriverAndLineupEntryBothPersist` | After add: TeamDrivers.Count == 1, LineupEntries.Count == 1 |

**Existing tests that implicitly cover new behavior:** `AddDriverToTeamAsync_ValidRequest_AddsDriverToTeam` has no race seeded — after the change, `currentRace` is null, snapshot is skipped, driver is still added. Test passes unchanged, covering the null-race path.

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| No upcoming race in DB | `GetCurrentRaceOrThrowIfLockedAsync` returns null; snapshot skipped; team pick saved |
| Race exists, no `LockDeadline` | Race returned; snapshot written |
| Race locked | `RosterLockedException` thrown; no snapshot, no team pick change |
| Remove with no existing snapshot row | Null guard skips `Remove`; team pick removed normally |
| Same constructor added to slot 0 and slot 1 | Two distinct `LineupEntry` rows; unique key `(team_id, race_id, entity_type, slot_position)` is not violated |

---

## Verification

```bash
# Build
dotnet build F1CompanionApi/F1CompanionApi.csproj

# Run all tests
dotnet test F1CompanionApi.UnitTests/F1CompanionApi.UnitTests.csproj

# Apply migration to local DB
dotnet ef database update --project F1CompanionApi

# Manual smoke test
# 1. Add a driver via POST /me/team/drivers
# 2. Query DB: SELECT * FROM lineup_entries WHERE team_id = <id>;
#    → Should see 1 row with correct race_id, entity_id, entity_type=0, slot_position
# 3. Remove the driver via DELETE /me/team/drivers/{slot}
# 4. Query DB again → row should be gone
```
