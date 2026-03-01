# Team Page Redesign — Issue #50

## Context

The current team page mixes two concerns: lineup management and round results. It splits drivers and constructors into separate tabs (requiring navigation to see both halves of the team), shows a non-functional race selector, and displays fabricated round results data ("1st / 679 pts"). The result is that a user can never see their full $100M budget picture at once.

Issue #50 calls for refocusing the page on lineup selection as its single concern. The target design is **Option A "Pit Lane"** (`docs/mockups/50-team-page-option-a.html`):
- All 8 picks visible at once (unified scroll — no tabs)
- 8px left constructor color stripe as the primary visual identity
- Price prominently displayed; price trend deferred (no backend data yet)
- Constructor colors sourced from a frontend lookup table (no API changes)
- Captain toggle kept, positioned in a right-side actions column
- Compact inline header (team name, race subtitle, remaining / transfers / countdown)
- Captain prompt banner appears when roster is full but no captain selected

---

## Commit 1 — Add team color lookup + Pit Lane card redesign

**Why first:** Cards are the leaf components. Redesigning them in isolation is a small, reviewable diff with no layout side effects. The color lookup is a new file with no dependencies.

### New file: `web/src/lib/teamColors.ts`

Static lookup tables:
- `constructorColors: Record<string, string>` — constructor abbreviation → hex (using palette from `docs/research/50-team-page-findings.md` §5: RBR `#3671C6`, FER `#E8002D`, MCL `#FF8000`, MER `#27F4D2`, AMR `#229971`, ALP `#FF87BC`, WIL `#64C4FF`, RB `#6692FF`, HAA `#B6BABD`, SAU `#52E252`)
- `driverConstructorMap: Record<string, string>` — driver abbreviation → constructor abbreviation (for the current season)
- `getConstructorColor(abbr: string): string | undefined`
- `getDriverColor(abbr: string): string | undefined`

### `web/src/components/DriverCard/DriverCard.tsx`

New layout — flex row:
```
[8px stripe, full height, bg=getDriverColor(abbr) ?? border-color]
[body: flex col, flex-1
  top: driver full name (bold, slightly larger)
  bottom: price (formatBudget, prominent weight)
]
[actions: flex col, align-right, gap
  top: remove ✕ button (circle, 28px) — hidden when readOnly
  bottom: captain C/2× button (circle, 28px, existing flip animation) — hidden when readOnly
]
```

Remove from current card: abbreviation circle (56px), country abbreviation, `"-- pts"` placeholder, the shadcn `Card` wrapper (caller owns the container).

Empty slot: `<button>` with dashed border, 72px min-height, `+` icon circle, "Add Driver" label — hidden when `readOnly`.

Read-only empty slot: render nothing (slot simply absent).

Captain button: keep the existing 3D flip animation (`rotateY`). "C" inactive (muted foreground), "2×" active (amber bg). ARIA: `"Set [name] as captain"` / `"Captain — 2× points (active)"`.

### `web/src/components/ConstructorCard/ConstructorCard.tsx`

Same Pit Lane layout as DriverCard but:
- Color from `getConstructorColor(constructor.abbreviation)`
- No captain button — actions column has only the ✕ remove button

### Tests

`DriverCard.test.tsx` and `ConstructorCard.test.tsx`: update to match new DOM structure. Cover: filled state renders name + price + stripe; captain active/inactive rendering; remove button presence when editable; empty slot button presence; read-only state hides actions.

---

## Commit 2 — Unified team page layout

**Why second:** Now that cards are correct, restructure the container layout. This commit removes all the mixed-concern code and wires everything into a single scroll.

### `web/src/components/DriverPicker/DriverPicker.tsx`

Add a **section header** above the card grid:
```
DRIVERS  ·  {filledCount} / 4    (small caps label, muted count on right)
```
`filledCount = displayLineup.filter(Boolean).length`

Replace the current animated collapsible captain hint with a **captain prompt banner** shown when: `!readOnly && filledCount === 4 && captainDriverId == null`. Style: amber/gold background, 1px amber border, border-radius, "Select your captain — they score 2× points this race" with a small `C` icon prefix. Use `role="status"` for accessibility.

