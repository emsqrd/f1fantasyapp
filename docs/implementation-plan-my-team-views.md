# Implementation Plan: My Team vs Other Team Views (MVP Step 5)

## Overview

Separate "My Team" (editable) from viewing other teams (read-only) to enable proper ownership-based editing controls. This plan implements a canonical URL structure and route-based read-only mode.

### Problem Summary

**Current State:**
- Single `/team/$teamId` route accessible by any authenticated user
- No distinction between viewing your own team vs others' teams
- All teams show the same interface with no edit controls
- Team API response missing `ownerId` field needed for ownership detection

**Desired Outcome:**
- `/my-team` route for easy access to user's own team (always editable)
- `/team/$teamId` for viewing other teams (always read-only)
- Redirects ensure canonical URLs (e.g., `/team/$myTeamId` → `/my-team`)
- Read-only mode disables all picker interactions

### Solution Summary

**Two Routes, One Component Pattern:**

```
Routes:
  /my-team          → Team component in EDIT mode
  /team/$teamId     → Team component in READ-ONLY mode
  /team/$myTeamId   → Redirects to /my-team

Component Behavior:
  - Single Team component supports both modes
  - Mode determined by route (not ownership check)
  - readOnly prop cascades through picker hierarchy
```

---

## Architecture Changes

### Route Structure

**Before:**
```
/_team-required (layout)
├── team/$teamId  (single route for viewing any team)
└── leaderboard   (links to /team/$id for all teams)
```

**After:**
```
/_team-required (layout)
├── my-team       (NEW - canonical URL for your team)
├── team/$teamId  (modified - other teams only, read-only)
└── leaderboard   (updated links)
```

**Routing Behavior:**

| URL                    | Condition              | Behavior                          |
|------------------------|------------------------|-----------------------------------|
| `/my-team`            | Always                | Load your team, edit mode        |
| `/team/$teamId`       | `teamId === myTeamId`  | Redirect to `/my-team`           |
| `/team/$teamId`       | `teamId !== myTeamId`  | Load team, read-only mode        |
| `/team/$teamId`       | Team not found        | Show error, link to `/my-team`   |

### Component Mode Strategy

**Single Team Component with Route-Based Mode:**

```typescript
// Team component determines mode from route, not ownership
const route = useRouterState({ select: (s) => s.location.pathname });
const readOnly = !route.startsWith('/my-team');

// Pass to child components
<DriverPicker lineup={driverSlots} readOnly={readOnly} />
<ConstructorPicker lineup={constructorSlots} readOnly={readOnly} />
```

**Why single component?**
- Eliminates code duplication
- Team display logic identical in both modes
- Only difference is interactivity (edit buttons, picker sheets)
- Route structure ensures correct mode automatically

### API Contract Changes

**Add `ownerId` to TeamDetailsResponse:**

Current:
```csharp
public class TeamDetailsResponse {
  public int Id { get; set; }
  public string Name { get; set; }
  public string OwnerName { get; set; }  // Name only
  // ... other fields
}
```

New:
```csharp
public class TeamDetailsResponse {
  public int Id { get; set; }
  public string Name { get; set; }
  public string OwnerName { get; set; }
  public int OwnerId { get; set; }  // NEW: User ID
  // ... other fields
}
```

**Why needed?**
- Frontend needs ownership check: `profile.id === team.ownerId`
- Matches existing League pattern (LeagueResponse has OwnerId)
- Backend already has `team.UserId` - just needs exposure

### Read-Only Mode Implementation

**Cascade `readOnly` prop through picker hierarchy:**

```
Team (determines readOnly from route)
  ├── DriverPicker (readOnly=true/false)
  │   └── LineupPicker (readOnly=true/false)
  │       └── LineupPickerContent (readOnly=true/false)
  │           └── DriverCard (readOnly=true/false)
  │               └── RoleCard (readOnly=true/false)
  │
  └── ConstructorPicker (readOnly=true/false)
      └── LineupPicker (readOnly=true/false)
          └── LineupPickerContent (readOnly=true/false)
              └── ConstructorCard (readOnly=true/false)
                  └── RoleCard (readOnly=true/false)
```

