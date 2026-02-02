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

| URL             | Condition             | Behavior                       |
| --------------- | --------------------- | ------------------------------ |
| `/my-team`      | Always                | Load your team, edit mode      |
| `/team/$teamId` | `teamId === myTeamId` | Redirect to `/my-team`         |
| `/team/$teamId` | `teamId !== myTeamId` | Load team, read-only mode      |
| `/team/$teamId` | Team not found        | Show error, link to `/my-team` |

### Component Mode Strategy

**Single Team Component with Route-Based Mode:**

```typescript
// Team component determines mode from route, not ownership
const isMyTeam = useMatch({
  from: '/_authenticated/_team-required/my-team',
  shouldThrow: false
});
const readOnly = !isMyTeam;

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

**Add `OwnerId` to BOTH TeamDetailsResponse AND TeamResponse:**

**Critical:** Leaderboards use `TeamResponse`, not `TeamDetailsResponse`!

**TeamDetailsResponse (for full team view):**

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

**TeamResponse (for leaderboards):**

Current:

```csharp
public class TeamResponse {
  public required int Id { get; set; }
  public required string Name { get; set; }
  public required string OwnerName { get; set; }
}
```

New:

```csharp
public class TeamResponse {
  public required int Id { get; set; }
  public required string Name { get; set; }
  public required string OwnerName { get; set; }
  public int OwnerId { get; set; }  // NEW: User ID
}
```

**Why needed?**

- Frontend needs ownership check: `team.ownerId === profile.id`
- Leaderboard must determine correct link destination (my-team vs team/$id)
- Consistent with existing League pattern (LeagueResponse has OwnerId)
- Backend already has `team.UserId` - just needs exposure

### Read-Only Mode Implementation

**Cascade `readOnly` prop through picker hierarchy:**

```
Team (determines readOnly from route)
  ├── DriverPicker (readOnly=true/false)
  │   ├── useLineupPicker hook (handles state)
  │   ├── DriverCard (readOnly=true/false) - handles empty/filled states
  │   └── Sheet (conditionally rendered based on readOnly)
  │
  └── ConstructorPicker (readOnly=true/false)
      ├── useLineupPicker hook (handles state)
      ├── ConstructorCard (readOnly=true/false) - handles empty/filled states
      └── Sheet (conditionally rendered based on readOnly)
```

**Current Architecture (Verified):**

- **No RoleCard** - removed in previous refactor
- **DriverCard/ConstructorCard** - leaf components handling both empty and filled states
- **DriverPicker/ConstructorPicker** - use `useLineupPicker` hook for state management
- **Sheet** - controlled by `selectedPosition` state from hook

**When `readOnly=true`:**

- **Visual indicator**: Team header shows "Owner: [Name]" for other teams
- **Empty slots**: Placeholder cards display "Empty Slot" / "No driver selected" text (no buttons)
- **Filled slots**: Display content normally, no remove (X) button shown
- **Sheet**: Never renders in DOM (conditionally excluded when readOnly)
- **Callbacks**: Either disabled or no-ops

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

#### 1.0 Add OwnerId to TeamResponse (CRITICAL - LEADERBOARD BLOCKER)

**File:** `api/F1CompanionApi/Api/Models/TeamResponse.cs`

Add property to response model:

```csharp
public int OwnerId { get; set; }
```

**File:** `api/F1CompanionApi/Api/Mappers/TeamResponseMapper.cs`

In `ToResponseModel()` method, map the field:

```csharp
OwnerId = team.UserId,
```

**Why critical:** Leaderboards use `TeamResponse`, not `TeamDetailsResponse`. Without this, ownership detection fails.

#### 1.1 Add OwnerId to TeamDetailsResponse

**File:** `api/F1CompanionApi/Api/Models/TeamDetailsResponse.cs`

Add property to response model:

```csharp
public int OwnerId { get; set; }
```

#### 1.2 Update TeamDetailsResponse Mapper

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
  ownerId: number; // NEW
  drivers: TeamDriver[];
  constructors: TeamConstructor[];
}
```

