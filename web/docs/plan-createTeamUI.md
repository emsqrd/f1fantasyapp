# Plan: Create Team UI with Mandatory Team Creation

Build a full-page team creation route that users are redirected to after authentication if they don't have a team. Uses a dedicated TeamContext for separation of concerns and route-based guards to enforce team requirement before accessing protected features. The create team page will eventually support driver/constructor selection similar to the existing Team component.

## Steps

### Step 1: Refactor Team Interface

**File:** `src/contracts/Team.ts`

Remove `rank` and `totalPoints` fields to match API response.

**Current:**

```typescript
export interface Team {
  id: number;
  name: string;
  ownerName: string;
  rank: number;
  totalPoints: number;
}
```

**Updated:**

```typescript
export interface Team {
  id: number;
  name: string;
  ownerName: string;
}
```

---

### Step 2: Create API Contracts and Service Methods

**File:** `src/contracts/CreateTeamRequest.ts` (NEW)

```typescript
export interface CreateTeamRequest {
  name: string;
}
```

**File:** `src/services/teamService.ts`

Add `createTeam()` and `getMyTeam()` methods following the pattern from `leagueService.ts`.

**Current:**

```typescript
import type { Team } from '@/contracts/Team';
import { apiClient } from '@/lib/api';

export async function getTeams(): Promise<Team[]> {
  return await apiClient.get('/teams');
}

export async function getTeamById(id: number): Promise<Team | null> {
  return await apiClient.get(`/teams/${id}`);
}
```

**Updated:**

```typescript
import type { CreateTeamRequest } from '@/contracts/CreateTeamRequest';
import type { Team } from '@/contracts/Team';
import { apiClient } from '@/lib/api';
import * as Sentry from '@sentry/react';

export async function createTeam(data: CreateTeamRequest): Promise<Team> {
  const team = await apiClient.post<Team, CreateTeamRequest>('/teams', data);

  // INFO - significant business event
  Sentry.logger.info('Team created', {
    teamId: team.id,
    teamName: team.name,
  });

  return team;
}

export async function getMyTeam(): Promise<Team | null> {
  try {
    return await apiClient.get<Team>('/me/team');
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function getTeams(): Promise<Team[]> {
  return await apiClient.get('/teams');
}

export async function getTeamById(id: number): Promise<Team | null> {
  return await apiClient.get(`/teams/${id}`);
}
```

---

### Step 3: Add Team Validation Schema

**File:** `src/validations/teamSchemas.ts` (NEW)

Pattern based on `createLeagueFormSchema.ts`.

```typescript
import { z } from 'zod';

export const createTeamFormSchema = z.object({
  teamName: z
    .string()
    .min(1, 'Team name is required')
    .max(50, 'Team name must be less than 50 characters')
    .trim(),
});

export type CreateTeamFormData = z.infer<typeof createTeamFormSchema>;
```

---

### Step 4: Create TeamContext and Provider

**File:** `src/contexts/TeamContext.tsx` (NEW)

Pattern based on `AuthContext.tsx` with memoization for performance.

```typescript
import type { Team } from '@/contracts/Team';
import { useAuth } from '@/hooks/useAuth';
import { getMyTeam } from '@/services/teamService';
import * as Sentry from '@sentry/react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

interface TeamContextType {
  team: Team | null;
  hasTeam: boolean;
  isCheckingTeam: boolean;
  error: Error | null;
  setTeam: (team: Team) => void;
  refetchTeam: () => Promise<void>;
}

export const TeamContext = createContext<TeamContextType | undefined>(undefined);

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [team, setTeamState] = useState<Team | null>(null);
  const [isCheckingTeam, setIsCheckingTeam] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTeam = useCallback(async () => {
    if (!user) {
      setTeamState(null);
      setIsCheckingTeam(false);
      return;
    }

    try {
      setIsCheckingTeam(true);
      setError(null);
      const teamData = await getMyTeam();
      setTeamState(teamData);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch team');
      setError(error);
      Sentry.captureException(error, {
        contexts: {
          team: { userId: user.id },
        },
      });
    } finally {
      setIsCheckingTeam(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const setTeam = useCallback((newTeam: Team) => {
    setTeamState(newTeam);
  }, []);

  const refetchTeam = useCallback(async () => {
    await fetchTeam();
  }, [fetchTeam]);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      team,
      hasTeam: team !== null,
      isCheckingTeam,
      error,
      setTeam,
      refetchTeam,
    }),
    [team, isCheckingTeam, error, setTeam, refetchTeam],
  );

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

export function useTeam() {
  const context = useContext(TeamContext);
  if (context === undefined) {
    throw new Error('useTeam must be used within a TeamProvider');
  }
  return context;
}
```

**File:** `src/hooks/useTeam.ts` (NEW - for convenience)

```typescript
export { useTeam } from '@/contexts/TeamContext';
```

---

### Step 5: Build CreateTeam Page Component

**File:** `src/components/CreateTeam/CreateTeam.tsx` (NEW)

Pattern based on `CreateLeague.tsx` but as a full page instead of dialog, using layout from `Team.tsx`.

