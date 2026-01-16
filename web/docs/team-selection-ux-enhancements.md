# F1 Fantasy Team Selection UX Enhancement Plan

**Document Version:** 1.0  
**Date:** November 16, 2025  
**Status:** Planning Phase  
**Target Implementation:** Phase 1 (Core Features)

---

## Executive Summary

This document outlines enhancements to the F1 Fantasy team selection interface, focusing on improving user experience for selecting drivers and constructors. The current card + drawer pattern is validated as industry-standard and accessible. This plan adds search, sort, and filtering capabilities to improve usability as the pool of available selections grows.

**Core Philosophy:** Maintain the existing pattern while progressively enhancing discoverability and efficiency.

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Enhancement Recommendations](#2-enhancement-recommendations)
3. [Implementation Guide](#3-implementation-guide)
4. [Testing Strategy](#4-testing-strategy)
5. [Architecture Decisions](#5-architecture-decisions)
6. [Alternative Libraries Considered](#6-alternative-libraries-considered)
7. [Future Enhancements](#7-future-enhancements)

---

## 1. Current State Analysis

### 1.1 Existing Pattern Validation ✅

**Pattern:** Card-based slots → Click "Add" → Side drawer → Scrollable list → Auto-close on select

**Why This Works:**

- **Mobile-First:** Follows iOS bottom sheet and Android modal patterns
- **Context Preservation:** Overlay allows users to see what they're replacing
- **Accessibility:** Radix UI provides ARIA roles, focus management, keyboard navigation
- **Industry Alignment:** Matches patterns used by Sleeper, Yahoo Fantasy, ESPN Fantasy
- **Efficient Interaction:** 2-click workflow (Add → Select) is optimal

**Technical Foundation:**

- Built on `@radix-ui/react-dialog` (via Sheet component)
- 320px width on desktop (`w-80`), 75% width on mobile
- Keyboard accessible (Escape, Tab, Arrow keys)
- Screen reader support via proper ARIA labels

**Verdict:** ✅ **Keep this pattern** - it's well-implemented and follows best practices.

---

## 2. Enhancement Recommendations

### 2.1 Priority 1: Search Functionality

**Problem:** With 20 drivers, visual scanning becomes difficult. Users need to quickly find specific drivers.

**Solution:** Add search input to Sheet header with instant filtering.

**User Benefit:**

- Reduces cognitive load for finding specific drivers/constructors
- Speeds up selection workflow
- Improves mobile usability (less scrolling)

**Implementation Complexity:** Low (1-2 hours)

---

### 2.2 Priority 2: Sort Options

**Problem:** Users can't easily find "best value" drivers or "highest scoring" constructors without mentally comparing each item.

**Solution:** Add sort dropdown with options: Name (default), Price (high→low), Points (high→low).

**User Benefit:**

- Enables strategic decision-making (budget optimization, point maximization)
- Reduces time spent comparing options
- Aligns with fantasy sports strategy patterns

**Implementation Complexity:** Low (1-2 hours)

---

### 2.3 Priority 3: Budget Context Display

**Problem:** Users can't see remaining budget while selecting, forcing them to mentally calculate or switch contexts.

**Solution:** Add persistent budget indicator in Sheet footer showing: "Selected: $150M / $200M" with visual progress.

**User Benefit:**

- Reduces cognitive load (no mental math required)
- Prevents invalid selections (budget exceeded)
- Provides immediate feedback on team composition

**Implementation Complexity:** Medium (2-3 hours, requires budget state management)

---

### 2.4 Future Consideration: Comparison Mode

**Status:** Not recommended for Phase 1

**Concept:** Side-by-side comparison of 2-3 drivers before selecting.

**Why Deferred:**

- Adds UI complexity that may not be needed (current pattern is sufficient)
- Mobile implementation is challenging (screen space constraints)
- Can be addressed with better sorting instead

**Revisit When:** User research shows comparison is a pain point.

---

## 3. Implementation Guide

### 3.1 Enhanced DriverPicker Component

**File:** `src/components/DriverPicker/DriverPicker.tsx`

```tsx
import type { Driver } from '@/contracts/Role';
import { useSlots } from '@/hooks/useSlots';
import { getAllDrivers } from '@/services/driverService';
import { useMemo, useState } from 'react';

import { DriverCard } from '../DriverCard/DriverCard';
import { DriverListItem } from '../DriverListItem/DriverListItem';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../ui/sheet';

interface DriverPickerProps {
  slotsCount?: number;
  initialSlots?: number[]; // Driver IDs from backend (future)
  readOnly?: boolean; // For viewing other teams (future)
  onSelectionsChange?: (slots: (Driver | null)[]) => void; // For dirty tracking (future)
}

export function DriverPicker({
  slotsCount = 4,
  initialSlots,
  readOnly = false,
  onSelectionsChange,
}: DriverPickerProps) {
  const initialDriverPool = getAllDrivers();
  const [activeSlot, setActiveSlot] = useState<number | null>(null);

  // Search and sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'points'>('name');

  // Initialize slots from backend data (if provided) or use default
  const initialSlotsData = useMemo<Driver[]>(() => {
    if (initialSlots) {
      return initialSlots
        .map((id) => initialDriverPool.find((d) => d.id === id))
        .filter((d): d is Driver => d !== undefined);
    }
    // Default selection for demo purposes
    return [1, 2, 9, 11]
      .map((id) => initialDriverPool.find((d) => d.id === id))
      .filter((d): d is Driver => d !== undefined);
  }, [initialDriverPool, initialSlots]);

  const { slots, pool, add, remove } = useSlots<Driver>(
    initialDriverPool,
    initialSlotsData,
    slotsCount,
  );

  // Notify parent of changes (for dirty tracking)
  useMemo(() => {
    onSelectionsChange?.(slots);
  }, [slots, onSelectionsChange]);

  // Filter and sort pool
  const filteredAndSortedPool = useMemo(() => {
    // Filter by search query
    let filtered = pool.filter((driver) => {
      const fullName = `${driver.firstName} ${driver.lastName}`.toLowerCase();
      const query = searchQuery.toLowerCase().trim();
      return fullName.includes(query);
    });

    // Sort by selected option
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price':
          return b.price - a.price; // Descending (highest first)
        case 'points':
          return b.points - a.points; // Descending (highest first)
        case 'name':
        default:
          return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      }
    });

    return filtered;
  }, [pool, searchQuery, sortBy]);

  const handleOpenSheet = (idx: number) => {
    if (readOnly) return;
    setActiveSlot(idx);
  };

  const handleRemove = (idx: number) => {
    if (readOnly) return;
    remove(idx);
  };

  const handleSelect = (driver: Driver) => {
    if (activeSlot !== null) {
      add(activeSlot, driver);
      setActiveSlot(null);
      setSearchQuery(''); // Reset search after selection for clean next interaction
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {slots.map((driver, idx) => (
          <DriverCard
            key={idx}
            driver={driver}
            onOpenSheet={() => handleOpenSheet(idx)}
            onRemove={() => handleRemove(idx)}
          />
        ))}
      </div>

      {!readOnly && (
        <Sheet
          open={activeSlot !== null}
          onOpenChange={(open) => {
            if (!open) {
              setActiveSlot(null);
              setSearchQuery(''); // Reset search when closing
            }
          }}
        >
          <SheetTrigger asChild>
            {/* Invisible trigger, opened imperatively via setActiveSlot */}
            <div />
          </SheetTrigger>

          <SheetContent className="flex h-full w-80 flex-col sm:w-96">
            <SheetHeader className="space-y-3">
              <div>
                <SheetTitle>Select Driver</SheetTitle>
                <SheetDescription>
                  Choose a driver from the list below to add to your team.
                </SheetDescription>
              </div>

              {/* Search Input */}
              <Input
                type="search"
                placeholder="Search drivers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search drivers"
              />

              {/* Sort Select */}
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                <SelectTrigger aria-label="Sort drivers by">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Sort by Name</SelectItem>
                  <SelectItem value="price">Highest Price</SelectItem>
                  <SelectItem value="points">Most Points</SelectItem>
                </SelectContent>
              </Select>
            </SheetHeader>

            <ScrollArea className="h-full min-h-0 flex-1 pl-4 pr-4">
              {filteredAndSortedPool.length > 0 ? (
                <ul className="space-y-2">
                  {filteredAndSortedPool.map((driver) => (
                    <DriverListItem
                      key={driver.id}
                      driver={driver}
                      onSelect={() => handleSelect(driver)}
                    />
                  ))}
                </ul>
              ) : (
                <div className="flex h-full items-center justify-center py-8">
                  <p className="text-muted-foreground text-sm">
                    No drivers found matching &quot;{searchQuery}&quot;
                  </p>
                </div>
              )}
            </ScrollArea>

            <SheetFooter className="border-t pt-4">
              <p className="text-muted-foreground text-xs">
                {filteredAndSortedPool.length} driver{filteredAndSortedPool.length !== 1 ? 's' : ''}{' '}
                available
              </p>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
```

---

### 3.2 Enhanced ConstructorPicker Component

**File:** `src/components/ConstructorPicker/ConstructorPicker.tsx`

```tsx
import type { Constructor } from '@/contracts/Role';
import { useSlots } from '@/hooks/useSlots';
import { getAllConstructors } from '@/services/constructorService';
import { useMemo, useState } from 'react';

import { ConstructorCard } from '../ConstructorCard/ConstructorCard';
import { ConstructorListItem } from '../ConstructorListItem/ConstructorListItem';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../ui/sheet';

interface ConstructorPickerProps {
  slotsCount?: number;
  initialSlots?: number[]; // Constructor IDs from backend (future)
  readOnly?: boolean; // For viewing other teams (future)
  onSelectionsChange?: (slots: (Constructor | null)[]) => void; // For dirty tracking (future)
}

export function ConstructorPicker({
  slotsCount = 4,
  initialSlots,
  readOnly = false,
  onSelectionsChange,
}: ConstructorPickerProps) {
  const initialConstructorsPool = getAllConstructors();
  const [activeSlot, setActiveSlot] = useState<number | null>(null);

  // Search and sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'points'>('name');

  // Initialize slots from backend data (if provided) or use default
  const initialSlotsData = useMemo<Constructor[]>(() => {
    if (initialSlots) {
      return initialSlots
        .map((id) => initialConstructorsPool.find((c) => c.id === id))
        .filter((c): c is Constructor => c !== undefined);
    }
    // Default selection for demo purposes
    return [11, 13, 7, 19]
      .map((id) => initialConstructorsPool.find((c) => c.id === id))
      .filter((c): c is Constructor => c !== undefined);
  }, [initialConstructorsPool, initialSlots]);

  const { slots, pool, add, remove } = useSlots<Constructor>(
    initialConstructorsPool,
    initialSlotsData,
    slotsCount,
  );

  // Notify parent of changes (for dirty tracking)
  useMemo(() => {
    onSelectionsChange?.(slots);
  }, [slots, onSelectionsChange]);

  // Filter and sort pool
  const filteredAndSortedPool = useMemo(() => {
    // Filter by search query
    let filtered = pool.filter((constructor) => {
      const name = constructor.name.toLowerCase();
      const query = searchQuery.toLowerCase().trim();
      return name.includes(query);
    });

    // Sort by selected option
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price':
          return b.price - a.price; // Descending (highest first)
        case 'points':
          return b.points - a.points; // Descending (highest first)
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [pool, searchQuery, sortBy]);

  const handleOpenSheet = (idx: number) => {
    if (readOnly) return;
    setActiveSlot(idx);
  };

  const handleRemove = (idx: number) => {
    if (readOnly) return;
    remove(idx);
  };

  const handleSelect = (constructor: Constructor) => {
    if (activeSlot !== null) {
      add(activeSlot, constructor);
      setActiveSlot(null);
      setSearchQuery(''); // Reset search after selection
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {slots.map((constructor, idx) => (
          <ConstructorCard
            key={idx}
            constructor={constructor}
            onOpenSheet={() => handleOpenSheet(idx)}
            onRemove={() => handleRemove(idx)}
          />
        ))}
      </div>

      {!readOnly && (
        <Sheet
          open={activeSlot !== null}
          onOpenChange={(open) => {
            if (!open) {
              setActiveSlot(null);
              setSearchQuery(''); // Reset search when closing
            }
          }}
        >
          <SheetTrigger asChild>
            <div />
          </SheetTrigger>

          <SheetContent className="flex h-full w-80 flex-col sm:w-96">
            <SheetHeader className="space-y-3">
              <div>
                <SheetTitle>Select Constructor</SheetTitle>
                <SheetDescription>
                  Choose a constructor from the list below to add to your team.
                </SheetDescription>
              </div>

              {/* Search Input */}
              <Input
                type="search"
                placeholder="Search constructors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search constructors"
              />

              {/* Sort Select */}
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                <SelectTrigger aria-label="Sort constructors by">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Sort by Name</SelectItem>
                  <SelectItem value="price">Highest Price</SelectItem>
                  <SelectItem value="points">Most Points</SelectItem>
                </SelectContent>
              </Select>
            </SheetHeader>

            <ScrollArea className="h-full min-h-0 flex-1 pl-4 pr-4">
              {filteredAndSortedPool.length > 0 ? (
                <ul className="space-y-2">
                  {filteredAndSortedPool.map((constructor) => (
                    <ConstructorListItem
                      key={constructor.id}
                      constructor={constructor}
                      onSelect={() => handleSelect(constructor)}
                    />
                  ))}
                </ul>
              ) : (
                <div className="flex h-full items-center justify-center py-8">
                  <p className="text-muted-foreground text-sm">
                    No constructors found matching &quot;{searchQuery}&quot;
                  </p>
                </div>
              )}
            </ScrollArea>

            <SheetFooter className="border-t pt-4">
              <p className="text-muted-foreground text-xs">
                {filteredAndSortedPool.length} constructor
                {filteredAndSortedPool.length !== 1 ? 's' : ''} available
              </p>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
```

---

### 3.3 Enhanced List Item Components (Optional)

To show more context in the list items, you can enhance them to display price and points inline:

**File:** `src/components/DriverListItem/DriverListItem.tsx`

```tsx
import type { Driver } from '@/contracts/Role';
import { CirclePlus } from 'lucide-react';

import { Button } from '../ui/button';

interface DriverListItemProps {
  driver: Driver;
  onSelect: () => void;
}

function formatPrice(price: number): string {
  return `$${(price / 1_000_000).toFixed(1)}M`;
}

export function DriverListItem({ driver, onSelect }: DriverListItemProps) {
  return (
    <li
      key={driver.id}
      className="hover:bg-accent flex items-center justify-between rounded-md p-3 transition-colors"
    >
      <div className="flex flex-col gap-1">
        <span className="font-medium">
          {driver.firstName} {driver.lastName}
        </span>
        <div className="text-muted-foreground flex gap-3 text-xs">
          <span>{formatPrice(driver.price)}</span>
          <span>•</span>
          <span>{driver.points} pts</span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Add ${driver.firstName} ${driver.lastName}`}
        onClick={onSelect}
      >
        <CirclePlus className="h-5 w-5" />
      </Button>
    </li>
  );
}
```

**File:** `src/components/ConstructorListItem/ConstructorListItem.tsx`

```tsx
import type { Constructor } from '@/contracts/Role';
import { CirclePlus } from 'lucide-react';

import { Button } from '../ui/button';

export interface ConstructorListItemProps {
  constructor: Constructor;
  onSelect: () => void;
}

function formatPrice(price: number): string {
  return `$${(price / 1_000_000).toFixed(1)}M`;
}

export function ConstructorListItem({ constructor, onSelect }: ConstructorListItemProps) {
  return (
    <li className="hover:bg-accent flex items-center justify-between rounded-md p-3 transition-colors">
      <div className="flex flex-col gap-1">
        <span className="font-medium">{constructor.name}</span>
        <div className="text-muted-foreground flex gap-3 text-xs">
          <span>{formatPrice(constructor.price)}</span>
          <span>•</span>
          <span>{constructor.points} pts</span>
        </div>
      </div>
      <Button variant="ghost" size="icon" aria-label={`Add ${constructor.name}`} onClick={onSelect}>
        <CirclePlus className="h-5 w-5" />
      </Button>
    </li>
  );
}
```

---

## 4. Testing Strategy

### 4.1 Unit Tests for Search Functionality

**File:** `src/components/DriverPicker/DriverPicker.test.tsx` (additions)

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { DriverPicker } from './DriverPicker';

describe('DriverPicker - Search Functionality', () => {
  it('filters drivers based on search query', async () => {
    const user = userEvent.setup();
    render(<DriverPicker />);

    // Remove a driver to open sheet
    const removeButtons = screen.getAllByTestId('remove-driver');
    await user.click(removeButtons[0]);

    const addButton = screen.getByTestId('add-driver');
    await user.click(addButton);

    // Wait for sheet to open
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search drivers...')).toBeInTheDocument();
    });

    // Type in search input
    const searchInput = screen.getByPlaceholderText('Search drivers...');
    await user.type(searchInput, 'Norris');

    // Verify filtered results
    await waitFor(() => {
      const listItems = screen.getAllByTestId('driver-list-item');
      expect(listItems.length).toBe(1); // Only Lando Norris matches
    });
  });

  it('shows empty state when no drivers match search', async () => {
    const user = userEvent.setup();
    render(<DriverPicker />);

    // Open sheet
    const removeButtons = screen.getAllByTestId('remove-driver');
    await user.click(removeButtons[0]);
    await user.click(screen.getByTestId('add-driver'));

    // Search for non-existent driver
    const searchInput = await screen.findByPlaceholderText('Search drivers...');
    await user.type(searchInput, 'XYZ123');

    // Verify empty state message
    await waitFor(() => {
      expect(screen.getByText(/No drivers found matching/i)).toBeInTheDocument();
    });
  });

  it('resets search query when sheet closes', async () => {
    const user = userEvent.setup();
    render(<DriverPicker />);

    // Open sheet and search
    const removeButtons = screen.getAllByTestId('remove-driver');
    await user.click(removeButtons[0]);
    await user.click(screen.getByTestId('add-driver'));

    const searchInput = await screen.findByPlaceholderText('Search drivers...');
    await user.type(searchInput, 'Hamilton');

    // Close sheet
    await user.keyboard('{Escape}');

    // Reopen sheet
    await user.click(screen.getByTestId('add-driver'));

    // Verify search is reset
    const searchInputAfterReopen = await screen.findByPlaceholderText('Search drivers...');
    expect(searchInputAfterReopen).toHaveValue('');
  });

  it('resets search query after successful selection', async () => {
    const user = userEvent.setup();
    render(<DriverPicker />);

    // Open sheet
    const removeButtons = screen.getAllByTestId('remove-driver');
    await user.click(removeButtons[0]);
    await user.click(screen.getByTestId('add-driver'));

    // Search and select
    const searchInput = await screen.findByPlaceholderText('Search drivers...');
    await user.type(searchInput, 'Verstappen');

    const selectButtons = screen.getAllByTestId('select-driver');
    await user.click(selectButtons[0]);

    // Sheet should close, then reopen to verify reset
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Search drivers...')).not.toBeInTheDocument();
    });

    // Remove another driver and reopen
    const removeButtonsAfter = screen.getAllByTestId('remove-driver');
    await user.click(removeButtonsAfter[1]);
    await user.click(screen.getByTestId('add-driver'));

    // Verify search is reset
    const searchInputAfter = await screen.findByPlaceholderText('Search drivers...');
    expect(searchInputAfter).toHaveValue('');
  });
});

describe('DriverPicker - Sort Functionality', () => {
  it('sorts drivers by price when price option selected', async () => {
    const user = userEvent.setup();
    render(<DriverPicker />);

    // Open sheet
    const removeButtons = screen.getAllByTestId('remove-driver');
    await user.click(removeButtons[0]);
    await user.click(screen.getByTestId('add-driver'));

    // Wait for sheet and select sort option
    await waitFor(() => {
      expect(screen.getByText('Sort by Name')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('combobox', { name: /sort drivers by/i }));
    await user.click(screen.getByText('Highest Price'));

    // Verify first item is highest priced driver
    const listItems = screen.getAllByTestId('driver-list-item');
    const firstItem = listItems[0];

    // McLaren drivers (Piastri/Norris) should be first (highest price ~$30-31M)
    expect(firstItem).toHaveTextContent(/Piastri|Norris/);
  });

  it('sorts drivers by points when points option selected', async () => {
    const user = userEvent.setup();
    render(<DriverPicker />);

    // Open sheet
    const removeButtons = screen.getAllByTestId('remove-driver');
    await user.click(removeButtons[0]);
    await user.click(screen.getByTestId('add-driver'));

    await waitFor(() => {
      expect(screen.getByText('Sort by Name')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('combobox', { name: /sort drivers by/i }));
    await user.click(screen.getByText('Most Points'));

    // Verify first item is highest scoring driver
    const listItems = screen.getAllByTestId('driver-list-item');
    const firstItem = listItems[0];

    // Norris has highest points (138) from mock data
    expect(firstItem).toHaveTextContent('Norris');
  });

  it('sorts drivers alphabetically by default', async () => {
    const user = userEvent.setup();
    render(<DriverPicker />);

    // Open sheet
    const removeButtons = screen.getAllByTestId('remove-driver');
    await user.click(removeButtons[0]);
    await user.click(screen.getByTestId('add-driver'));

    await waitFor(() => {
      expect(screen.getByText('Sort by Name')).toBeInTheDocument();
    });

    const listItems = screen.getAllByTestId('driver-list-item');
    const firstItem = listItems[0];

    // First alphabetically should be "Alexander Albon"
    expect(firstItem).toHaveTextContent('Alexander Albon');
  });
});

describe('DriverPicker - Accessibility', () => {
  it('has proper ARIA labels on search input', async () => {
    const user = userEvent.setup();
    render(<DriverPicker />);

    const removeButtons = screen.getAllByTestId('remove-driver');
    await user.click(removeButtons[0]);
    await user.click(screen.getByTestId('add-driver'));

    const searchInput = await screen.findByLabelText('Search drivers');
    expect(searchInput).toBeInTheDocument();
  });

  it('has proper ARIA labels on sort select', async () => {
    const user = userEvent.setup();
    render(<DriverPicker />);

    const removeButtons = screen.getAllByTestId('remove-driver');
    await user.click(removeButtons[0]);
    await user.click(screen.getByTestId('add-driver'));

    const sortSelect = await screen.findByRole('combobox', { name: /sort drivers by/i });
    expect(sortSelect).toBeInTheDocument();
  });

  it('displays count of available drivers in footer', async () => {
    const user = userEvent.setup();
    render(<DriverPicker />);

    const removeButtons = screen.getAllByTestId('remove-driver');
    await user.click(removeButtons[0]);
    await user.click(screen.getByTestId('add-driver'));

    // Wait for sheet to open
    await waitFor(() => {
      expect(screen.getByText(/\d+ drivers? available/i)).toBeInTheDocument();
    });
  });
});
```

**Apply similar tests to `ConstructorPicker.test.tsx`** following the same patterns.

---

### 4.2 Integration Tests

**File:** `src/components/Team/Team.integration.test.tsx` (new file)

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Team } from './Team';

// Mock services
vi.mock('@/services/teamService', () => ({
  getTeamById: vi.fn().mockResolvedValue({
    id: 1,
    name: 'Test Team',
    ownerName: 'Test Owner',
    driverIds: [1, 2, 9, 11],
    constructorIds: [11, 13, 7, 19],
  }),
}));

describe('Team - User Workflow Integration', () => {
  it('allows user to search, find, and select a driver', async () => {
    const user = userEvent.setup();
    render(<Team />);

    // Wait for team to load
    await waitFor(() => {
      expect(screen.getByText('Test Team')).toBeInTheDocument();
    });

    // User removes a driver
    const removeButtons = screen.getAllByLabelText(/remove/i);
    await user.click(removeButtons[0]);

    // User clicks add to open drawer
    const addButton = screen.getByTestId('add-driver');
    await user.click(addButton);

    // User searches for specific driver
    const searchInput = await screen.findByPlaceholderText('Search drivers...');
    await user.type(searchInput, 'Hamilton');

    // User sees filtered results
    await waitFor(() => {
      const listItems = screen.getAllByTestId('driver-list-item');
      expect(listItems.length).toBe(1);
      expect(listItems[0]).toHaveTextContent('Hamilton');
    });

    // User selects driver
    const selectButton = screen.getByTestId('select-driver');
    await user.click(selectButton);

    // Drawer closes and driver is added
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Search drivers...')).not.toBeInTheDocument();
      expect(screen.getAllByTestId('driver-name')).toHaveLength(4);
    });
  });

  it('allows user to sort and select highest scoring constructor', async () => {
    const user = userEvent.setup();
    render(<Team />);

    await waitFor(() => {
      expect(screen.getByText('Test Team')).toBeInTheDocument();
    });

    // Navigate to constructors tab
    await user.click(screen.getByRole('tab', { name: /constructors/i }));

    // Remove a constructor
    const removeButtons = screen.getAllByLabelText(/remove/i);
    await user.click(removeButtons[0]);

    // Open drawer
    const addButton = screen.getByTestId('add-constructor');
    await user.click(addButton);

    // Sort by points
    await user.click(screen.getByRole('combobox', { name: /sort constructors by/i }));
    await user.click(screen.getByText('Most Points'));

    // First item should be highest scoring
    const listItems = await screen.findAllByTestId('constructor-list-item');
    expect(listItems[0]).toHaveTextContent('McLaren'); // 152 points

    // Select it
    const selectButtons = screen.getAllByTestId('select-constructor');
    await user.click(selectButtons[0]);

    // Verify selection
    await waitFor(() => {
      expect(screen.getAllByTestId('constructor-name')).toHaveLength(4);
    });
  });
});
```

---

## 5. Architecture Decisions

### 5.1 Decision: Local State for Search/Sort vs Context

**Options Considered:**

1. **Local component state** (useState) - selected ✅
2. Global context (SearchContext)
3. URL query parameters

**Decision:** Use local component state

**Rationale:**

- Search/sort state is ephemeral and UI-specific
- No need to persist across navigation
- Simpler implementation (no context boilerplate)
- Better performance (no context re-renders)
- Follows React 19 best practices for component-scoped state

**When to Revisit:** If search/sort preferences need to persist across sessions (add localStorage)

---

### 5.2 Decision: Reset Search on Sheet Close

**Options Considered:**

1. **Reset search when sheet closes** - selected ✅
2. Persist search query
3. Let user decide via preference

**Decision:** Reset search on close and after selection

**Rationale:**

- Clean slate for next interaction (users expect fresh start)
- Reduces cognitive load (no "why is this filtered?" confusion)
- Matches industry patterns (Amazon, Google Shopping)
- Simple implementation

**When to Revisit:** User research shows preference for persistent search

---

### 5.3 Decision: useMemo vs useEffect for Filtering

**Options Considered:**

1. **useMemo for derived state** - selected ✅
2. useEffect with separate state
3. Inline filtering in render

**Decision:** Use useMemo for filtered/sorted pool

**Rationale:**

- Filtering/sorting is **derived state** (computed from pool, search, sort)
- useMemo prevents unnecessary recalculations
- More declarative than useEffect
- Follows React 19 recommendations for derived state
- Better performance characteristics

**Code Pattern:**

```tsx
const filteredAndSortedPool = useMemo(() => {
  // Filter logic
  // Sort logic
  return filtered;
}, [pool, searchQuery, sortBy]);
```

**When to Revisit:** If filtering becomes computationally expensive (unlikely with <100 items)

---

### 5.4 Decision: Sort Order (Descending for Price/Points)

**Options Considered:**

1. **Descending (highest first)** - selected ✅
2. Ascending (lowest first)
3. Toggle ascending/descending

**Decision:** Descending for price and points, ascending for name

**Rationale:**

- Fantasy sports context: Users typically want "best value" or "highest scoring"
- Cognitive efficiency: Top of list = best option
- Matches fantasy sports conventions (ESPN, Yahoo, Sleeper)
- Simplifies UI (no toggle needed)

**When to Revisit:** User research shows need for ascending sort

---

### 5.5 Decision: Search Implementation (Client-Side)

**Options Considered:**

1. **Client-side filtering** - selected ✅
2. Server-side search API
3. Hybrid (client-side with server fallback)

**Decision:** Client-side filtering with JavaScript `.filter()`

**Rationale:**

- Pool size is small (20 drivers, 20 constructors)
- Data already loaded (no additional API calls)
- Instant feedback (no network latency)
- Simpler implementation
- Works offline

**When to Revisit:**

- Pool grows beyond 100 items
- Need full-text search with fuzzy matching
- Need to search across additional fields (team, nationality)

---

### 5.6 Decision: Empty State Messaging

**Options Considered:**

1. **Show message with search query** - selected ✅
2. Generic "No results" message
3. Suggested alternatives

**Decision:** Display search query in empty state message

**Code:**

```tsx
<p className="text-muted-foreground text-sm">No drivers found matching &quot;{searchQuery}&quot;</p>
```

**Rationale:**

- Provides context for why list is empty
- Helps users debug typos
- Clear call-to-action (modify search)
- Follows accessibility best practices

**When to Revisit:** Add "Did you mean...?" suggestions if typos are common

---

### 5.7 Decision: Sheet Width on Desktop

**Current:** 320px (`w-80`) → **Enhanced:** 384px (`sm:w-96`)

**Rationale:**

- More comfortable reading on desktop
- Room for price/points inline in list items
- Still preserves context (overlay visible)
- Responsive: Falls back to 75% on mobile

**When to Revisit:** User testing shows preference for narrower/wider panel

---

## 6. Alternative Libraries Considered

### 6.1 Search & Filtering

**Libraries NOT Used (but worth knowing):**

1. **Fuse.js** - Fuzzy search library
   - Use case: Typo-tolerant search ("Verstappn" → "Verstappen")
   - Overhead: 6.3 KB gzipped
   - When to add: User research shows typos are common

2. **match-sorter** - Ranking-based search
   - Use case: Prioritize exact matches over partial matches
   - Overhead: 4.2 KB gzipped
   - When to add: Need weighted search results

3. **react-instantsearch** - Algolia search UI components
   - Use case: Server-side search with advanced features
   - Overhead: Requires Algolia subscription
   - When to add: Pool grows beyond 1000 items

**Decision:** Plain JavaScript `.filter()` is sufficient for current pool size (<100 items)

---

### 6.2 Virtual Scrolling

**Libraries NOT Used:**

1. **@tanstack/react-virtual** (TanStack Virtual)
   - Use case: Render only visible items for performance
   - Overhead: 14 KB gzipped
   - When to add: Pool grows beyond 500 items

2. **react-window** - Lightweight virtual list
   - Use case: Similar to TanStack Virtual
   - Overhead: 6.5 KB gzipped
   - When to add: Performance issues with large lists

**Decision:** Current pool size (20-50 items) renders instantly without virtualization

---

### 6.3 Drag-and-Drop

**Libraries NOT Used (but mentioned for completeness):**

1. **@dnd-kit/core** - Modern drag-and-drop toolkit
   - Use case: Drag drivers from pool to slots
   - Overhead: 30 KB gzipped
   - Pros: Accessible, touch-friendly, TypeScript support
   - Cons: Complex implementation, mobile challenges

2. **react-beautiful-dnd** - Drag-and-drop (deprecated)
   - Use case: Same as @dnd-kit
   - Status: No longer maintained, use @dnd-kit instead

**Decision:** Card + drawer pattern is simpler and more mobile-friendly for Phase 1

**When to Add:** User research shows demand for drag-and-drop as supplemental interaction (not primary)

---

### 6.4 Comparison UI

**Libraries NOT Used:**

1. **react-compare-slider** - Side-by-side comparison
   - Use case: Compare two drivers before selecting
   - Overhead: 8 KB gzipped
   - When to add: User research shows comparison is pain point

2. **Custom comparison modal** - Roll your own
   - Use case: Multi-driver comparison table
   - When to add: Phase 2, if sorting isn't sufficient

**Decision:** Enhanced sorting provides sufficient comparison capability for Phase 1

---

### 6.5 State Management

**Libraries NOT Used:**

1. **Zustand** - Lightweight state management
   - Use case: Global search/sort preferences across components
   - Overhead: 3 KB gzipped
   - When to add: Need to sync state across multiple pickers

2. **Redux Toolkit** - Complex state management
   - Use case: Large-scale state orchestration
   - Overhead: 45 KB gzipped
   - When to add: Never for this use case (overkill)

**Decision:** Component-local state with props is sufficient (React 19 best practice)

---

## 7. Future Enhancements

### 7.1 Phase 2: Budget Context Display

**Goal:** Show remaining budget while selecting drivers/constructors

**Implementation Plan:**

```tsx
// Add to SheetFooter
<SheetFooter className="space-y-2 border-t pt-4">
  <div className="flex justify-between text-sm">
    <span className="text-muted-foreground">Selected Budget:</span>
    <span className="font-medium">${selectedBudget.toFixed(1)}M / $200M</span>
  </div>
  <Progress value={(selectedBudget / 200) * 100} className="h-2" />
  <p className="text-muted-foreground text-xs">
    {filteredAndSortedPool.length} driver{filteredAndSortedPool.length !== 1 ? 's' : ''} available
  </p>