---

### Phase 2: Add Read-Only Mode to Components

#### 2.1 Update DriverCard Component

**File:** `web/src/components/DriverCard/DriverCard.tsx`

Add `readOnly` prop and update logic:

```typescript
interface DriverCardProps {
  driver: Driver | null;
  onOpenPicker: () => void;
  onRemove: () => void;
  readOnly?: boolean; // NEW
}

export function DriverCard({ driver, onOpenPicker, onRemove, readOnly }: DriverCardProps) {
  return (
    <Card className="bg-secondary relative py-4">
      <CardContent className="group flex h-full items-center justify-between px-3">
        {driver ? (
          <div className="flex w-full">
            {/* ... existing filled state ... */}
          </div>
        ) : readOnly ? (
          // Read-only mode: Show placeholder text (no button)
          <div className="text-muted-foreground flex flex-col items-center py-4 text-center">
            <p className="font-medium">Empty Slot</p>
            <p className="text-sm">No driver selected</p>
          </div>
        ) : (
          // Edit mode: Show add button
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
      {driver && !readOnly && ( // Only show remove button when NOT read-only
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

**Key changes:**

- Add `readOnly` prop
- Disable "Add Driver" button when `readOnly=true`
- Conditionally render remove button only when `!readOnly`

#### 2.2 Update ConstructorCard Component

**File:** `web/src/components/ConstructorCard/ConstructorCard.tsx`

Same pattern as DriverCard:

```typescript
interface ConstructorCardProps {
  constructor: Constructor | null;
  onOpenPicker: () => void;
  onRemove: () => void;
  readOnly?: boolean; // NEW
}

