# Architecture Review: Picker Components (Issue #7)

## Decisions Made

1. **Minimal sharing**: Only share a `useLineupPicker` hook for state logic. No shared layout or card components.
2. **Remove generics and adapters**: No more `LineupPicker<T>`, no adapter components
3. **Self-contained pickers**: `DriverPicker` and `ConstructorPicker` each render their own grid/sheet/overlay JSX
4. **Self-contained cards**: `DriverCard` and `ConstructorCard` inline their empty/filled content with duplicated Card wrapper styling
5. **Move data fetching to route loader**: Active drivers/constructors fetched in team route loader, not in picker components
6. **Remove `BaseRole`**: Inline shared fields into `Driver` and `Constructor`, delete the base interface

---

## Step 1. Remove `BaseRole`, restructure types

**Modify:** `web/src/contracts/Role.ts`

- Delete `BaseRole` interface
- Inline the 3 shared fields (`type`, `id`, `countryAbbreviation`) into `Driver` and `Constructor`
- Optionally rename file (currently only `LineupPicker.tsx` references `BaseRole`, which gets deleted)

```ts
// Before
export interface BaseRole {
  type: 'driver' | 'constructor';
  id: number;
  countryAbbreviation: string;
}
export interface Driver extends BaseRole {
  type: 'driver';
  firstName: string;
  lastName: string;
}
export interface Constructor extends BaseRole {
  type: 'constructor';
  name: string;
  fullName: string;
}

// After
export interface Driver {
  type: 'driver';
  id: number;
  countryAbbreviation: string;
  firstName: string;
  lastName: string;
}

export interface Constructor {
  type: 'constructor';
  id: number;
  countryAbbreviation: string;
  name: string;
  fullName: string;
}
```

---

## Step 2. Create `useLineupPicker` hook

**New file:** `web/src/hooks/useLineupPicker.ts`

The **only shared abstraction** in the new architecture. Extracts state logic from current `LineupPickerContent`:
- `displayLineup` — memoized lineup with null padding
- `pool` — memoized available items filtered to exclude selected
- `selectedPosition` / `openPicker` / `closePicker` — picker overlay state management
- `isPending` — mutation in progress
- `error` — error message for failed operations
- `handleAdd(position, item)` — calls addToTeam, invalidates router, closes picker on success, logs errors with Sentry
- `handleRemove(position)` — calls removeFromTeam, invalidates router, logs errors with Sentry

Parameters: `{ items, lineup, lineupSize, itemType, addToTeam, removeFromTeam }`

