# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

F1 Fantasy Sports platform built with React 19, TypeScript, and Vite. Users build fantasy F1 teams, join leagues, and earn points based on real race performance. Uses Supabase for authentication and TanStack Router for type-safe routing.

## Essential Commands

```bash
# Development
npm run dev              # Start dev server (http://localhost:5173)
npm run build            # Type check + production build
npm run preview          # Preview production build

# Testing
npm test                 # Run tests once
npm run test:watch       # Watch mode for development
npm run test:coverage    # Generate coverage reports

# Code Quality
npm run lint             # Run ESLint
```

## Core Technologies

- **React 19** with TypeScript
- **TanStack Router v1.144** - Type-safe routing with guards and loaders
- **Supabase** - Authentication and backend
- **Tailwind CSS v4** - With Vite plugin (not PostCSS)
- **Vitest + React Testing Library** - Testing framework
- **Zod + React Hook Form** - Form validation
- **shadcn/ui** - UI component library (never modify directly)
- **Sentry** - Error tracking and performance monitoring

## Architecture Patterns

### Routing Structure

**File:** `src/router.tsx`

TanStack Router uses **guard-based route protection** with pathless layout routes:

```
root
├── index (/)                    [PUBLIC]
├── sign-in, sign-up            [PUBLIC]
├── _authenticated (layout)      [REQUIRES AUTH via requireAuth]
│   ├── account
│   └── _team-required (layout)  [REQUIRES TEAM via requireTeam]
│       ├── leagues
│       ├── league/$leagueId
│       └── team/$teamId
└── _no-team (layout)            [REQUIRES NO TEAM via requireNoTeam]
    └── create-team
```

**Key concepts:**
- **Pathless layouts** (underscore prefix) group routes with shared guards
- **Route guards** in `src/lib/route-guards.ts` use `beforeLoad` to redirect unauthorized access
- **Route loaders** fetch data before rendering using `loader` function
- **Zod validation** for route parameters (e.g., `leagueId`, `teamId`)

**Adding protected routes:**
```typescript
import { requireAuth } from '@/lib/route-guards';

const myRoute = createRoute({
  getParentRoute: () => authenticatedLayoutRoute,
  path: 'my-route',
  beforeLoad: requireAuth,
  loader: async () => ({ data: await fetchData() }),
  component: MyComponent,
});
```

### Authentication Flow

**Files:** `src/contexts/AuthContext.tsx`, `src/lib/supabase.ts`, `src/hooks/useAuth.ts`

- `AuthProvider` wraps entire app in `main.tsx`
- Provides `user`, `session`, `loading`, `signIn`, `signUp`, `signOut`
- Route guards check auth state before allowing navigation
- `InnerApp.tsx` waits for `auth.loading` to complete before rendering routes

### State Management

**Two primary React contexts:**

1. **AuthContext** - Authentication state (user, session, loading)
2. **TeamContext** (`src/contexts/TeamContext.tsx`) - Current user's team ID for quick checks
   - `myTeamId`, `hasTeam`, `setMyTeamId`, `refreshMyTeam`
   - Synced by `requireTeam` guard in route loaders

**Pattern:** Router context stores data fetched by loaders, React contexts store identity/auth state only. This prevents unnecessary re-renders.

### API/Service Layer

**File:** `src/lib/api.ts`

Centralized `ApiClient` class handles all HTTP requests:
- Automatically injects Supabase JWT in Authorization header
- Consistent error handling with Sentry integration
- Optional `errorContext` parameter for better error messages

**Service modules** (in `src/services/`) wrap apiClient:
```typescript
// teamService.ts
export async function getMyTeam(): Promise<Team | null>
export async function createTeam(data): Promise<Team>

// leagueService.ts
export async function getMyLeagues(): Promise<League[]>
export async function getLeagueById(id): Promise<League | null>
```

**Pattern:** Services return `null` on 404, throw on other errors.

### Data Loading Pattern

**Route loaders** fetch data before component renders:

```typescript
const leagueRoute = createRoute({
  path: 'league/$leagueId',
  loader: async ({ params }) => {
    const league = await getLeagueById(params.leagueId);
    if (!league) throw notFound({ routeId: ROUTE_ID });
    return { league };
  },
  component: LeagueComponent,
});

// In component - no loading states needed!
function LeagueComponent() {
  const { league } = Route.useLoaderData();
  return <div>{league.name}</div>;
}
```

### Error Handling

**Multi-level error boundary strategy:**

- **ErrorBoundary** (`src/components/ErrorBoundary/`) - Catches React rendering errors
- **React 19 error handlers** in `main.tsx` - `onUncaughtError`, `onCaughtError`, `onRecoverableError`
- **ErrorFallback** - User-friendly fallback UI
- **ErrorState** - Full-page error display for data failures
- **InlineError** - Form validation/submission errors
- **Route errorComponent** - Handles loader/guard errors

**When to use:**
- Toasts: Background operations only (e.g., avatar uploads)
- InlineError: Form errors, validation failures
- ErrorState: Page-level data fetching failures
- ErrorBoundary: Wrap components that might throw during render

### Testing Strategy

**Files:** `src/setupTests.ts`, `src/test-utils/mockFactories.ts`

**Philosophy:** Test user-facing behavior, not implementation details

**What to test:**
- User interactions and workflows
- Business logic specific to your component
- Error handling and edge cases
- Accessibility (keyboard navigation, ARIA attributes)