**When `readOnly=true`:**
- Empty slots: Click disabled, sheet doesn't open
- Filled slots: No remove (X) button shown
- Sheet: Never renders in DOM
- All callbacks return early

---

## Design Decisions

### Decision 1: Route Structure (Two Routes vs Single Dynamic)

**Option A: Two Routes (CHOSEN)**
- `/my-team` - Your team, always editable
- `/team/$teamId` - Any team, mode determined by ownership

**Option B: Single Dynamic Route**
- `/team/$teamId` - Auto-detect owner, show edit controls if owner
- Simpler route definition, but logic spread across component

**Why Option A?**
- ✅ Canonical URL per mode (clearer semantics)
- ✅ Single responsibility per route
- ✅ URL matches intended behavior ("My Team" URL = editable)
- ✅ Prevents accidental viewing of own team in "wrong" URL
- ✅ Easier to test and debug (route = intended mode)

### Decision 2: Mode Determination (Route vs Runtime Check)

**Option A: Route-Based (CHOSEN)**
```typescript
const readOnly = !route.startsWith('/my-team');
```

**Option B: Ownership-Based**
```typescript
const readOnly = team.ownerId !== profile?.id;
```

**Why Option A?**
- ✅ No runtime checks, no edge cases
- ✅ Route structure guarantees correct mode
- ✅ Simpler component logic
- ✅ Prevents security issues from logic errors
- ⚠️ Ownership validation still happens in route loader

### Decision 3: Single vs Dual Components

**Option A: Single Team Component (CHOSEN)**
- One component with `readOnly` prop
- Mode cascades through all children

**Option B: TeamEdit and TeamView Components**
- Separate components for edit and read-only
- Each component optimized for its use case

**Why Option A?**
- ✅ DRY principle (no duplicated display logic)
- ✅ Simpler maintenance
- ✅ Props clearly indicate difference
- ✅ Easier to keep both views in sync

---

## Implementation Steps

### Phase 1: Backend API Changes

#### 1.1 Add OwnerId to TeamDetailsResponse

**File:** `api/F1CompanionApi/Api/Models/TeamDetailsResponse.cs`

Add property to response model:
```csharp
public int OwnerId { get; set; }
```

#### 1.2 Update TeamResponseMapper

**File:** `api/F1CompanionApi/Api/Mappers/TeamResponseMapper.cs`

In `ToDetailsResponseModel()` method, map the field:
```csharp
OwnerId = team.UserId,
```

#### 1.3 Update Frontend Team Interface

**File:** `web/src/contracts/Team.ts`

Add `ownerId` property:
```typescript
export interface Team {
  id: number;
  name: string;
  ownerName: string;
  ownerId: number;  // NEW
  drivers: TeamDriver[];
  constructors: TeamConstructor[];
}
```

---

### Phase 2: Add Read-Only Mode to Components

#### 2.1 Update RoleCard Component

**File:** `web/src/components/RoleCard/RoleCard.tsx`

Add `readOnly` to both variants:
```typescript
export type RoleCardProps =
  | {
      variant: 'empty';
      role: string;
      onOpenSheet: () => void;
      readOnly?: boolean;  // NEW
    }
  | {
      variant: 'filled';
      name: string;
      onRemove: () => void;
      readOnly?: boolean;  // NEW
    };
```

Update component logic:
- Empty variant: Disable sheet opening when `readOnly`
- Filled variant: Hide remove button when `readOnly`
- Always render card, just disable interaction

#### 2.2 Update DriverCard and ConstructorCard

**Files:**
- `web/src/components/DriverCard/DriverCard.tsx`
- `web/src/components/ConstructorCard/ConstructorCard.tsx`

Add `readOnly` prop and pass to RoleCard:
```typescript
interface DriverCardProps {
  item: Driver | null;
  onClick: () => void;
  onRemove: () => void;
  readOnly?: boolean;  // NEW
}

export function DriverCard({ item, onClick, onRemove, readOnly }: DriverCardProps) {
  if (!item) {
    return <RoleCard variant="empty" role="Driver" onOpenSheet={onClick} readOnly={readOnly} />;
  }
  return <RoleCard variant="filled" name={item.name} onRemove={onRemove} readOnly={readOnly} />;
}
```

(Same pattern for ConstructorCard)