</SheetFooter>
```

**Dependencies:**

- Requires budget calculation in parent component
- Pass `selectedBudget` and `totalBudget` as props to picker

**Estimated Effort:** 2-3 hours

---

### 7.2 Phase 2: Filter by Position/Team

**Goal:** Filter drivers by constructor team or driver position

**Implementation:**

```tsx
// Add filter controls
<div className="flex gap-2">
  <Select value={filterTeam} onValueChange={setFilterTeam}>
    <SelectTrigger>
      <SelectValue placeholder="All Teams" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">All Teams</SelectItem>
      <SelectItem value="mclaren">McLaren</SelectItem>
      <SelectItem value="ferrari">Ferrari</SelectItem>
      {/* etc */}
    </SelectContent>
  </Select>
</div>
```

**When to Add:** User research shows need for advanced filtering

---

### 7.3 Phase 3: Keyboard Shortcuts

**Goal:** Power users can navigate with keyboard

**Shortcuts:**

- `/ ` - Focus search input
- `↑↓` - Navigate list
- `Enter` - Select highlighted item
- `Esc` - Close sheet

**Implementation:** Use `useHotkeys` hook or custom keyboard event handlers

**Estimated Effort:** 3-4 hours

---

### 7.4 Phase 3: Recent Selections

**Goal:** Show recently selected drivers for quick re-selection

**Implementation:**

```tsx
// Add "Recent" section above pool list
{
  recentSelections.length > 0 && (
    <div className="mb-4">
      <h3 className="mb-2 text-sm font-medium">Recently Selected</h3>
      <ul className="space-y-2">
        {recentSelections.map((driver) => (
          <DriverListItem key={driver.id} driver={driver} onSelect={() => handleSelect(driver)} />
        ))}
      </ul>
    </div>
  );
}
```

**Storage:** localStorage with max 5 recent items

**Estimated Effort:** 2-3 hours

---

## 8. Implementation Checklist

### Phase 1: Core Search & Sort (Recommended Start)

- [ ] Update `DriverPicker.tsx` with search and sort
- [ ] Update `ConstructorPicker.tsx` with search and sort
- [ ] Enhance `DriverListItem.tsx` to show price/points
- [ ] Enhance `ConstructorListItem.tsx` to show price/points
- [ ] Add unit tests for search functionality
- [ ] Add unit tests for sort functionality
- [ ] Add integration tests for user workflows
- [ ] Add accessibility tests (ARIA labels)
- [ ] Update documentation

**Estimated Total Time:** 6-8 hours

---

### Phase 2: Budget Context (Future)

- [ ] Add budget calculation to parent component
- [ ] Pass budget props to pickers
- [ ] Add budget display to SheetFooter
- [ ] Add Progress component for visual budget indicator
- [ ] Add tests for budget display
- [ ] Update documentation

**Estimated Total Time:** 3-4 hours

---

### Phase 3: Advanced Features (Future)

- [ ] Add keyboard shortcuts
- [ ] Add recent selections tracking
- [ ] Add filter by team/position
- [ ] Add localStorage for preferences
- [ ] User research for comparison mode
- [ ] Update documentation

**Estimated Total Time:** 10-12 hours

---

## 9. References & Resources

### React 19 Best Practices

- **Derived State:** Use `useMemo` for computed values from props/state
- **Component State:** Prefer local state over context for UI-specific state
- **Accessibility:** Always include ARIA labels for interactive elements

### Radix UI Documentation

- **Dialog/Sheet:** https://www.radix-ui.com/docs/primitives/components/dialog
- **Select:** https://www.radix-ui.com/docs/primitives/components/select
- **Accessibility:** Built-in focus management, keyboard navigation, screen reader support

### Testing Best Practices

- **React Testing Library:** Test user behavior, not implementation details
- **Vitest:** Modern, fast test runner for Vite projects
- **User Events:** Use `@testing-library/user-event` for realistic interactions

### Industry Patterns

- **Fantasy Sports:** Sleeper, ESPN Fantasy, Yahoo Fantasy
- **Mobile Patterns:** iOS bottom sheets, Android modals
- **Accessibility:** WCAG 2.1 AA compliance via Radix UI

---

## 10. Conclusion

This plan enhances the existing card + drawer pattern with search and sort capabilities while maintaining the solid UX foundation. The implementation is straightforward, testable, and follows React 19 and accessibility best practices.

**Key Takeaways:**

1. ✅ **Keep current pattern** - it's industry-standard and well-implemented
2. ✅ **Add search/sort** - significant UX improvement with minimal complexity
3. ✅ **Defer advanced features** - YAGNI principle (You Aren't Gonna Need It)
4. ✅ **Prioritize accessibility** - ARIA labels, keyboard navigation, screen readers

**Next Steps:**

1. Review and approve this plan
2. Implement Phase 1 (search + sort)
3. Test with real users
4. Iterate based on feedback