**What NOT to test:**
- Third-party library internals (React Hook Form, Radix UI)
- Static JSX rendering (headings, labels)
- Styling concerns (CSS classes)
- Validation schema rules (test integration, not individual rules)

**Testing route components:**
```typescript
// Mock TanStack Router hooks
const mockUseLoaderData = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useLoaderData: (opts) => mockUseLoaderData(opts),
}));

// Test with different data states
mockUseLoaderData.mockReturnValue({
  league: { id: 1, name: 'Test League' },
});
render(<League />);
```

**Testing route guards:**
Test guard functions directly, not through components:
```typescript
const context = {
  auth: { user: null, loading: false },
  teamContext: { hasTeam: false },
};
await expect(requireAuth(context)).rejects.toThrow();
```

**Mock factories:** Use `createMockTeam`, `createMockDriver` from `@/test-utils` for shared test data.

### Sentry Integration

**File:** `src/main.tsx` (initialized first)

**Default logging approach:** Use `Sentry.logger.*` instead of `console.log`:
```typescript
Sentry.logger.info('Team submitted successfully', { teamId: 123 });
Sentry.logger.warn('API rate limit approaching', { remainingCalls: 50 });
Sentry.logger.error('Failed to load team data', { teamId, error });
```

**Performance tracking:**
```typescript
await Sentry.startSpan(
  { op: 'http.client', name: 'GET /api/teams/123' },
  async () => fetch('/api/teams/123')
);
```

**When to capture exceptions:**
- Unexpected errors in try-catch blocks
- Network/API failures that need investigation
- NOT for validation errors or user cancellations

### Accessibility Standards

**WCAG 2.1 Level AA compliance:**

- **LoadingButton** - Uses `aria-busy="true"` (not `disabled`) to maintain keyboard accessibility
- **LiveRegion** - Screen reader announcements with `aria-live`
- **InlineError** - Uses `role="alert"` for immediate announcement
- **InlineSuccess** - Uses `role="status"` for polite announcement

**Testing accessibility:**
- Keyboard navigation (Tab, Enter, Space)
- Screen reader support (VoiceOver on macOS: ⌘ + F5)
- Focus indicators and ARIA attributes in tests

## Project Structure

```
src/
├── components/          # UI components (with co-located .test.tsx)
│   ├── ui/             # shadcn/ui (NEVER modify directly)
│   ├── auth/           # Authentication components
│   └── [features]/     # Feature-specific components
├── contexts/           # React contexts (AuthContext, TeamContext)
├── contracts/          # TypeScript interfaces (data models)
├── hooks/              # Custom hooks (useAuth, useTeam, useSlots, etc.)
├── lib/                # Core utilities
│   ├── api.ts          # API client
│   ├── supabase.ts     # Supabase client
│   ├── route-guards.ts # Auth/team guards
│   └── router-context.ts # Router context types
├── services/           # API service layer
├── validations/        # Zod schemas for forms
├── test-utils/         # Mock factories & test helpers
├── router.tsx          # All route definitions
├── main.tsx            # App entry point (Sentry init here)
└── InnerApp.tsx        # Router provider wrapper
```

## Key Data Models

**Team:**
```typescript
{
  id: number
  name: string
  ownerName: string
  drivers: TeamDriver[]
  constructors: TeamConstructor[]
}
```

**League:**
```typescript
{
  id: number
  name: string
  description: string
  ownerName: string
  isPrivate: boolean
}
```

## Common Tasks

### Adding a New Route
1. Edit `src/router.tsx`
2. Add route to appropriate parent (use `_authenticated` layout for protected routes)
3. Use `beforeLoad` with `requireAuth` or `requireTeam` as needed
4. Add loader function if data is needed
5. Create component file
6. Add to routeTree

### Making API Calls
1. Create service function in `src/services/[domain]Service.ts`
2. Use `apiClient.get/post/patch/delete` from `@/lib/api`
3. Return `null` on 404, throw on other errors
4. Add Sentry logging for significant events

### Creating Forms
1. Define Zod schema in `src/validations/[feature]Schema.ts`
2. Use React Hook Form with `zodResolver`
3. Display errors with `InlineError` component
4. Use `LoadingButton` for submit button with `aria-busy`

### Testing Components
1. Create `ComponentName.test.tsx` co-located with component
2. Use `@testing-library/react` and `@testing-library/user-event`
3. Mock router hooks (`useLoaderData`, `useNavigate`) if needed
4. Test user behavior, not implementation
5. Run `npm run test:coverage` to verify coverage

## Environment Variables

Required in `.env.local`:
```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_F1_FANTASY_API=your_api_base_url
VITE_SENTRY_DSN=your_sentry_dsn
```

## Path Aliases

- `@/` maps to `src/` directory
- Always use absolute imports: `import { Button } from '@/components/ui/button'`

## Development Principles

1. **Type Safety First** - Leverage TypeScript fully; use Zod for runtime validation
2. **Test Behavior, Not Implementation** - Focus on what users see and do
3. **Component Composition** - Build reusable, composable components
4. **Separation of Concerns** - UI, business logic, and data access are separate
5. **Accessibility First** - WCAG 2.1 Level AA compliance is mandatory
6. **Avoid Over-Engineering** - Only make changes directly requested or clearly necessary
7. **No Backwards-Compatibility Hacks** - Delete unused code completely
