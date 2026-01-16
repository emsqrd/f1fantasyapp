# Implementation Plan: Route-Centric Data Loading Refactor (Issue #51)

## Overview

This plan refactors the application to eliminate race conditions during signup by moving team data fetching from React Context (`useEffect`) to TanStack Router's route layer (`beforeLoad`).

### Problem Summary

When a new user signs up:

1. Supabase auth completes → `user` becomes non-null
2. `TeamContext`'s `useEffect` fires immediately on `user` change
3. API call to `/me/team` fails because user profile doesn't exist yet (still being created)
4. Results in 400 errors in console and Sentry

### Solution Summary

**Routes own their data requirements. Contexts provide reactive state, not side effects.**

- Remove `useEffect` data fetching from `TeamContext`
- Let routes fetch team data in `beforeLoad` and pass it via route context
- `TeamContext` becomes a passive store that routes populate

---

## Architecture Changes

### Before (Current)

```
App
├── AuthProvider (onAuthStateChange listener)
│   └── user state changes → triggers child updates
├── TeamProvider
│   └── useEffect([user]) → getMyTeam() ❌ RACE CONDITION
│       └── RouterProvider
│           └── beforeLoad guards call getMyTeam() again (duplicate)
```

### After (Proposed)

```
App
├── AuthProvider (onAuthStateChange listener - unchanged)
│   └── user state (no side effects)
├── TeamProvider (passive store - NO useEffect fetching)
│   └── RouterProvider
│       └── beforeLoad: fetch team once, provide via route context
│       └── Components access team via Route.useRouteContext()
```

---

## Implementation Steps

### Phase 1: Update TeamContext (Remove Side Effects)

**File:** `src/contexts/TeamContext.tsx`

**Changes:**

1. Remove the `useEffect` that fetches team on `user` change
2. Keep `myTeamId` state but make it settable externally
3. Add `setMyTeamId` to context value for routes to populate
4. Simplify to be a passive store

**New TeamContext Interface:**

```typescript
// src/contexts/TeamContext.ts
export interface TeamContextType {
  myTeamId: number | null;
  hasTeam: boolean;
  setMyTeamId: (id: number | null) => void; // NEW: For routes to set
  refreshMyTeam: () => Promise<void>; // Keep for manual refresh
}
```

**New TeamProvider:**

```typescript
// src/contexts/TeamContext.tsx
export function TeamProvider({ children }: { children: React.ReactNode }) {
  const [myTeamId, setMyTeamId] = useState<number | null>(null);

  // REMOVED: useEffect that fetches on user change

  const refreshMyTeam = useCallback(async () => {
    try {
      const team = await getMyTeam();
      setMyTeamId(team?.id ?? null);
    } catch (error) {
      Sentry.captureException(error);
      setMyTeamId(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      myTeamId,
      hasTeam: myTeamId !== null,
      setMyTeamId,
      refreshMyTeam,
    }),
    [myTeamId, refreshMyTeam],
  );

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}
```

---

### Phase 2: Update Router Context Type

**File:** `src/lib/router-context.ts`

**Changes:**

1. Add `team` data to route context (fetched team, not just context ref)

```typescript
import type { AuthContextType } from '@/contexts/AuthContext';
import type { TeamContextType } from '@/contexts/TeamContext';
import type { Team } from '@/contracts/Team';

export interface RouterContext {
  auth: AuthContextType;
  teamContext: TeamContextType; // RENAMED: Reference to TeamContext
  team: Team | null; // NEW: Actual team data from route
}
```

---

### Phase 3: Update Route Guards

**File:** `src/lib/route-guards.ts`

**Changes:**

1. `requireTeam` returns the fetched team to merge into route context
2. `requireNoTeam` just validates, doesn't return data
3. Remove duplicate fetches - data flows down from layout routes

```typescript
import type { Team } from '@/contracts/Team';
import type { RouterContext } from '@/lib/router-context';
import { getMyTeam } from '@/services/teamService';
import { redirect } from '@tanstack/react-router';

/**
 * Route guard that requires user authentication.
 * Unchanged - just validates auth state.
 */
export async function requireAuth(context: RouterContext): Promise<void> {
  if (!context.auth.user) {
    throw redirect({ to: '/', replace: true });
  }
}

/**
 * Route guard + data loader for routes requiring a team.
 * Returns the team to be merged into route context.
 */
export async function requireTeam(context: RouterContext): Promise<{ team: Team }> {
  await requireAuth(context);

  const team = await getMyTeam();

  if (!team) {
    throw redirect({ to: '/create-team', replace: true });
  }

  // Sync with TeamContext for components that need it
  context.teamContext.setMyTeamId(team.id);

  // Return team to merge into route context
  return { team };
}

/**
 * Route guard for routes requiring NO team.
 * Validates and returns team=null for context.
 */
export async function requireNoTeam(context: RouterContext): Promise<{ team: null }> {
  await requireAuth(context);

  const team = await getMyTeam();

  if (team) {
    // Sync with TeamContext before redirect
    context.teamContext.setMyTeamId(team.id);
    throw redirect({ to: '/leagues', replace: true });
  }

  context.teamContext.setMyTeamId(null);
  return { team: null };
}
```

---

### Phase 4: Update Router Layout Routes

**File:** `src/router.tsx`

**Changes:**

1. Layout routes use updated guards that return data
2. Child routes access team via `context.team`
3. Remove redundant `getMyTeam()` calls in child loaders