#### 2.3 Update LineupPicker Component

**File:** `web/src/components/LineupPicker/LineupPicker.tsx`

Add `readOnly` to both interface types:
```typescript
// LineupPickerProps (public interface)
export interface LineupPickerProps<T extends BaseRole> {
  // ... existing props ...
  readOnly?: boolean;  // NEW
}

// LineupPickerContentProps (internal interface)
interface LineupPickerContentProps<T extends BaseRole> {
  // ... existing props ...
  readOnly?: boolean;  // NEW
}
```

Update LineupPickerContent function:
- Only render Sheet if `!readOnly`
- Disable onClick/onRemove callbacks when `readOnly`
- Pass readOnly to CardComponent

#### 2.4 Update DriverPicker and ConstructorPicker

**Files:**
- `web/src/components/DriverPicker/DriverPicker.tsx`
- `web/src/components/ConstructorPicker/ConstructorPicker.tsx`

Add `readOnly` prop and pass through:
```typescript
interface DriverPickerProps {
  lineup?: (Driver | null)[];
  readOnly?: boolean;  // NEW
}

export function DriverPicker({ lineup, readOnly }: DriverPickerProps) {
  return (
    <LineupPicker
      // ... existing props ...
      readOnly={readOnly}  // Pass through
    />
  );
}
```

#### 2.5 Update Team Component

**File:** `web/src/components/Team/Team.tsx`

