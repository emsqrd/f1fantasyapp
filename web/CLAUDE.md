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
npm run format:check     # Check Prettier formatting (enforced by pre-commit)
npx prettier --write .   # Auto-fix formatting issues
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

TanStack Router uses **guard-based route protection** with pathless layout routes (underscore prefix). Guards live in `src/lib/route-guards.ts` and run in `beforeLoad` to redirect unauthorized access. Route loaders fetch data before rendering. Route params are validated with Zod.

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
export async function getMyTeam(): Promise<Team | null>;
export async function createTeam(data): Promise<Team>;

// leagueService.ts
export async function getMyLeagues(): Promise<League[]>;
export async function getLeagueById(id): Promise<League | null>;
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

### Frontend Test Layering

See root `CLAUDE.md` `## Testing Strategy` for cross-cutting rules (unit vs integration vs E2E, anti-patterns). This section covers frontend-specific layering within the unit/component-test level.

**Files:** `src/setupTests.ts`, `src/tests/test-utils/mockFactories.ts`

**Two layers at the jsdom level:**

1. **Leaf / presentational components** (`ConstructorCard`, `DriverCard`, list items, form fields, picker components when rendered with their real children)
   - Props in, DOM out. User interactions, callback invocations, conditional rendering by props, accessibility attributes.
   - Do not mock children to "test wiring." If you find yourself mocking a child component or a hook the component owns, you're describing integration territory — write that test in `src/tests/integration/` against MSW instead.

2. **Hooks** (`useLineupPicker`, `useAvatarUpload`, `useLiveRegion`)
   - Use a direct hook test only when the hook has enough internal logic (state machine, async branches, error rollback) that testing through a consumer would mean more setup than assertions.
   - Trivial passthroughs (`useAuth`, `useTeam`) are honestly covered by integration tests of their consumers — don't add a direct test just to assert "context returns context."

**Container / parent components are not a separate layer.** Their behavior — hook-state drives UI, callbacks wired through children, dialog roles, multi-component round-trips — belongs in the integration layer where the real hook and real children run together. Mocking a hook to assert "given hook state X, render UI Y" is shallow rendering by another name; it ties tests to implementation and doesn't catch the wiring bugs it claims to.

**Heuristic:** if the setup is longer than the assertions, the test is probably in the wrong layer.

**Frontend-specific do-not-test list** (in addition to root anti-patterns):

- Third-party library internals (React Hook Form, Radix, shadcn/ui primitives).
- Basic UI primitives (Button, Card, Sheet) — trust the library.
- Static JSX (headings, labels) unless position/order matters.
- Styling / CSS classes.
- Individual Zod schema rules — test them through form integration.

**Route components belong in the integration layer.** Mounting a route component with `vi.mock('@tanstack/react-router', ...)` to stub `useLoaderData`/`useNavigate` decouples the test from the very wiring (loader → component, guard → redirect) that integration tests exist to verify. Build a per-test route tree in `src/tests/integration/<flow>.integration.test.tsx` instead — see "Frontend Integration Tests" below.

**Unit-testing route guards** — call guard functions directly, not through components. (Integration tests cover guard wiring by mounting layouts with the real guard attached — see "Frontend Integration Tests" below.)

```typescript
const context = { auth: { user: null, loading: false }, teamContext: { hasTeam: false } };
await expect(requireAuth(context)).rejects.toThrow();
```

**Mock factories:** `createMockTeam`, `createMockDriver` from `@/tests/test-utils`.

**Reference docs** (RTL, Vitest, TanStack Router testing): `/testing-library/react-testing-library`, `/vitest-dev/vitest`, `/facebook/react`, `/tanstack/router`.

### Frontend Integration Tests

See root `CLAUDE.md` `## Testing Strategy` for when to reach for this layer vs. unit vs. E2E. This section covers the local conventions.

**Location:** `src/tests/integration/<flow>.integration.test.tsx`. Name files by user flow (`account`, `create-team`, `join-league`), not by component.

**Run:** `npm run web:test:integration` (focused) or `npm run web:test` (full suite).

**Stack:** Vitest + jsdom + MSW intercepting at the `fetch` boundary. Tests exercise the real router, real loaders, real components, and the real `apiClient` — only the network is mocked. The MSW server is exported from `setupTests.ts` as `server`, runs in strict mode (`onUnhandledRequest: 'error'`), and resets handlers after each test.

