# Allow Duplicate Constructors (Issue #15)

## Context

SportsDeck allows up to 2 of the same constructor on a team, but we currently block all duplicates. This is enforced in two places: a unique DB index on `(TeamId, ConstructorId)` and an application-level check in `TeamService`. On the frontend, `useLineupPicker` filters selected items out of the picker pool entirely. All three need to change.

## Changes

### 1. Remove unique index — `api/F1CompanionApi/Data/Entities/TeamConstructor.cs`

Remove `[Index(nameof(TeamId), nameof(ConstructorId), IsUnique = true)]` (line 10). Keep the slot position unique index (line 9). Then generate the EF Core migration:

```bash
cd api && dotnet ef migrations add AllowDuplicateConstructorsOnTeam --project F1CompanionApi
```

### 2. Change duplicate check to max-2 cap — `api/F1CompanionApi/Domain/Services/TeamService.cs`

Replace lines 306-315 (the `.Any()` duplicate ban) with a `.Count() >= 2` check:

```csharp
var constructorCount = team.TeamConstructors.Count(tc => tc.ConstructorId == constructorId);
if (constructorCount >= 2)
{
    _logger.LogWarning(
        "Constructor {ConstructorId} already at maximum (2) on team {TeamId}",
        constructorId, teamId);
    throw new EntityAlreadyOnTeamException(constructorId, "constructor", teamId);
}
```

Reuse `EntityAlreadyOnTeamException` — no new exception class needed.

### 3. Update backend tests — `api/F1CompanionApi.UnitTests/Services/TeamServiceTests.cs`

- **Replace** `AddConstructorToTeamAsync_ConstructorAlreadyOnTeam_ThrowsInvalidOperationException` (lines 679-699) with a test that adding the same constructor to a second slot **succeeds**
- **Add** test: same constructor 3 times throws `EntityAlreadyOnTeamException`
- **Add** test: two different constructors each twice fills all 4 slots successfully

### 4. Add `maxDuplicates` option to hook — `web/src/hooks/useLineupPicker.ts`

Add optional `maxDuplicates` param (default: `1`) to `UseLineupPickerOptions`. Update pool filtering from a Set-based exclusion to a count-based filter.

```typescript
const pool = useMemo(() => {
  const maxAllowed = maxDuplicates ?? 1;
  const counts = new Map<number, number>();
  displayLineup
    .filter((item): item is T => item !== null)
    .forEach((item) => {
      counts.set(item.id, (counts.get(item.id) ?? 0) + 1);
    });
  return items.filter((item) => (counts.get(item.id) ?? 0) < maxAllowed);
}, [items, displayLineup, maxDuplicates]);
```

### 5. Pass `maxDuplicates: 2` + update sheet description — `web/src/components/ConstructorPicker/ConstructorPicker.tsx`

- Add `maxDuplicates: 2` to the `useLineupPicker` call. DriverPicker remains unchanged (defaults to 1).
- Update the sheet description to: "You may select the same constructor up to 2 times."

> **Future consideration:** The updated sheet description may be sufficient on its own, but once the feature is working end-to-end, evaluate whether an inline "on team" badge on individual constructor list items would improve clarity. See [mockups](mockups/on-team-badge-mockups.html) (Option H) for visual reference.

### 6. Update frontend tests

- **`web/src/hooks/useLineupPicker.test.ts`** — Add tests for `maxDuplicates` behavior: items stay in pool below threshold, removed at threshold, defaults to 1.
- **`web/src/components/ConstructorPicker/ConstructorPicker.test.tsx`** — Add test verifying `maxDuplicates: 2` is passed to the hook and that sheet description mentions duplicate rule.

## Files Modified

| File | Change |
|------|--------|
| `api/.../Data/Entities/TeamConstructor.cs` | Remove unique index attribute |
| `api/.../Domain/Services/TeamService.cs` | `.Any()` → `.Count() >= 2` |
| `api/.../UnitTests/Services/TeamServiceTests.cs` | Replace/add duplicate constructor tests |
| `web/src/hooks/useLineupPicker.ts` | Add `maxDuplicates` option |
| `web/src/components/ConstructorPicker/ConstructorPicker.tsx` | Pass `maxDuplicates: 2`, update sheet description |
| `web/src/hooks/useLineupPicker.test.ts` | Add `maxDuplicates` tests |
| `web/src/components/ConstructorPicker/ConstructorPicker.test.tsx` | Verify hook wiring + sheet description |
| New migration file (auto-generated) | Drop unique constraint |

## Verification

1. `dotnet test` — all API tests pass
2. `npm test` (in web/) — all frontend tests pass
3. `dotnet build` and `npm run build` — no type errors
4. Manual: add same constructor to two slots, confirm it works. Try a third — should fail.