export function ConstructorCard({ constructor, onOpenPicker, onRemove, readOnly }: ConstructorCardProps) {
  return (
    <Card className="bg-secondary relative py-4">
      <CardContent className="group flex h-full items-center justify-between px-3">
        {constructor ? (
          <div className="flex w-full">
            {/* ... existing filled state ... */}
          </div>
        ) : readOnly ? (
          // Read-only mode: Show placeholder text (no button)
          <div className="text-muted-foreground flex flex-col items-center py-4 text-center">
            <p className="font-medium">Empty Slot</p>
            <p className="text-sm">No constructor selected</p>
          </div>
        ) : (
          // Edit mode: Show add button
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
      {constructor && !readOnly && (
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

#### 2.3 Update DriverPicker Component

**File:** `web/src/components/DriverPicker/DriverPicker.tsx`

Add `readOnly` prop and update render logic:

```typescript
interface DriverPickerProps {
  activeDrivers: Driver[];
  teamDrivers?: TeamDriver[];
  readOnly?: boolean; // NEW
}

export function DriverPicker({ activeDrivers, teamDrivers, readOnly }: DriverPickerProps) {
  // ... existing lineup building and useLineupPicker hook ...

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
    lineup,
    lineupSize: DRIVER_SLOTS,
    itemType: 'driver',
    addToTeam: addDriverToTeam,
    removeFromTeam: removeDriverFromTeam,
  });

  return (
    <>
      {error && <div className="pb-4"><InlineError message={error} /></div>}

      <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-2">
        {displayLineup.map((driver, idx) => (
          <DriverCard
            key={idx}
            driver={driver}
            onOpenPicker={() => openPicker(idx)}
            onRemove={() => handleRemove(idx)}
            readOnly={readOnly} // Pass readOnly to card
          />
        ))}
        {/* ... loading overlay ... */}
      </div>

      {/* Only render Sheet when NOT read-only */}
      {!readOnly && (
        <Sheet
          open={selectedPosition !== null}
          onOpenChange={(open) => !open && closePicker()}
        >
          {/* ... sheet content ... */}
        </Sheet>
      )}
    </>
  );
}
```

**Key changes:**

- Add `readOnly` prop to interface
- Pass `readOnly` to `DriverCard`
- Conditionally render `Sheet` only when `!readOnly`

#### 2.4 Update ConstructorPicker Component

**File:** `web/src/components/ConstructorPicker/ConstructorPicker.tsx`

Same pattern as DriverPicker:

```typescript
interface ConstructorPickerProps {
  activeConstructors: Constructor[];
  teamConstructors?: TeamConstructor[];
  readOnly?: boolean; // NEW
}

export function ConstructorPicker({
  activeConstructors,
  teamConstructors,
  readOnly,
}: ConstructorPickerProps) {
  // ... existing lineup building and useLineupPicker hook ...

  return (
    <>
      {error && <div className="pb-4"><InlineError message={error} /></div>}

      <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-2">
        {displayLineup.map((constructor, idx) => (
          <ConstructorCard
            key={idx}
            constructor={constructor}
            onOpenPicker={() => openPicker(idx)}
            onRemove={() => handleRemove(idx)}
            readOnly={readOnly} // Pass readOnly to card
          />
        ))}
        {/* ... loading overlay ... */}
      </div>

      {/* Only render Sheet when NOT read-only */}
      {!readOnly && (
        <Sheet
          open={selectedPosition !== null}
          onOpenChange={(open) => !open && closePicker()}
        >
          {/* ... sheet content ... */}
        </Sheet>
      )}
    </>
  );
}
```

#### 2.5 Update Team Component

**File:** `web/src/components/Team/Team.tsx`

Convert `Team` from a route-aware component to a presentational component that accepts data via props. This allows it to be shared across two routes while each route maintains type-safe `useLoaderData` calls.

**Component Props:**

```typescript
interface TeamProps {
  team: TeamType;
  activeDrivers: Driver[];
  activeConstructors: Constructor[];
  readOnly: boolean;
}

export function Team({ team, activeDrivers, activeConstructors, readOnly }: TeamProps) {
  // Track active tab to control visibility while keeping both tabs mounted
  const [activeTab, setActiveTab] = useState('drivers');

  return (
    <AppContainer maxWidth="md">
      <div className="mb-4 gap-4 sm:grid sm:grid-cols-2">
        <Card className="mb-6 flex justify-center sm:mb-0">
          <CardHeader>
            <CardTitle className="text-center text-3xl font-bold">{team.name}</CardTitle>
            {/* Show owner name in read-only mode */}
            {readOnly && (
              <p className="text-muted-foreground text-center text-sm">
                Owner: {team.ownerName}
              </p>
            )}
          </CardHeader>
          <CardContent>
            {/* ... existing budget/trades display ... */}
          </CardContent>
        </Card>

        {/* ... existing race selector and results cards ... */}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="drivers">Drivers</TabsTrigger>
          <TabsTrigger value="constructors">Constructors</TabsTrigger>
        </TabsList>

        <TabsContent value="drivers" forceMount style={{ display: activeTab !== 'drivers' ? 'none' : undefined }}>
          <Card className="py-4">
            <CardContent className="px-4">
              <DriverPicker
                activeDrivers={activeDrivers}
                teamDrivers={team.drivers}
                readOnly={readOnly}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="constructors" forceMount style={{ display: activeTab !== 'constructors' ? 'none' : undefined }}>
          <Card className="py-4">
            <CardContent className="px-4">
              <ConstructorPicker
                activeConstructors={activeConstructors}
                teamConstructors={team.constructors}
                readOnly={readOnly}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppContainer>
  );
}
```

**Key changes:**

- `Team` now accepts all data as props instead of calling `useLoaderData`
- `readOnly` is passed as a prop (determined by the route, not the component)
- This makes `Team` a proper reusable component that works with both routes
- Each route definition (in router.tsx) will call `useLoaderData` with its own typed `from` and wrap `Team` with the appropriate props

---

### Phase 3: Update Routes

#### 3.1 Create My Team Route

**File:** `web/src/router.tsx`

Add new route with an inline wrapper component that calls `useLoaderData` with the typed `from` parameter:

```typescript
const myTeamRoute = createRoute({
  getParentRoute: () => teamRequiredLayoutRoute,
  path: 'my-team',
  staticData: {
    pageTitle: 'My Team',
  },
  loader: async () => {
    const [team, activeDrivers, activeConstructors] = await Promise.all([
      getMyTeam(),
      getActiveDrivers(),
      getActiveConstructors(),
    ]);

    if (!team) {
      throw redirect({ to: '/create-team' });
    }

    return { team, activeDrivers, activeConstructors };
  },
  component: () => {
    // Inline wrapper component that calls useLoaderData with typed `from`
    const { team, activeDrivers, activeConstructors } = useLoaderData({
      from: '/_authenticated/_team-required/my-team',
    });

    return (
      <Team
        team={team}
        activeDrivers={activeDrivers}
        activeConstructors={activeConstructors}
        readOnly={false}
      />
    );
  },
  pendingComponent: () => (
    <div role="status" className="flex w-full items-center justify-center p-8 md:min-h-screen">
      <div className="text-center">
        <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2"></div>
        <p className="text-muted-foreground">Loading team...</p>
      </div>
    </div>
  ),
  pendingMs: 200,
  staleTime: 10_000,
  gcTime: 5 * 60 * 1000,
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="mb-4 text-4xl font-bold">Team Not Found</h1>
      <p className="text-muted-foreground mb-4">Your team could not be found.</p>
      <a href="/create-team" className="text-primary hover:underline">
        Create Team
      </a>
    </div>
  ),
  errorComponent: ({ error }) => (
    <ErrorBoundary level="page">
      <ErrorFallback error={error} level="page" onReset={() => window.location.reload()} />
    </ErrorBoundary>
  ),
});
```

#### 3.2 Update Team Route with Redirect

**File:** `web/src/router.tsx`

Update existing `teamRoute` with an inline wrapper component and redirect logic:

```typescript
const teamRoute = createRoute({
  getParentRoute: () => teamRequiredLayoutRoute,
  path: 'team/$teamId',
  staticData: {
    pageTitle: 'Team Details',
  },
  loader: async ({ params, context }) => {
    const TEAM_ROUTE_ID = '/_authenticated/_team-required/team/$teamId';

    // Validate and parse params using Zod schema
    const validationResult = teamIdParamsSchema.safeParse(params);

    if (!validationResult.success) {
      throw notFound({ routeId: TEAM_ROUTE_ID });
    }

    const { teamId } = validationResult.data;

    // Redirect if viewing own team
    const { teamContext } = context;
    if (teamContext.myTeamId === teamId) {
      throw redirect({ to: '/my-team' });
    }

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
  component: () => {
    // Inline wrapper component that calls useLoaderData with typed `from`
    const { team, activeDrivers, activeConstructors } = useLoaderData({
      from: '/_authenticated/_team-required/team/$teamId',
    });

    return (
      <Team
        team={team}
        activeDrivers={activeDrivers}
        activeConstructors={activeConstructors}
        readOnly={true}
      />
    );
  },
  pendingComponent: () => (
    <div role="status" className="flex w-full items-center justify-center p-8 md:min-h-screen">
      <div className="text-center">
        <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2"></div>
        <p className="text-muted-foreground">Loading team...</p>
      </div>
    </div>
  ),
  pendingMs: 200,
  staleTime: 10_000,
  gcTime: 5 * 60 * 1000,
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="mb-4 text-4xl font-bold">Team Not Found</h1>
      <p className="text-muted-foreground mb-4">The team you're looking for doesn't exist.</p>
      <a href="/leagues" className="text-primary hover:underline">
        Go to leagues
      </a>
    </div>
  ),
  errorComponent: ({ error }) => (
    <ErrorBoundary level="page">
      <ErrorFallback error={error} level="page" onReset={() => window.location.reload()} />
    </ErrorBoundary>
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
      myTeamRoute, // ADD THIS
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

**Note:** ✅ Verified - Badge component exists at `web/src/components/ui/badge.tsx`. Import with `import { Badge } from '@/components/ui/badge'`.

---

### Phase 4: Update Navigation

#### 4.1 Update AppSidebar My Team Button

**File:** `web/src/components/AppSidebar/AppSidebar.tsx`

Update `handleMyTeam` to navigate to `/my-team`:

```typescript
const handleMyTeam = () => {
  navigate({ to: '/my-team' }); // Changed from /team/$teamId
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

**Verified:** `teamContext.myTeamId` is guaranteed available (set by root route `beforeLoad` before any child route loaders run)

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

### Manual Testing Checklist

- [ ] Sign in as User A
- [ ] Click "My Team" from sidebar → `/my-team`, shows editable team
- [ ] Join league with multiple teams
- [ ] View leaderboard → see "You" badge on your team
- [ ] Click your team in leaderboard → navigates to `/my-team`
- [ ] Click other team in leaderboard → navigates to `/team/$id`, read-only
- [ ] Verify team header shows "Owner: [Name]" in read-only mode
- [ ] Verify empty slots show "Empty Slot / No driver selected" placeholder in read-only
- [ ] Manually type `/team/$myId` in URL → redirects to `/my-team`
- [ ] In read-only mode, try clicking empty slots → no interaction
- [ ] Inspect UI → no remove buttons visible on filled slots in read-only mode

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

- [ ] On `/my-team`: Add/remove buttons visible, sheets open on click, no owner name shown
- [ ] On `/team/$other`: Team header shows "Owner: [Name]" below team name
- [ ] On `/team/$other`: No add/remove buttons, sheets don't open
- [ ] Empty slots in read-only mode: Show "Empty Slot / No driver selected" placeholder text
- [ ] Empty slots in read-only mode: Not clickable/interactive
- [ ] Filled slots in read-only mode: Display content normally, no remove button
- [ ] Tab navigation: Read-only mode doesn't trap focus

### Build & Lint Verification

- [ ] `npm run build` completes without TypeScript errors
- [ ] `npm run lint` passes without warnings
- [ ] `npm run test` passes all tests
- [ ] No console errors in browser DevTools
- [ ] No new Sentry errors

---

## Files to Modify

### Backend (3 files)

- `api/F1CompanionApi/Api/Models/TeamResponse.cs` - Add OwnerId property (CRITICAL - leaderboard blocker)
- `api/F1CompanionApi/Api/Models/TeamDetailsResponse.cs` - Add OwnerId property
- `api/F1CompanionApi/Api/Mappers/TeamResponseMapper.cs` - Map OwnerId field in both ToResponseModel() and ToDetailsResponseModel()

### Frontend (8 files)

- `web/src/contracts/Team.ts` - Add ownerId to interface
- `web/src/components/DriverCard/DriverCard.tsx` - Add readOnly prop, disable interactions when true
- `web/src/components/ConstructorCard/ConstructorCard.tsx` - Add readOnly prop, disable interactions when true
- `web/src/components/DriverPicker/DriverPicker.tsx` - Add readOnly prop, pass to DriverCard, conditionally render Sheet
- `web/src/components/ConstructorPicker/ConstructorPicker.tsx` - Add readOnly prop, pass to ConstructorCard, conditionally render Sheet
- `web/src/components/Team/Team.tsx` - Determine readOnly from route using useMatch(), pass to pickers
- `web/src/components/AppSidebar/AppSidebar.tsx` - Update "My Team" button to navigate to `/my-team`
- `web/src/components/Leaderboard/Leaderboard.tsx` - Check ownership, link correctly, show "You" badge, import Badge
- `web/src/router.tsx` - Add myTeamRoute, update teamRoute with redirect, update route tree

**Note:** RoleCard and LineupPicker components were removed in previous refactoring - they are not part of the current architecture.

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
4. ✅ Team header shows "Owner: [Name]" in read-only mode
5. ✅ Empty slots show placeholder text ("Empty Slot" / "No driver selected") in read-only mode

### Nice to Have

1. ⚠️ Analytics tracking for read-only vs edit mode views

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
