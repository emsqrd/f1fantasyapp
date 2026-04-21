# 95 — Update team format to 5 drivers + 2 constructors

## Context

The fantasy team composition changed from **4 drivers + 4 constructors** to **5 drivers + 2 constructors**. `docs/research/fantasy-rules/decisions/format.md` already states `5 drivers + 2 constructors` at line 19, but the backend (`TeamService.cs`) still hardcodes the old 4/4 limits — the GitHub issue's claim that "backend already reflects this" is wrong. Scope is being expanded beyond the issue body (#95) to cover the backend so the feature works end-to-end.

Additionally, the current constructor rule allows the same constructor to occupy up to **2** slots (a relic of the 4-slot era). With only 2 slots going forward, constructor **uniqueness** is being introduced — no duplicates in a team — making constructors symmetric with drivers (which are already unique via `TeamService.cs:177`).

The frontend will render 5 driver cards in a centered 2-over-3 grid (top row 2 cards, bottom row 3 cards, all equal width), matching the approved mockup.

## Commit plan

Two self-contained commits. Backend first so the API accepts the new shape before the UI exercises it; both commits independently pass build, lint, tests.

---

### Commit 1 — `feat(api): enforce 5D+2C team shape and unique constructors`

Two coupled backend rule changes: slot/count limits and constructor uniqueness. Bundled because the old `SameConstructorThreeTimes` test stops making sense once the 2-slot cap lands (third add would throw `TeamFullException`, not `EntityAlreadyOnTeamException`).

**`api/F1CompanionApi/Domain/Services/TeamService.cs`**

Driver limits (`AddDriverToTeamAsync`):

- Line 152: `slotPosition > 3` → `slotPosition > 4`
- Line 155: `InvalidSlotPositionException(slotPosition, 3, "driver")` → `… 4, "driver"`
- Line 159: `team.TeamDrivers.Count >= 4` → `>= 5`
- Line 162: `TeamFullException(teamId, 4, "driver")` → `… 5, "driver"`

Constructor limits + uniqueness (`AddConstructorToTeamAsync`):

- Line 350: `slotPosition > 3` → `slotPosition > 1`
- Line 356: `InvalidSlotPositionException(slotPosition, 3, "constructor")` → `… 1, "constructor"`
- Line 360: `team.TeamConstructors.Count >= 4` → `>= 2`
- Line 363: `TeamFullException(teamId, 4, "constructor")` → `… 2, "constructor"`
- Lines 377–387: replace the `constructorCount >= 2` block with the uniqueness pattern already used for drivers (see `TeamService.cs:177`):

  ```csharp
  if (team.TeamConstructors.Any(tc => tc.ConstructorId == constructorId))
  {
      _logger.LogWarning("Constructor {ConstructorId} already on team {TeamId}", constructorId, teamId);
      throw new EntityAlreadyOnTeamException(constructorId, "constructor", teamId);
  }
  ```

**`api/F1CompanionApi.UnitTests/Services/TeamServiceTests.cs`**

Slot-position bounds:

- Line 492: driver `InlineData(5)` → `InlineData(6)` (first invalid slot above the new max of 4)
- Line 812: constructor `InlineData(4)` → `InlineData(2)`

Team-full assertions:

- `AddDriverToTeamAsync_TeamHasMaximumDrivers_…` (line 515+): seed 5 drivers instead of 4 (loop to `< 5`, unique slots 0–4; update comment at line 524).
- `AddConstructorToTeamAsync_TeamHasMaximumConstructors_…` (line 833+): seed 2 *different* constructors instead of 4 (was 4 of the same, which is no longer legal); update comment at line 843.

Constructor uniqueness (replaces old "same constructor up to 2 times" tests):

- Line 883 `AddConstructorToTeamAsync_SameConstructorTwice_Succeeds` — **rewrite** as `…_SameConstructorSecondAdd_ThrowsEntityAlreadyOnTeamException`: add once at slot 0, add again at slot 1 → expect `EntityAlreadyOnTeamException`.
- Line 908 `AddConstructorToTeamAsync_SameConstructorThreeTimes_Throws…` — **delete** (redundant with the above).
- Line 931 `AddConstructorToTeamAsync_TwoDifferentConstructorsEachTwice_FillsAllSlots` — **rewrite** as `…_TwoDifferentConstructors_FillsAllSlots`: 2 distinct constructors, slots 0 and 1, assert 2 rows, one per constructor.
- Line 1314 `AddConstructorToTeamAsync_SameConstructorTwice_CreatesTwoLineupEntries` — **rewrite** as `…_TwoDifferentConstructors_CreateTwoLineupEntries`: 2 distinct constructors, slots 0 and 1, assert 2 `LineupEntry` rows.

