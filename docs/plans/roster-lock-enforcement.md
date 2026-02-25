# Plan: Roster Lock Enforcement (Issue #16)

## Context

The `Race` entity already has a nullable `LockDeadline` field (added in an early migration) but it's
completely unused — every 2026 race is seeded with `LockDeadline = NULL` in `seed.sql`. This feature
enforces that deadline: once the lock window has passed, no roster changes are accepted, matching
SportsDeck Grand Prix's rules. The work splits across three self-contained commits.

---

## Step 0 — Create feature branch

```bash
git checkout -b feat/roster-lock-enforcement
```

---

## Commit 1 — Backend lock enforcement in TeamService

**Goal:** Add a `RosterLockedException` and check it in all four add/remove methods.

### New file: `api/F1CompanionApi/Domain/Exceptions/RosterLockedException.cs`

```csharp
public class RosterLockedException(string raceName, DateTime lockDeadline)
    : Exception($"Roster is locked for {raceName} (lock deadline: {lockDeadline:u})")
{
    public string RaceName { get; } = raceName;
    public DateTime LockDeadline { get; } = lockDeadline;
}
```

### Changes to `api/F1CompanionApi/Domain/Services/TeamService.cs`

Add a private helper (called once, shared by all four methods):

```csharp
private async Task ThrowIfRosterLockedAsync()
{
    var now = DateTime.UtcNow;
    var currentRace = await _dbContext.Races
        .Where(r => r.RaceDate >= now)
        .OrderBy(r => r.RaceDate)
        .FirstOrDefaultAsync();

    if (currentRace?.LockDeadline is not null && now >= currentRace.LockDeadline)
        throw new RosterLockedException(currentRace.Name, currentRace.LockDeadline.Value);
}
```

Call `await ThrowIfRosterLockedAsync()` at the top of:

- `AddDriverToTeamAsync` (after the logging call, before team ownership check)
- `RemoveDriverFromTeamAsync`
- `AddConstructorToTeamAsync`
- `RemoveConstructorFromTeamAsync`

Logic: find the next upcoming race (first race whose `RaceDate >= now`). If that race has a
`LockDeadline` that has already passed, reject the change. If `LockDeadline` is null, no lock is
enforced — safe default when deadlines aren't seeded yet.

### Changes to `api/F1CompanionApi.UnitTests/Services/TeamServiceTests.cs`

Add tests for each of the four methods:

- `AddDriverToTeamAsync_WhenRosterLocked_ThrowsRosterLockedException`
- `AddDriverToTeamAsync_WhenLockDeadlineNotPassed_Succeeds`
- `AddDriverToTeamAsync_WhenNoLockDeadlineSet_Succeeds`
- Same pattern for Remove driver, Add constructor, Remove constructor (at minimum the locked case)

Test setup: seed a Race with `RaceDate` in the future but `LockDeadline` in the past.

---

## Commit 2 — Seed 2026 race lock deadlines

**Goal:** Populate `LockDeadline` for all 24 races using SportsDeck's lock timing (qualifying start,
Saturday).

### Approach

Update `seed.sql` with the actual UTC qualifying-start timestamps so future fresh environments get
the correct deadlines from the start. No EF migration needed; production will be updated manually.

Replace the 24 `NULL` values in the race INSERT (lines 176–200) with the qualifying-start UTC
timestamps from the official 2026 F1 schedule. Typical pattern: Saturday ~15:00 local time,
converted to UTC per each circuit's time zone.

### Critical files

- `api/supabase/seed.sql` — replace 24 `NULL` deadlines with UTC qualifying-start timestamps (lines 174–200)

---

## Commit 3 — Frontend lock status + disabled pickers

**Mockup:** [`docs/mockups/roster-lock-mockups.html`](../mockups/roster-lock-mockups.html)

**Goal:** Show a lock countdown/status on the Team page and disable pickers when locked.

### Changes to `web/src/components/Team/Team.tsx`

1. Determine lock state from the current race (the one where `isCurrent === true`):

   ```tsx
   const currentRace = races.find((r) => r.isCurrent);
   const lockDeadline = currentRace?.lockDeadline ? new Date(currentRace.lockDeadline) : null;
   ```

2. Add a live clock using `useState`/`useEffect` so the UI reacts when the deadline passes:

   ```tsx
   const [now, setNow] = useState(new Date());
   useEffect(() => {
     const id = setInterval(() => setNow(new Date()), 1000);
     return () => clearInterval(id);
   }, []);
   const isLocked = lockDeadline != null && now >= lockDeadline;
   ```

3. Add a lock status badge/banner in the Team Info Card area (near budget/trades):
   - When `lockDeadline` is null: nothing rendered
   - When locked: "Locked" badge
   - When not yet locked: countdown "Locks in HH:MM:SS"

4. Pass `readOnly || isLocked` to both pickers so buttons are disabled when locked:
   ```tsx
   <DriverPicker readOnly={readOnly || isLocked} ... />
   <ConstructorPicker readOnly={readOnly || isLocked} ... />
   ```

### Changes to `web/src/components/Team/Team.test.tsx`

Add test cases:

- Shows "Locked" badge when current race is locked
- Shows countdown when lock deadline is in the future
- Shows nothing when lock deadline is null
- DriverPicker and ConstructorPicker receive `readOnly={true}` when locked (with `readOnly={false}` on the route)

No changes needed to DriverPicker, ConstructorPicker, or useLineupPicker — they already respect the
`readOnly` prop.

---

## Critical Files

| File                                                            | Change                                                      |
| --------------------------------------------------------------- | ----------------------------------------------------------- |
| `api/F1CompanionApi/Domain/Exceptions/RosterLockedException.cs` | New                                                         |
| `api/F1CompanionApi/Domain/Services/TeamService.cs`             | Add lock check helper + 4 call sites                        |
| `api/F1CompanionApi.UnitTests/Services/TeamServiceTests.cs`     | New test cases                                              |
| `api/supabase/seed.sql`                                         | Replace NULL deadlines with UTC qualifying-start timestamps |
| `web/src/components/Team/Team.tsx`                              | Lock state, countdown, pass to pickers                      |
| `web/src/components/Team/Team.test.tsx`                         | New test cases                                              |

---

## Verification

1. **Backend unit tests:** `dotnet test F1CompanionApi.UnitTests/F1CompanionApi.UnitTests.csproj`
2. **Manual API test:** Temporarily set a past `LockDeadline` on a race in dev DB; attempt
   `POST /me/team/drivers` → expect 400 with lock message.
3. **Frontend:** With a past `lockDeadline` in the race response, verify Team page shows "Locked",
   picker buttons are disabled, countdown shows correctly.
4. **Full suite:** `npm run test:all`