**Reference test:** `src/tests/integration/account.integration.test.tsx`. Copy its shape for new flows.

**Route trees:**

- Build per-test with `createRootRouteWithContext<RouterContext>()` so production guards can read context the same way they do in `router.tsx`.
- Wire the real guards (`requireAuth`, `requireTeam`) on layout routes — don't drop them. Auth must flow through both the React tree and the router context; `renderWithRouter` handles both from a single `auth` value.
- Production routes in `router.tsx` are not exported, so mirror the loader / component / errorComponent inline for the route under test. Keep this mirror minimal — only what the test needs to mount.

**Auth:**

- Pass a complete `AuthContextType` value to `renderWithRouter`. The helper provides it to `AuthContext.Provider` (for component-tree consumers like `useAuth`) and to the router context (for guards like `requireAuth`).
- `apiClient` reads its bearer token from `supabase.auth.getSession()`, not from `AuthContext`. With no real Supabase session in tests, no `Authorization` header is sent — handlers must not assert on it. If a future test needs a real bearer header, seed the Supabase client's session at that point; don't pre-build that machinery now.

**MSW handlers:**

- Build URLs from `API_BASE` exported by `setupTests.ts`: ``http.get(`${API_BASE}/me/profile`, ...)``. Don't hardcode the base.
- Declare handlers per test via `server.use(...)`. There are no shared default handlers today, on purpose — strict mode forces every test to spell out its network surface.
- **Trigger to extract a default:** when you find yourself copy-pasting the same handler across three or more flow tests (likely `/me/profile`, `/me/team`, `/seasons/current` once authenticated flows accumulate), introduce `src/mocks/handlers.ts` + `src/mocks/server.ts`, seed the duplicates as defaults, and let tests override per-flow with `server.use(...)`. Until that trigger fires, keep handlers per-test.
- **Don't introduce per-service path constants** (e.g. `USER_PROFILE_PATH = '/me/profile'`). The service module is already the single source of truth for each path. Strict-mode MSW reports the exact unhandled URL on a typo or rename, so drift is caught loudly — constants would just add a second place to maintain.
- For 4xx/5xx, use `new HttpResponse(null, { status })`. For success bodies, use `HttpResponse.json(factoryOutput)` so the response shape is typed via the factory.

**`renderWithRouter` signature:** `routeTree`, `initialEntry`, `auth`, `routerContext` (the latter is `Omit<RouterContext, 'auth'>` — `auth` is wired automatically from the `auth` field).

```typescript
renderWithRouter({
  routeTree: buildAccountRouteTree(),
  initialEntry: '/account',
  auth: authedAuth,
  routerContext: { teamContext, team: null, profile: null, currentSeason: null },
});
```

**Don't `vi.mock('@tanstack/react-router', ...)` or `vi.mock('@/services/...', ...)` in this layer.** Those mocks belong in component-level tests; mocking them here defeats the point of the layer.

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
await Sentry.startSpan({ op: 'http.client', name: 'GET /api/teams/123' }, async () =>
  fetch('/api/teams/123'),
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
├── tests/              # Integration tests + shared test helpers (test-utils/)
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
  id: number;
  name: string;
  description: string;
  ownerName: string;
  isPrivate: boolean;
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

For unit/component-level tests (cross-flow integration goes in `src/tests/integration/` — see "Frontend Integration Tests" above).

1. Create `ComponentName.test.tsx` co-located with component
2. Use `@testing-library/react` and `@testing-library/user-event`
3. Mock router hooks (`useLoaderData`, `useNavigate`) if needed
4. Test user behavior, not implementation
5. Run `npm run test:coverage` to verify coverage

### Quick Test Generation Workflows

**For new test files** (no existing tests):

```
Generate high-value tests for this file following our testing guidelines.
- Keep it lean (~10-15 tests)
- After writing tests, review for duplicate assertions or test cases
- Run all tests to ensure they pass
- Run the linter to ensure there are no linting errors
- Run the build to ensure no type errors
- Run code coverage and ensure that coverage is at an excellent level
- Verify all tests provide high value per our testing philosophy
```

**For existing test files** (adding new tests):

```
Add tests for the new [describe feature/functionality] following our testing guidelines.
- Review existing tests to understand current coverage and patterns
- Add only tests for the new functionality, avoiding duplicates
- Follow the existing test file's naming conventions and organization
- Run tests to ensure they pass alongside existing tests
- Verify new tests cover the added functionality
```

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