```ts
import { useRouter } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import * as Sentry from '@sentry/react';

interface UseLineupPickerOptions<T extends { id: number }> {
  items: T[];
  lineup: (T | null)[];
  lineupSize: number;
  itemType: string;
  addToTeam: (itemId: number, position: number) => Promise<void>;
  removeFromTeam: (position: number) => Promise<void>;
}

/**
 * Manages lineup selection state and operations for picker components.
 * Handles item pool filtering, picker state, and add/remove operations with error handling.
 */
export function useLineupPicker<T extends { id: number }>({
  items,
  lineup,
  lineupSize,
  itemType,
  addToTeam,
  removeFromTeam,
}: UseLineupPickerOptions<T>) {
  const router = useRouter();
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pad lineup with nulls to match lineupSize for empty slots
  const displayLineup = useMemo(() => {
    const currentLineup = lineup ?? [];
    return currentLineup.length === lineupSize
      ? currentLineup
      : [...currentLineup, ...Array(lineupSize - currentLineup.length).fill(null)];
  }, [lineup, lineupSize]);

  // Filter out already-selected items from the available pool
  const pool = useMemo(() => {
    const selectedIds = new Set(
      displayLineup.filter((item): item is T => item !== null).map((item) => item.id),
    );
    return items.filter((item) => !selectedIds.has(item.id));
  }, [items, displayLineup]);

  /**
   * Adds an item to the lineup at the specified position.
   * Closes the picker on success, keeps it open on error for retry.
   */
  const handleAdd = async (position: number, item: T) => {
    setIsPending(true);
    setError(null);
    try {
      await addToTeam(item.id, position);
      await router.invalidate();
      setSelectedPosition(null);
    } catch (err) {
      Sentry.logger.error(`Failed to add ${itemType} to lineup`, {
        itemType,
        position,
        itemId: item.id,
        error: err
      });
      setError(`Failed to add ${itemType}. Please try again.`);
    } finally {
      setIsPending(false);
    }
  };

  /**
   * Removes an item from the lineup at the specified position.
   */
  const handleRemove = async (position: number) => {
    setIsPending(true);
    setError(null);
    try {
      await removeFromTeam(position);
      await router.invalidate();
    } catch (err) {
      Sentry.logger.error(`Failed to remove ${itemType} from lineup`, {
        itemType,
        position,
        error: err
      });
      setError(`Failed to remove ${itemType}. Please try again.`);
    } finally {
      setIsPending(false);
    }
  };

  /**
   * Opens the picker overlay for the specified position.
   * Clears any previous errors and prevents opening during pending operations.
   */
  const openPicker = (position: number) => {
    if (!isPending) {
      setError(null);
      setSelectedPosition(position);
    }
  };

  return {
    displayLineup,
    pool,
    selectedPosition,
    isPending,
    error,
    openPicker,
    closePicker: () => setSelectedPosition(null),
    handleAdd,
    handleRemove,
  };
}
```

---

## Step 3. Update `DriverCard` (self-contained)

**Modify:** `web/src/components/DriverCard/DriverCard.tsx`

- Remove dependency on `RoleCard`, `AddRoleCardContent`, `InfoRoleCardContent`
- Inline the Card wrapper styling and empty/filled content directly
- Duplicated Card styling is ~4 lines of Tailwind classes — acceptable tradeoff for zero shared card abstractions

```tsx
import type { Driver } from '@/contracts/Role';
import { CirclePlus, X } from 'lucide-react';

import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

interface DriverCardProps {
  driver: Driver | null;
  onOpenPicker: () => void;
  onRemove: () => void;
}

export function DriverCard({ driver, onOpenPicker, onRemove }: DriverCardProps) {
  return (
    <Card className="bg-secondary relative py-4">
      <CardContent className="group flex h-full items-center justify-between px-3">
        {driver ? (
          <div className="flex w-full">
            <span className="aspect-square w-14 self-center rounded-full border-2 border-gray-300" />
            <div className="flex flex-1 flex-col items-start justify-between pl-4">
              <h3 className="text-lg font-bold">
                {driver.firstName} {driver.lastName}
              </h3>
            </div>
          </div>
        ) : (
          <Button
            onClick={onOpenPicker}
            variant="ghost"
            className="flex items-center gap-2 !bg-transparent"
          >
            <CirclePlus />
            Add Driver
          </Button>
        )}
      </CardContent>
      {driver && (
        <Button
          size="icon"
          variant="ghost"
          className="bg-secondary absolute top-2 right-2 h-6 w-6 rounded-full text-white"
          aria-label="Remove driver"
          onClick={onRemove}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </Card>
  );
}
```

---

## Step 4. Update `ConstructorCard` (self-contained)

**Modify:** `web/src/components/ConstructorCard/ConstructorCard.tsx`

Same pattern as DriverCard — inline all rendering:

```tsx
import type { Constructor } from '@/contracts/Role';
import { CirclePlus, X } from 'lucide-react';

import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

interface ConstructorCardProps {
  constructor: Constructor | null;
  onOpenPicker: () => void;
  onRemove: () => void;
}

export function ConstructorCard({ constructor, onOpenPicker, onRemove }: ConstructorCardProps) {
  return (
    <Card className="bg-secondary relative py-4">
      <CardContent className="group flex h-full items-center justify-between px-3">
        {constructor ? (
          <div className="flex w-full">
            <span className="aspect-square w-14 self-center rounded-full border-2 border-gray-300" />
            <div className="flex flex-1 flex-col items-start justify-between pl-4">
              <h3 className="text-lg font-bold">{constructor.name}</h3>
            </div>
          </div>
        ) : (
          <Button
            onClick={onOpenPicker}
            variant="ghost"
            className="flex items-center gap-2 !bg-transparent"
          >
            <CirclePlus />
            Add Constructor
          </Button>
        )}
      </CardContent>
      {constructor && (
        <Button
          size="icon"
          variant="ghost"
          className="bg-secondary absolute top-2 right-2 h-6 w-6 rounded-full text-white"
          aria-label="Remove constructor"
          onClick={onRemove}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </Card>
  );
}
```

---

## Step 5. Rewrite `DriverPicker` (self-contained with hook)

**Modify:** `web/src/components/DriverPicker/DriverPicker.tsx`

- Uses `useLineupPicker` hook for state
- Renders its own grid, pending overlay, and Sheet directly
- No shared layout component — owns its JSX entirely
- Receives `activeDrivers` from route loader (no internal data fetching)

```tsx
import type { Driver } from '@/contracts/Role';
import { addDriverToTeam, removeDriverFromTeam } from '@/services/teamService';

import { useLineupPicker } from '@/hooks/useLineupPicker';
import { DriverCard } from '../DriverCard/DriverCard';
import { DriverListItem } from '../DriverListItem/DriverListItem';
import { InlineError } from '../InlineError/InlineError';
import { ScrollArea } from '../ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../ui/sheet';

interface DriverPickerProps {
  activeDrivers: Driver[];
  currentDrivers: (Driver | null)[];
  lineupSize?: number;
}

export function DriverPicker({ activeDrivers, currentDrivers, lineupSize = 5 }: DriverPickerProps) {
  const {
    displayLineup,
    pool,
    selectedPosition,
    isPending,
    error,
    openPicker,
    closePicker,
    handleAdd,
    handleRemove,
  } = useLineupPicker({
    items: activeDrivers,
    lineup: currentDrivers,
    lineupSize,
    itemType: 'driver',
    addToTeam: addDriverToTeam,
    removeFromTeam: removeDriverFromTeam,
  });

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 relative">
        {displayLineup.map((driver, idx) => (
          <DriverCard
            key={idx}
            driver={driver}
            onOpenPicker={() => openPicker(idx)}
            onRemove={() => handleRemove(idx)}
          />
        ))}

        {isPending && (
          <div className="bg-background/50 absolute inset-0 flex items-center justify-center">
            <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
          </div>
        )}
      </div>

      <Sheet
        open={selectedPosition !== null && !isPending}
        onOpenChange={(open) => !open && closePicker()}
      >
        <SheetTrigger asChild>
          <div />
        </SheetTrigger>
        <SheetContent className="flex h-full w-80 flex-col">
          <SheetHeader>
            <SheetTitle>Select Driver</SheetTitle>
            <SheetDescription>
              Choose a driver from the list below to add to your team.
            </SheetDescription>
            {error && <InlineError message={error} />}
          </SheetHeader>
          <ScrollArea className="h-full min-h-0 flex-1 pr-4 pl-4">
            <ul className="space-y-2">
              {pool.map((driver) => (
                <DriverListItem
                  key={driver.id}
                  driver={driver}
                  onSelect={() => {
                    if (selectedPosition !== null) {
                      handleAdd(selectedPosition, driver);
                    }
                  }}
                />
              ))}
            </ul>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
```

---

## Step 6. Rewrite `ConstructorPicker` (self-contained with hook)

**Modify:** `web/src/components/ConstructorPicker/ConstructorPicker.tsx`

Same pattern as DriverPicker — own JSX, uses hook for state:

```tsx
import type { Constructor } from '@/contracts/Role';
import { addConstructorToTeam, removeConstructorFromTeam } from '@/services/teamService';

import { useLineupPicker } from '@/hooks/useLineupPicker';
import { ConstructorCard } from '../ConstructorCard/ConstructorCard';
import { ConstructorListItem } from '../ConstructorListItem/ConstructorListItem';
import { InlineError } from '../InlineError/InlineError';
import { ScrollArea } from '../ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../ui/sheet';

interface ConstructorPickerProps {
  activeConstructors: Constructor[];
  currentConstructors: (Constructor | null)[];
  lineupSize?: number;
}

export function ConstructorPicker({
  activeConstructors,
  currentConstructors,
  lineupSize = 2,
}: ConstructorPickerProps) {
  const {
    displayLineup,
    pool,
    selectedPosition,
    isPending,
    error,
    openPicker,
    closePicker,
    handleAdd,
    handleRemove,
  } = useLineupPicker({
    items: activeConstructors,
    lineup: currentConstructors,
    lineupSize,
    itemType: 'constructor',
    addToTeam: addConstructorToTeam,
    removeFromTeam: removeConstructorFromTeam,
  });

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 relative">
        {displayLineup.map((constructor, idx) => (
          <ConstructorCard
            key={idx}
            constructor={constructor}
            onOpenPicker={() => openPicker(idx)}
            onRemove={() => handleRemove(idx)}
          />
        ))}

        {isPending && (
          <div className="bg-background/50 absolute inset-0 flex items-center justify-center">
            <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
          </div>
        )}
      </div>

      <Sheet
        open={selectedPosition !== null && !isPending}
        onOpenChange={(open) => !open && closePicker()}
      >
        <SheetTrigger asChild>
          <div />
        </SheetTrigger>
        <SheetContent className="flex h-full w-80 flex-col">
          <SheetHeader>
            <SheetTitle>Select Constructor</SheetTitle>
            <SheetDescription>
              Choose a constructor from the list below to add to your team.
            </SheetDescription>
            {error && <InlineError message={error} />}
          </SheetHeader>
          <ScrollArea className="h-full min-h-0 flex-1 pr-4 pl-4">
            <ul className="space-y-2">
              {pool.map((constructor) => (
                <ConstructorListItem
                  key={constructor.id}
                  constructor={constructor}
                  onSelect={() => {
                    if (selectedPosition !== null) {
                      handleAdd(selectedPosition, constructor);
                    }
                  }}
                />
              ))}
            </ul>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
```

---

## Step 7. Move data fetching to team route loader

**Modify:** `web/src/router.tsx`

- Add `getActiveDrivers()` and `getActiveConstructors()` to the team route loader
- Return alongside existing team data
- Fetch in parallel with team data using `Promise.all`

```ts
// Add to imports
import { getActiveDrivers } from '@/services/driverService';
import { getActiveConstructors } from '@/services/constructorService';
import type { Driver, Constructor } from '@/contracts/Role';

// Update loader return type and body
loader: async ({ params }): Promise<{
  team: TeamType;
  activeDrivers: Driver[];
  activeConstructors: Constructor[];
}> => {
  const TEAM_ROUTE_ID = '/_authenticated/_team-required/team/$teamId';

  const validationResult = teamIdParamsSchema.safeParse(params);
  if (!validationResult.success) {
    throw notFound({ routeId: TEAM_ROUTE_ID });
  }

  const { teamId } = validationResult.data;

  // Fetch all data in parallel
  const [team, activeDrivers, activeConstructors] = await Promise.all([
    getTeamById(teamId),
    getActiveDrivers(),
    getActiveConstructors(),
  ]);

  if (!team) {
    throw notFound({ routeId: TEAM_ROUTE_ID });
  }

  return { team, activeDrivers, activeConstructors };
},
```

---

## Step 8. Update `Team.tsx`

**Modify:** `web/src/components/Team/Team.tsx`