```typescript
/**
 * Team-required layout route - fetches team once for all children.
 */
const teamRequiredLayoutRoute = createRoute({
  getParentRoute: () => authenticatedLayoutRoute,
  id: '_team-required',
  beforeLoad: async ({ context }) => {
    // requireTeam now returns { team } which merges into context
    return await requireTeam(context);
  },
  component: () => <Outlet />,
});

/**
 * No-team layout route - for create-team flow.
 */
const noTeamLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_no-team',
  beforeLoad: async ({ context }) => {
    return await requireNoTeam(context);
  },
  component: () => <Outlet />,
});
```

**Child routes can now access team via context:**

```typescript
const leaguesRoute = createRoute({
  getParentRoute: () => teamRequiredLayoutRoute,
  path: 'leagues',
  loader: async ({ context }) => {
    // context.team is available from parent's beforeLoad!
    // No need to call getMyTeam() here
    const leagues = await getMyLeagues();
    return { leagues };
  },
  component: LeagueList,
  // ...
});
```

---

### Phase 5: Update InnerApp

**File:** `src/InnerApp.tsx`

**Changes:**

1. Rename `team` to `teamContext` in router context provision
2. Initialize `team` as `null` (routes will populate it)

```typescript
export function InnerApp() {
  const auth = useAuth();
  const teamContext = useTeam();

  useInvalidateOnUserChange(auth.user?.id, auth.loading);

  if (auth.loading) {
    return <LoadingSpinner />;
  }

  return (
    <RouterProvider
      router={router}
      context={{
        auth,
        teamContext,  // RENAMED
        team: null,   // NEW: Routes will populate via beforeLoad
      }}
    />
  );
}
```

---

### Phase 6: Update Components Using Team Context

Components that need team data have two options:

**Option A: Use Route Context (Preferred for route-rendered components)**

```typescript
function LeagueList() {
  const { team } = Route.useRouteContext();
  // team is guaranteed to exist (beforeLoad ensures this)
}
```

**Option B: Use TeamContext (For non-route components like Layout header)**

```typescript
function Layout() {
  const { hasTeam, myTeamId } = useTeam();
  // Use for conditional rendering in shared components
}
```

---

### Phase 7: Fix Sign-Up Flow

**File:** `src/components/auth/SignUpForm/SignUpForm.tsx`

The signup flow should:

1. Call `authContext.signUp()` (creates auth + profile)
2. Navigate to `/create-team`
3. Route's `beforeLoad` handles the rest

```typescript
const handleSubmit = async (values: SignUpFormValues) => {
  try {
    await signUp(values.email, values.password, {
      firstName: values.firstName,
      lastName: values.lastName,
      displayName: values.displayName,
    });

    // Profile is now created, navigate to create-team
    // The route's beforeLoad will handle team checking
    navigate({ to: '/create-team' });
  } catch (error) {
    // Handle error...
  }
};
```

---

## Testing Checklist

### Manual Testing

- [ ] **New User Signup Flow**
  1. Sign up as new user
  2. Should redirect to `/create-team` without console errors
  3. No 400/404 errors in Sentry or browser console

- [ ] **Existing User Sign In**
  1. Sign in as user with team → redirects to `/leagues`
  2. Sign in as user without team → redirects to `/create-team`

- [ ] **Direct URL Access**
  1. Unauthenticated user visits `/leagues` → redirects to `/`
  2. User without team visits `/leagues` → redirects to `/create-team`
  3. User with team visits `/create-team` → redirects to `/leagues`

- [ ] **Team Creation**
  1. Create team on `/create-team`
  2. Should redirect to `/leagues` after creation
  3. TeamContext should reflect new team

### Unit Tests to Update

- [ ] `TeamContext.test.tsx` - Remove useEffect tests, add setMyTeamId tests
- [ ] `route-guards.test.ts` - Update to test return values
- [ ] `InnerApp.test.tsx` - Update context shape

---

## Files to Modify

| File                                            | Changes                                   |
| ----------------------------------------------- | ----------------------------------------- |
| `src/contexts/TeamContext.tsx`                  | Remove useEffect, add setMyTeamId         |
| `src/contexts/TeamContext.ts`                   | Update interface                          |
| `src/lib/router-context.ts`                     | Add team data, rename teamContext         |
| `src/lib/route-guards.ts`                       | Return data from guards                   |
| `src/router.tsx`                                | Update layout routes to use returned data |
| `src/InnerApp.tsx`                              | Update context provision                  |
| `src/components/auth/SignUpForm/SignUpForm.tsx` | Already fixed (verify)                    |

---

## Rollback Plan

If issues arise:

1. Revert TeamContext to include useEffect (keep setMyTeamId)
2. Route guards continue working, just redundant fetches
3. No breaking changes to component APIs

---

## Timeline Estimate

| Phase                          | Effort   |
| ------------------------------ | -------- |
| Phase 1: Update TeamContext    | 15 min   |
| Phase 2: Update Router Context | 5 min    |
| Phase 3: Update Route Guards   | 15 min   |
| Phase 4: Update Router Routes  | 20 min   |
| Phase 5: Update InnerApp       | 5 min    |
| Phase 6: Update Components     | 10 min   |
| Phase 7: Verify Sign-Up Flow   | 5 min    |
| Testing                        | 30 min   |
| **Total**                      | ~2 hours |

---

## Success Criteria

1. ✅ No console errors during signup flow
2. ✅ No Sentry errors for `/me/team` 400 responses
3. ✅ Team data fetched once per route navigation (not on every user change)
4. ✅ All existing route guards continue to work
5. ✅ All tests pass
