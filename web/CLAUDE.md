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

**Layers — each owns its own responsibilities:**

1. **Leaf / presentational components** (`ConstructorCard`, `DriverCard`, list items)
   - User interactions, callback invocations, conditional rendering by props.

2. **Hooks** (`useLineupPicker`, `useAuth`)
   - Business logic, state management, API integration (with mocked services), error handling.

3. **Container / parent components** (`DriverPicker`, `ConstructorPicker`)
   - Unique transformation logic, wiring (does hook state drive UI?), composition (are callbacks wired through?), container-level accessibility (dialog roles, semantic structure).
   - **Do not** re-test child-component behavior or hook logic already covered at layers 1 and 2.

**Evaluating missing coverage:** before adding a test, check whether the behavior is already covered at a different layer. Parent components with mocked hooks are testing wiring, not duplicating hook tests.

**Frontend-specific do-not-test list** (in addition to root anti-patterns):

- Third-party library internals (React Hook Form, Radix, shadcn/ui primitives).
- Basic UI primitives (Button, Card, Sheet) — trust the library.
- Static JSX (headings, labels) unless position/order matters.
- Styling / CSS classes.
- Individual Zod schema rules — test them through form integration.

**Testing route components** — mock TanStack Router hooks:

```typescript
const mockUseLoaderData = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useLoaderData: (opts) => mockUseLoaderData(opts),
}));

mockUseLoaderData.mockReturnValue({ league: { id: 1, name: 'Test League' } });
render(<League />);
```

**Testing route guards** — call guard functions directly, not through components:

```typescript
const context = { auth: { user: null, loading: false }, teamContext: { hasTeam: false } };
await expect(requireAuth(context)).rejects.toThrow();
```

**Mock factories:** `createMockTeam`, `createMockDriver` from `@/tests/test-utils`.

**Reference docs** (RTL, Vitest, TanStack Router testing): `/testing-library/react-testing-library`, `/vitest-dev/vitest`, `/facebook/react`, `/tanstack/router`.

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