- Destructure `activeDrivers` and `activeConstructors` from `useLoaderData()`
- Pass to `DriverPicker` and `ConstructorPicker` as props

```tsx
// Update useLoaderData destructuring
const { team, activeDrivers, activeConstructors } = useLoaderData({
  from: '/_authenticated/_team-required/team/$teamId',
}) as { team: TeamType; activeDrivers: Driver[]; activeConstructors: Constructor[] };

// Update picker usage
<DriverPicker
  lineupSize={5}
  currentDrivers={driverSlots}
  activeDrivers={activeDrivers}
/>

<ConstructorPicker
  lineupSize={2}
  currentConstructors={constructorSlots}
  activeConstructors={activeConstructors}
/>
```

---

## Step 9. Delete obsolete files

- `web/src/components/LineupPicker/` — replaced by hook + self-contained pickers
- `web/src/components/RoleCard/` — inlined into DriverCard/ConstructorCard
- `web/src/components/AddRoleCardContent/` — inlined into DriverCard/ConstructorCard
- `web/src/components/InfoRoleCardContent/` — inlined into DriverCard/ConstructorCard

---

## Step 10. Update tests

- Update/rewrite tests for `DriverPicker`, `ConstructorPicker` (new props: `activeDrivers`/`activeConstructors`, no more data fetching mocks)
- Add tests for `useLineupPicker` hook
- Update `DriverCard`, `ConstructorCard` tests (no longer delegate to RoleCard)
- Update `Team` component tests if they reference changed loader data
- Remove tests for deleted components (`LineupPicker`, `RoleCard`, `AddRoleCardContent`, `InfoRoleCardContent`)

---

## Files Summary

| Action | File |
|--------|------|
| Create | `web/src/hooks/useLineupPicker.ts` |
| Modify | `web/src/contracts/Role.ts` (remove `BaseRole`, inline fields) |
| Modify | `web/src/components/DriverPicker/DriverPicker.tsx` |
| Modify | `web/src/components/ConstructorPicker/ConstructorPicker.tsx` |
| Modify | `web/src/components/DriverCard/DriverCard.tsx` |
| Modify | `web/src/components/ConstructorCard/ConstructorCard.tsx` |
| Modify | `web/src/components/Team/Team.tsx` |
| Modify | `web/src/router.tsx` (team route loader) |
| Delete | `web/src/components/LineupPicker/` |
| Delete | `web/src/components/RoleCard/` |
| Delete | `web/src/components/AddRoleCardContent/` |
| Delete | `web/src/components/InfoRoleCardContent/` |
| Update | All related test files |

## Architecture Before vs After

**Before (10 picker-related files, 3 abstraction layers):**
```
LineupPicker<T> (generic, 11 props, inner/outer split)
├── DriverPicker (adapter + config)
│   ├── DriverCardAdapter → DriverCard → RoleCard → AddRoleCardContent/InfoRoleCardContent
│   └── DriverListItemAdapter → DriverListItem
└── ConstructorPicker (adapter + config)
    ├── ConstructorCardAdapter → ConstructorCard → RoleCard → AddRoleCardContent/InfoRoleCardContent
    └── ConstructorListItemAdapter → ConstructorListItem
```

**After (5 picker-related files, 1 shared abstraction):**
```
useLineupPicker (hook — shared state logic only)
├── DriverPicker (self-contained JSX + hook)
│   ├── DriverCard (self-contained empty/filled rendering)
│   └── DriverListItem (unchanged)
└── ConstructorPicker (self-contained JSX + hook)
    ├── ConstructorCard (self-contained empty/filled rendering)
    └── ConstructorListItem (unchanged)
```

## Verification

1. `npm run web:build` — no type errors
2. `npm run web:test` — all tests pass
3. `npm run web:lint` — no lint errors
4. Manual: open team page, verify add/remove drivers and constructors works
5. Manual: verify sheet opens/closes correctly, pending state shows spinner