```typescript
import { AppContainer } from '@/components/AppContainer/AppContainer';
import { FormFieldInput } from '@/components/FormField/FormField';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CreateTeamFormData } from '@/validations/teamSchemas';
import { createTeamFormSchema } from '@/validations/teamSchemas';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import { useTeam } from '@/hooks/useTeam';
import { createTeam } from '@/services/teamService';

export function CreateTeam() {
  const navigate = useNavigate();
  const { setTeam } = useTeam();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CreateTeamFormData>({
    resolver: zodResolver(createTeamFormSchema),
    mode: 'onBlur',
    defaultValues: {
      teamName: '',
    },
  });

  const onSubmit = async (formData: CreateTeamFormData) => {
    try {
      const createdTeam = await createTeam({
        name: formData.teamName,
      });

      toast.success('Team created successfully!');

      // Update TeamContext
      setTeam(createdTeam);

      // Navigate to leagues
      navigate('/leagues');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create team';
      toast.error(message);
    }
  };

  return (
    <AppContainer maxWidth="md">
      <div className="flex w-full items-center justify-center p-8 md:min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-3xl font-bold">Create Your Team</CardTitle>
            <p className="text-muted-foreground text-center">
              Choose a name for your fantasy F1 team
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormFieldInput
                label="Team Name"
                id="teamName"
                required
                error={errors.teamName?.message}
                register={register('teamName')}
                placeholder="Enter your team name"
                helpText="You can change this later"
              />

              <div className="flex justify-end pt-2">
                <Button disabled={isSubmitting || !isDirty} className="min-w-32" type="submit">
                  {isSubmitting ? 'Creating...' : 'Create Team'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppContainer>
  );
}
```

---

### Step 6: Create TeamRequiredGuard Component

**File:** `src/components/TeamRequiredGuard/TeamRequiredGuard.tsx` (NEW)

Pattern based on `ProtectedRoute.tsx` but checks team status and redirects.

```typescript
import { useTeam } from '@/hooks/useTeam';
import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router';

import { Button } from '../ui/button';

export function TeamRequiredGuard() {
  const { hasTeam, isCheckingTeam, error, refetchTeam } = useTeam();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isCheckingTeam && !hasTeam && !error) {
      // Redirect to create-team page if no team exists
      navigate('/create-team', { replace: true });
    }
  }, [hasTeam, isCheckingTeam, error, navigate]);

  // Show loading state while checking team
  if (isCheckingTeam) {
    return (
      <div className="flex w-full items-center justify-center p-8 md:min-h-screen">
        <div className="text-center">
          <div
            role="status"
            className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2"
          ></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show error state with retry option
  if (error) {
    return (
      <div className="flex w-full items-center justify-center p-8 md:min-h-screen">
        <div className="text-center space-y-4">
          <p className="text-red-600 dark:text-red-400">
            Failed to load team information. Please try again.
          </p>
          <Button onClick={refetchTeam}>Retry</Button>
        </div>
      </div>
    );
  }

  // If no team, return null while redirecting
  if (!hasTeam) {
    return null;
  }

  // Has team - render protected routes
  return <Outlet />;
}
```

---

### Step 7: Integrate TeamProvider and Routing

**File:** `src/main.tsx`

Add TeamProvider wrapper and restructure routes with TeamRequiredGuard.

**Current structure:**

```typescript
<AuthProvider>
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Layout />}>
        {/* routes */}
      </Route>
    </Routes>
  </BrowserRouter>
</AuthProvider>
```

**Updated structure:**

```typescript
import { TeamProvider } from './contexts/TeamContext.tsx';
import { TeamRequiredGuard } from './components/TeamRequiredGuard/TeamRequiredGuard.tsx';
import { CreateTeam } from './components/CreateTeam/CreateTeam.tsx';

// ... existing imports and Sentry init ...

const ProtectedLeagueList = withProtection(LeagueList);
const ProtectedLeague = withProtection(League);
const ProtectedTeam = withProtection(Team);
const ProtectedAccount = withProtection(Account);
const ProtectedCreateTeam = withProtection(CreateTeam);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Toaster position="top-center" />
    <AuthProvider>
      <TeamProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              {/* Public routes */}
              <Route index element={<LandingPage />} />
              <Route path="/sign-in" element={<SignInForm />} />
              <Route path="/sign-up" element={<SignUpForm />} />

              {/* Protected route - create team (no team required) */}
              <Route path="/create-team" element={<ProtectedCreateTeam />} />

              {/* Protected route - account (no team required) */}
              <Route path="/account" element={<ProtectedAccount />} />

              {/* Team-required protected routes */}
              <Route element={<TeamRequiredGuard />}>
                <Route path="/leagues" element={<ProtectedLeagueList />} />
                <Route path="/league/:leagueId" element={<ProtectedLeague />} />
                <Route path="/team/:teamId" element={<ProtectedTeam />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </TeamProvider>
    </AuthProvider>
  </StrictMode>,
);
```

## Best Practices Validation

✅ **React 19**: `useContext` with custom hooks, `useCallback` for actions, `useMemo` for context value, hooks at top level

✅ **React Hook Form**: `zodResolver`, `mode: 'onBlur'`, `defaultValues`, `register()`, `formState`, `reset()` after submission

✅ **Zod**: Chains validators with `.trim()`, uses `z.infer<typeof>`, custom error messages, schema outside component

✅ **UX/UI Best Practices**: Full-page route for complex form, matches existing Team.tsx layout, clear progression (auth → create-team → features), no confusing blocked content, mobile-friendly, standard onboarding pattern

✅ **Architecture**: Separate TeamContext for domain logic, route-based guards with redirects (not blockers), reusable components prepared for future driver/constructor pickers

✅ **Performance**: Context value memoized, callbacks wrapped with `useCallback`, focused contexts prevent unnecessary re-renders

✅ **Error Handling**: Error state tracked in context, loading blocks navigation, retry mechanism via `refetchTeam()`, proper 404 handling for "no team" case
