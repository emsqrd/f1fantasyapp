# Phase 1: Driver/Constructor Selection UX Redesign (Issue #14)

## Context

The current picker experience only shows names — no price, performance, team affiliation, or country data. Users can't make informed strategic decisions when building their team. This phase redesigns the Cards and ListItems to show richer information, and builds a UX shell with placeholders that Phase 2 (pricing/budget) and Phase 4 (scoring) will populate with real data later.

## Approach: Enhanced Sheet + Richer Components

Keep the existing Sheet-based picker pattern. Widen the sheet for more content room, and redesign ListItem and Card components to display additional data.

**Why Sheet, not full-page?** Keeps the current team visible behind the overlay on desktop, avoids rearchitecting the picker flow (no new routes, no changes to `useLineupPicker`), and keeps scope manageable.

---

## Step 1: Add `abbreviation` to `Driver` interface

The API already returns `Abbreviation` (`api/.../Models/DriverResponse.cs:8`) but the frontend `Driver` interface drops it.

**Modify:** `web/src/contracts/Role.ts`
- Add `abbreviation: string` to `Driver` interface

**Modify:** `web/src/test-utils/mockFactories.ts`
- Add `abbreviation: 'TDR'` default to `createMockDriver`
- Add `createMockConstructor` and `createMockConstructorList` factories (currently missing — constructor tests create mocks inline)

**Verify:** Run existing tests to confirm nothing breaks from the interface change.

---

## Step 2: Redesign DriverListItem

**Modify:** `web/src/components/DriverListItem/DriverListItem.tsx`

From single-line name to two-line layout:

```
[ABR]  Max Verstappen               [+ btn]
       NED  ·  $--.-M  ·  -- pts
```

- **Left:** Driver abbreviation in a small badge/pill (3 letters)
- **Line 1:** Full name (`firstName lastName`), bold
- **Line 2:** Country abbreviation · price placeholder · points placeholder (all `text-muted-foreground`)
- **Right:** Existing CirclePlus add button

**Create:** `web/src/components/DriverListItem/DriverListItem.test.tsx`
- Tests: renders abbreviation, country, price placeholder, points placeholder, existing add button behavior

---

## Step 3: Redesign ConstructorListItem

**Modify:** `web/src/components/ConstructorListItem/ConstructorListItem.tsx`

Same two-line pattern adapted for constructors:

```
[●]  McLaren                        [+ btn]
     GBR  ·  $--.-M  ·  -- pts
```

- **Left:** Neutral color dot/circle (placeholder for future team branding colors)
- **Line 1:** Constructor `name`, bold
- **Line 2:** Country · price placeholder · points placeholder

**Create:** `web/src/components/ConstructorListItem/ConstructorListItem.test.tsx`
- Tests: renders color indicator, country, placeholders, add button behavior

---

## Step 4: Redesign DriverCard (filled state)

**Modify:** `web/src/components/DriverCard/DriverCard.tsx`

Replace the empty `<span>` circle with a shadcn `Avatar` + `AvatarFallback` showing abbreviation:

```
[VER]  Max Verstappen           [x]
       NED
       ─────────────
       $--.-M    -- pts
```

- **Avatar:** `AvatarFallback` with abbreviation text (ready for `AvatarImage` when driver headshots are available)
- **Country:** Below name in `text-muted-foreground`
- **Separator:** Thin horizontal divider
- **Bottom row:** Price + points placeholders
- **Empty/read-only states:** Update circle sizing to match new Avatar dimensions

**Modify:** `web/src/components/DriverCard/DriverCard.test.tsx`
- Add tests: avatar with abbreviation fallback, country display, placeholder text in filled state

---

## Step 5: Redesign ConstructorCard (filled state)

**Modify:** `web/src/components/ConstructorCard/ConstructorCard.tsx`

Same layout pattern as DriverCard:

```
[●]  McLaren                    [x]
     McLaren F1 Team
     ─────────────
     $--.-M    -- pts
```

- **Left:** Color indicator circle (neutral `bg-muted` for now)
- **Name:** Constructor `name` (short name), bold
- **Subtitle:** `fullName` in `text-muted-foreground` (data exists in model, just not displayed yet)
- **Separator + placeholders:** Same pattern as DriverCard

**Modify:** `web/src/components/ConstructorCard/ConstructorCard.test.tsx`
- Add tests: fullName display, color indicator, placeholder text in filled state

---

## Step 6: Widen Picker Sheets

**Modify:** `web/src/components/DriverPicker/DriverPicker.tsx`
**Modify:** `web/src/components/ConstructorPicker/ConstructorPicker.tsx`

Current `SheetContent` className: `"flex h-full w-80 flex-col"` (320px at all sizes — overrides Sheet's responsive defaults)

Change: Remove `w-80`, let Sheet's default `w-3/4` apply on mobile. Override `sm:max-w-sm` to `sm:max-w-md` (448px) on desktop for more content room.

Existing picker tests should pass without changes (width is CSS-only).

---

## Files NOT Changed

| File | Reason |
|------|--------|
| `web/src/hooks/useLineupPicker.ts` | No logic changes needed |
| `web/src/components/Team/Team.tsx` | Changes cascade through props naturally |
| `web/src/services/teamService.ts` | No API changes |
| Backend/API | `Abbreviation` already returned |

## Data Model Notes

- **No price/points fields added** to `Driver`/`Constructor` interfaces — placeholders (`$--.-M`, `-- pts`) are purely visual strings. Phase 2 will add a `price` field and swap in real values.
- **Constructor colors** use a neutral dot for now. A color mapping can be introduced later without layout changes.
- **Driver headshots** — `Avatar` component is ready; just add `AvatarImage` when image URLs become available.

## Verification

1. `npm run web:test` — all tests pass
2. `npm run web:build` — no type errors
3. `npm run lint` — clean
4. Manual testing:
   - Open Team page, verify Cards show new layout (abbreviation/avatar, country, placeholders)
   - Open picker Sheet, verify ListItems show two-line layout with placeholders
   - Test add/remove flow still works
   - Check mobile viewport in browser dev tools (Sheet should be 75% width)