**`docs/research/fantasy-rules/decisions/format.md`**

Rewrite the `## Constraints` heading body (currently lines 25–27) so the uniqueness rule applies to both entity types and the old "any combination is valid" claim is corrected:

```
## Constraints

**Drivers and constructors must each be unique within a team** — a team cannot select the same driver or the same constructor twice.

Beyond uniqueness, there are no roster constraints. Players may pick both drivers from the same constructor. Budget already prevents degenerate stacking by making top-team asset concentration expensive.
```

The "driver without their constructor" clause from the old body was dropped — it was the default state, not a choice worth calling out.

**Note on stale reference:** `docs/plans/44-lineup-snapshots.md` contains outdated language ("the domain allows the same constructor twice on one team") tied to a completed plan. Leaving it as historical record — updating archived plan docs is out of scope.

**Verification for commit 1:**

- `npm run api:test` — all green.
- `npm run api:format:check` and `npm run api:build` — clean.

---

### Commit 2 — `feat(web): update team builder UI to 5 drivers + 2 constructors`

Flip picker slot counts, restructure driver grid to centered 2-over-3, update test fixtures.

**`web/src/components/DriverPicker/DriverPicker.tsx`**

- Line 29: `DRIVER_SLOTS = 4` → `5`
- Line 86: replace the grid container `className` from `grid-cols-1 gap-4 sm:grid-cols-2` to `grid-cols-1 gap-4 sm:grid-cols-6`. On each mapped slot, apply `sm:col-span-2`; on `index === 0`, additionally apply `sm:col-start-2`. Result at sm+: top row has 2 cards occupying cols 2–3 and 4–5 (centered, cols 1 and 6 empty), bottom row has 3 cards across cols 1–2, 3–4, 5–6. All cards equal width. Below sm, `grid-cols-1` stacks all 5 vertically and the col-span classes are no-ops.

**`web/src/components/ConstructorPicker/ConstructorPicker.tsx`**

- Line 27: `CONSTRUCTOR_SLOTS = 4` → `2`
- Grid unchanged — `sm:grid-cols-2` already fits 2 cards perfectly.

**`web/src/components/DriverPicker/DriverPicker.test.tsx`**

- Line 52: empty fixture `[null, null, null, null]` → 5 nulls
- Line 60 + 66: rename "4 empty driver slots" → "5 empty driver slots"; `toHaveLength(4)` → `5`
- Lines 94–102: extend full-lineup fixture to 5 drivers
- Lines 143–144: repad partial-lineup fixtures to length 5

**`web/src/components/ConstructorPicker/ConstructorPicker.test.tsx`**

- Line 61: empty fixture `[null, null, null, null]` → `[null, null]`
- Line 81 + 91: rename "4 empty constructor slots" → "2 empty constructor slots"; `toHaveLength(4)` → `2`
- Lines 119–132: trim full-lineup fixture to 2 constructors
- Line 447: `'2 / 4'` → `'2 / 2'`

`web/src/hooks/useLineupPicker.test.ts` — no changes (format-agnostic).

**Verification for commit 2:**

- `npm run web:test` — all picker tests green.
- `npm run web:lint` and `npm run web:format:check` — clean.
- `npm run web:dev` and load the team builder:
  - Drivers: 5 empty slots, 2 centered on the top row + 3 full-width on the bottom row at sm/md/lg. Below sm, all 5 stack vertically with no orphan.
  - Constructors: 2 empty slots side-by-side.
  - Fill/clear slots → counters read `… / 5` and `… / 2`.
  - Pick a 5th driver end-to-end (click through to save) and confirm the API accepts `slotPosition: 4` — proves commit 1 wired correctly.
  - Try to add the same constructor twice in the UI → API rejects with `EntityAlreadyOnTeamException` (409).

---

## Out of scope (confirmed)

- Captain/2× badge — already implemented full-stack (`DriverCard.tsx:71-102`, `Team.tsx:56-99`, backend `setCaptain`).
- Budget cap — unchanged at $100M per `format.md`.
- Loading skeletons, Storybook, E2E, snapshot tests — none exist for these components.
- `useLineupPicker.test.ts` — uses `lineupSize: 4` as a generic parameter; not format-coupled.
- `web/src/contracts/Team.ts` — open-ended arrays, no length constraints.
- Driver uniqueness — already enforced (`TeamService.cs:177`).
- Stale prose in `docs/plans/44-lineup-snapshots.md` — historical record of a completed plan; not updated.