### `web/src/components/ConstructorPicker/ConstructorPicker.tsx`

Add same-style **section header**:
```
CONSTRUCTORS  ·  {filledCount} / 4
```

No captain changes.

### `web/src/components/Team/Team.tsx`

**Remove:**
- `activeTab` state and `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` — both shadcn imports and JSX
- `selectedRaceId` state and race selector `Select` component
- Round results `Card` ("Round Results", "1st", "679 pts" placeholders)
- The two-column `sm:grid-cols-2` header layout (right column is now gone)
- The outer `Card` wrappers around each picker

**Update header** to compact inline layout:
```
[team name — bold, left-aligned]
[race subtitle — "Round {round} · {race.name}", muted, small]
[metrics row — flex, space-between:
  left: "REMAINING {formatBudget(remainingBudget)}" | "TRANSFERS 3/3" (placeholder)
  right: "LINEUP LOCKS IN · DD:HH:MM" or Lock icon + "Lineup Locked" (muted, same style as today)
]
```
Keep existing countdown math (`lockDays`, `lockHours`, `lockMins`), `isLocked`, `lockingImminently`, and the `visibilitychange` listener — none of that changes.

**Render pickers directly:**
```tsx
{captainError && <InlineError message={captainError} />}
<DriverPicker ... />
<ConstructorPicker ... />
```

The `captainError` display moves from inside a tab to directly above `DriverPicker`.

**Remove imports:** `Select`, `Tabs` family, `Card`/`CardContent`/`CardHeader`/`CardTitle` (if no longer used).

**Keep:** `AppContainer maxWidth="md"`, all captain logic (`handleSetCaptain`, `captainDriverId`, `captainError`), lock deadline logic.

### Tests

`Team.test.tsx`: remove tests for tab switching and race selector; add tests confirming both driver and constructor sections render in a single view; confirm captain error renders above drivers; confirm locked state shows lock indicator.

`DriverPicker.test.tsx`: add test for captain prompt banner shown/hidden based on roster + captain state.

`ConstructorPicker.test.tsx`: add test for section header render.

---

## Critical files

| File | Change |
|---|---|
| `web/src/lib/teamColors.ts` | NEW — color lookup |
| `web/src/components/DriverCard/DriverCard.tsx` | Pit Lane redesign |
| `web/src/components/DriverCard/DriverCard.test.tsx` | Update tests |
| `web/src/components/ConstructorCard/ConstructorCard.tsx` | Pit Lane redesign |
| `web/src/components/ConstructorCard/ConstructorCard.test.tsx` | Update tests |
| `web/src/components/DriverPicker/DriverPicker.tsx` | Section header + captain banner |
| `web/src/components/DriverPicker/DriverPicker.test.tsx` | Update tests |
| `web/src/components/ConstructorPicker/ConstructorPicker.tsx` | Section header |
| `web/src/components/ConstructorPicker/ConstructorPicker.test.tsx` | Update if needed |
| `web/src/components/Team/Team.tsx` | Remove tabs/race selector/results, unified layout |
| `web/src/components/Team/Team.test.tsx` | Update tests |

---

## Existing utilities to reuse

- `formatBudget` from `@/lib/utils` — used in Team.tsx header and on cards for price display
- `useLineupPicker` hook (`web/src/hooks/useLineupPicker.ts`) — no changes needed
- `InlineError` component — already used for captain error; no changes
- `AppContainer` — unchanged, keep `maxWidth="md"`
- `setCaptain` from `@/services/teamService` — unchanged

---

## Verification

After each commit:
```bash
npm run web:test        # all tests pass
npm run web:build       # no TypeScript errors
npm run lint            # no lint errors
npx prettier --write .  # format before committing
```

Manual check (run `npm run web:dev`):
1. **State 1** (incomplete roster, pre-lock): both sections visible, empty slot shows "+ Add Driver", captain C button visible, countdown in header
2. **State 2** (full roster, no captain): captain prompt banner visible in Drivers section, C button on each driver
3. **State 3** (locked): no remove buttons, no captain toggle, header shows Lock icon + "Lineup Locked"
4. **Read-only** (other user's team): no actions visible anywhere