Determine mode from route:
```typescript
import { useRouterState } from '@tanstack/react-router';

export function Team() {
  const { team } = useLoaderData({ from: '/_authenticated/_team-required/team/$teamId' });

  // Determine read-only mode based on route (not ownership)
  const route = useRouterState({ select: (s) => s.location.pathname });
  const readOnly = !route.startsWith('/my-team');

  return (
    <div className="container mx-auto p-4">
      {/* ... existing header ... */}

      <Tabs defaultValue="drivers">
        <TabsList>
          <TabsTrigger value="drivers">Drivers</TabsTrigger>
          <TabsTrigger value="constructors">Constructors</TabsTrigger>
        </TabsList>

        <TabsContent value="drivers">
          <DriverPicker lineup={driverSlots} readOnly={readOnly} />
        </TabsContent>

        <TabsContent value="constructors">
          <ConstructorPicker lineup={constructorSlots} readOnly={readOnly} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

### Phase 3: Update Routes

#### 3.1 Create My Team Route

**File:** `web/src/router.tsx`

Add new route after existing `teamRoute`:
```typescript
const myTeamRoute = createRoute({
  getParentRoute: () => teamRequiredLayoutRoute,
  path: 'my-team',
  staticData: {
    pageTitle: 'My Team',
  },
  loader: async ({ context }) => {
    const team = await getMyTeam();

    if (!team) {
      throw redirect({ to: '/create-team' });
    }

    return { team };
  },
  component: Team,  // Reuse same component
  notFoundComponent: () => (
    <ErrorState
      title="Team Not Found"
      description="Your team could not be found."
      action={{ label: 'Create Team', to: '/create-team' }}
    />
  ),
});
```

#### 3.2 Update Team Route with Redirect

**File:** `web/src/router.tsx`

Update existing `teamRoute` loader:
```typescript
const teamRoute = createRoute({
  getParentRoute: () => teamRequiredLayoutRoute,
  path: 'team/$teamId',
  staticData: {
    pageTitle: 'Team',
  },
  validateSearch: z.object({}).optional(),
  loaderDeps: ({ search: _search }) => ({} as const),
  loader: async ({ params, context }) => {
    // Validate team ID
    const teamIdSchema = z.coerce.number().int().positive();
    const parsed = teamIdSchema.safeParse(params.teamId);

    if (!parsed.success) {
      throw notFound({ routeId: ROUTE_ID });
    }

    const teamId = parsed.data;

    // Redirect if viewing own team
    const { teamContext } = context;
    if (teamContext.myTeamId === teamId) {
      throw redirect({ to: '/my-team' });
    }

    // Fetch team
    const team = await getTeamById(teamId);

    if (!team) {
      throw notFound({ routeId: ROUTE_ID });
    }

    return { team };
  },
  staleTime: 10_000,
  gcTime: 5 * 60 * 1000,
  component: Team,  // Same component
  notFoundComponent: () => (
    <ErrorState
      title="Team Not Found"
      description="The team you're looking for doesn't exist."
      action={{ label: 'Browse Leagues', to: '/browse-leagues' }}
    />
  ),
});
```

#### 3.3 Update Route Tree

**File:** `web/src/router.tsx`

Add `myTeamRoute` to route tree:
```typescript
const routeTree = rootRoute.addChildren([
  indexRoute,
  signInRoute,
  signUpRoute,
  joinInviteRoute,
  authenticatedLayoutRoute.addChildren([
    accountRoute,
    teamRequiredLayoutRoute.addChildren([
      leaguesRoute,
      browseLeaguesRoute,
      leagueRoute,
      teamRoute,
      myTeamRoute,  // ADD THIS
    ]),
  ]),
  noTeamLayoutRoute.addChildren([createTeamRoute]),
]);
```

#### 3.4 Update Leaderboard Links

**File:** `web/src/components/Leaderboard/Leaderboard.tsx`

Check ownership to determine link destination:
```typescript
export function Leaderboard({ league }: LeaderboardProps) {
  const { profile } = useRouteContext({ from: '/_authenticated' });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Team</TableHead>
          <TableHead className="text-right">Points</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {league.teams.map((team) => {
          const isMyTeam = team.ownerId === profile?.id;

          return (
            <TableRow key={team.id}>
              <TableCell>
                <Link
                  to={isMyTeam ? '/my-team' : '/team/$teamId'}
                  params={isMyTeam ? undefined : { teamId: String(team.id) }}
                  className="..."
                  preload="intent"
                >
                  <div className="text-lg hover:underline">
                    {team.name}
                    {isMyTeam && <Badge className="ml-2">You</Badge>}
                  </div>
                  <div className="text-muted-foreground">{team.ownerName}</div>
                </Link>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
```

**Note:** May need to import `Badge` from `@/components/ui/badge`.

---

### Phase 4: Update Navigation

#### 4.1 Update AppSidebar My Team Button

**File:** `web/src/components/AppSidebar/AppSidebar.tsx`

Update `handleMyTeam` to navigate to `/my-team`:
```typescript
const handleMyTeam = () => {
  navigate({ to: '/my-team' });  // Changed from /team/$teamId
};
```

---

## Edge Cases & Behavior

### Scenario 1: User Clicks Their Own Team in Leaderboard

```
1. Leaderboard detects: team.ownerId === profile.id
2. Link goes to: /my-team
3. Route loader: Calls getMyTeam(), receives user's team
4. Component renders: Team in EDIT mode (readOnly=false)
5. User can: Add/remove drivers, pick constructors
```

✅ Result: User can edit their team

### Scenario 2: User Clicks Sidebar "My Team"

```
1. Navigate to: /my-team
2. Route loader: Calls getMyTeam()
3. Component renders: Team in EDIT mode (readOnly=false)
4. URL visible: /my-team
5. User can: Add/remove drivers, pick constructors
```

✅ Result: Easy access to own team with consistent URL

### Scenario 3: User Clicks Other Team in Leaderboard

```
1. Leaderboard detects: team.ownerId !== profile.id
2. Link goes to: /team/$otherId
3. Route loader: Calls getTeamById($otherId)
4. Component renders: Team in READ-ONLY mode (readOnly=true)
5. User cannot: Add/remove, open picker sheets
```

✅ Result: View-only access to other teams

### Scenario 4: User Manually Navigates to /team/$myTeamId

```
1. Navigate to: /team/123 (where 123 = myTeamId)
2. Route loader checks: teamContext.myTeamId === 123
3. Redirect to: /my-team
4. URL changes: /my-team
5. Component renders: Team in EDIT mode
```

✅ Result: Consistent canonical URL

### Scenario 5: User Navigates to /my-team But Has No Team

```
1. Navigate to: /my-team
2. Route loader: Calls getMyTeam(), receives null
3. Redirect to: /create-team
4. User prompted: Create a team to continue
```

✅ Result: Graceful error handling

### Scenario 6: Non-Owner Tries to Edit in Read-Only Mode

```
1. User on: /team/$otherId (read-only mode)
2. User clicks: Driver slot (empty)
3. Handler executes: const onClick = readOnly ? () => {} : setSelectedPosition
4. Result: Sheet doesn't open
5. User sees: No interaction (no feedback needed)
```

✅ Result: Safe, no ability to send edit requests

---

## Testing Strategy

### Unit Tests

**RoleCard Component:**
- [ ] Renders without remove button when `readOnly=true` and variant='filled'
- [ ] Removes button is visible when `readOnly=false` and variant='filled'
- [ ] `onOpenSheet` callback is not called when `readOnly=true` and variant='empty'
- [ ] Clicking empty card calls `onOpenSheet` when `readOnly=false`

**LineupPicker Component:**
- [ ] Sheet does not render in DOM when `readOnly=true`
- [ ] Sheet renders when `readOnly=false`
- [ ] CardComponent receives `readOnly` prop correctly
- [ ] onClick/onRemove handlers are properly disabled when `readOnly=true`

**Team Component:**
- [ ] Route starting with `/my-team` sets `readOnly=false`
- [ ] Route `/team/$id` sets `readOnly=true`
- [ ] Passes `readOnly` to DriverPicker
- [ ] Passes `readOnly` to ConstructorPicker

### Integration Tests

**Route Behavior:**
- [ ] Navigate to `/my-team` → loads your team, renders in edit mode
- [ ] Navigate to `/team/$myTeamId` → redirects to `/my-team`
- [ ] Navigate to `/team/$otherId` → shows team in read-only mode
- [ ] Leaderboard link for your team goes to `/my-team`
- [ ] Leaderboard link for other teams goes to `/team/$id`
- [ ] Leaderboard shows "You" badge on your team

**Edit Mode (`/my-team`):**
- [ ] All picker sheets open on slot click
- [ ] Can add drivers and constructors
- [ ] Can remove drivers and constructors
- [ ] Remove buttons (X) are visible on filled slots
- [ ] Empty slots are clickable

**Read-Only Mode (`/team/$otherId`):**
- [ ] Clicking empty slots doesn't open sheet
- [ ] Clicking filled slots doesn't open sheet
- [ ] Remove buttons (X) are NOT visible
- [ ] No keyboard interaction triggers pickers
- [ ] URL stays at `/team/$id`

### Manual Testing Checklist

- [ ] Sign in as User A
- [ ] Click "My Team" from sidebar → `/my-team`, shows editable team
- [ ] Join league with multiple teams
- [ ] View leaderboard → see "You" badge on your team
- [ ] Click your team in leaderboard → navigates to `/my-team`
- [ ] Click other team in leaderboard → navigates to `/team/$id`, read-only
- [ ] Manually type `/team/$myId` in URL → redirects to `/my-team`
- [ ] In read-only mode, try clicking slots → no interaction
- [ ] Try right-click on slot → no context menu (read-only)
- [ ] Inspect UI → no remove buttons visible in read-only mode

---

## Verification Steps

After implementation, verify each of these:

### Backend Verification

- [ ] API endpoint `/api/teams/{id}` returns `ownerId` field
- [ ] `ownerId` matches team creator's user ID
- [ ] Leaderboard data includes `ownerId` for all teams
- [ ] No null/empty `ownerId` values in responses

### Frontend Routing Verification

- [ ] Navigate to `/my-team` → URL stays `/my-team`, loads your team
- [ ] Navigate to `/team/$myTeamId` → redirects to `/my-team`
- [ ] Navigate to `/team/$otherId` → URL stays `/team/$otherId`, loads team
- [ ] Leaderboard shows "You" badge on correct team
- [ ] Leaderboard links work correctly for all teams
- [ ] "My Team" sidebar button navigates to `/my-team`

### Frontend UI Verification

- [ ] On `/my-team`: Add/remove buttons visible, sheets open on click
- [ ] On `/team/$other`: No add/remove buttons, sheets don't open
- [ ] Empty slots in read-only mode: Not clickable/interactive
- [ ] Filled slots in read-only mode: Display content, no remove button
- [ ] Tab navigation: Read-only mode doesn't trap focus

### Build & Lint Verification

- [ ] `npm run build` completes without TypeScript errors
- [ ] `npm run lint` passes without warnings
- [ ] `npm run test` passes all tests
- [ ] No console errors in browser DevTools
- [ ] No new Sentry errors

---

## Files to Modify

### Backend (2 files)
- `api/F1CompanionApi/Api/Models/TeamDetailsResponse.cs` - Add OwnerId property
- `api/F1CompanionApi/Api/Mappers/TeamResponseMapper.cs` - Map OwnerId field

### Frontend (11 files)
- `web/src/contracts/Team.ts` - Add ownerId to interface
- `web/src/components/RoleCard/RoleCard.tsx` - Add readOnly prop, hide remove button when true
- `web/src/components/DriverCard/DriverCard.tsx` - Add readOnly prop, pass to RoleCard
- `web/src/components/ConstructorCard/ConstructorCard.tsx` - Add readOnly prop, pass to RoleCard
- `web/src/components/LineupPicker/LineupPicker.tsx` - Add readOnly prop, disable sheet and callbacks when true
- `web/src/components/DriverPicker/DriverPicker.tsx` - Add readOnly prop, pass to LineupPicker
- `web/src/components/ConstructorPicker/ConstructorPicker.tsx` - Add readOnly prop, pass to LineupPicker
- `web/src/components/Team/Team.tsx` - Determine readOnly from route, pass to pickers
- `web/src/components/AppSidebar/AppSidebar.tsx` - Update "My Team" button to navigate to `/my-team`
- `web/src/components/Leaderboard/Leaderboard.tsx` - Check ownership, link correctly, show "You" badge
- `web/src/router.tsx` - Add myTeamRoute, update teamRoute with redirect, update route tree

---

## Risk Assessment

### Low Risk Items

- ✅ Backend changes are additive (no breaking changes to existing fields)
- ✅ Frontend changes cascade cleanly through prop hierarchy
- ✅ Existing functionality preserved (edit mode identical to current)
- ✅ Route redirect is backward compatible (just changes URL)

### Mitigation Strategies

- Add TypeScript types for all new props (prevents runtime errors)
- Test both modes thoroughly (edit and read-only)
- Use existing League ownership pattern as reference (proven approach)
- Verify API returns `ownerId` in all team responses

### Edge Case Handling

- ✅ User with no team navigating to `/my-team` → redirects to create-team
- ✅ Stale bookmarks to `/team/$myId` → automatically redirects to `/my-team`
- ✅ Network error loading team → shows error state, not blank screen
- ✅ Permission issue (viewing someone else's `/team/$id`) → read-only mode prevents edits

---

## Success Criteria

### Must Have

1. ✅ Backend API includes `ownerId` in team responses
2. ✅ `/my-team` route works and loads user's team in edit mode
3. ✅ `/team/$otherId` shows other teams in read-only mode
4. ✅ `/team/$myTeamId` redirects to `/my-team`
5. ✅ All picker interactions disabled in read-only mode
6. ✅ No console errors or TypeScript type errors
7. ✅ All tests pass

### Should Have

1. ✅ Leaderboard shows "You" badge on user's team
2. ✅ Leaderboard links correctly (own team → `/my-team`, others → `/team/$id`)
3. ✅ Keyboard navigation respects read-only mode
4. ✅ UI clearly indicates read-only status

### Nice to Have

1. ⚠️ Toast notification when attempting edit in read-only mode
2. ⚠️ Visual indicator (badge, styling) showing read-only status
3. ⚠️ Analytics tracking for read-only vs edit mode views

---

## Dependencies & Prerequisites

### Must Be Complete Before Starting

- ✅ Team data model finalized (id, name, ownerName, drivers, constructors)
- ✅ API endpoints for team fetching implemented
- ✅ Route guards and route structure established
- ✅ Picker components functional and tested
- ✅ TeamContext and AuthContext working

### Can Be Done In Parallel

- League joining and invite functionality
- Leaderboard polish and features
- Other MVP step implementations

---

## Timeline Notes

No time estimates provided per project guidelines.

---

## References

**Similar Implementation:**
- League ownership pattern (LeagueResponse has OwnerId, similar UI controls)

**Related Files:**
- League component ownership checks
- Route guard patterns in `src/lib/route-guards.ts`
- TanStack Router redirect patterns
