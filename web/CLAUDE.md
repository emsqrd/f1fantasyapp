# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

F1 Fantasy Sports platform built with React 19, TypeScript, and Vite. Users build fantasy F1 teams, join leagues, and earn points based on real race performance. Uses Supabase for authentication and TanStack Router for type-safe routing.

Run all tooling via root `npm run web:*` scripts (see root `CLAUDE.md`). `shadcn/ui` primitives in `src/components/ui/` are vendored — never modify directly.

## Architecture Patterns

### Routing Structure

**File:** `src/router.tsx`

TanStack Router uses **guard-based route protection** with pathless layout routes (underscore prefix). Guards live in `src/lib/route-guards.ts` and run in `beforeLoad` to redirect unauthorized access. Route loaders fetch data before rendering. Route params are validated with Zod. See `router.tsx` for production examples.

### Authentication Flow

**Files:** `src/lib/authStore.ts`, `src/lib/supabase.ts`, `src/hooks/useAuth.ts`

- Auth state lives in a module-level store (`authStore.ts`), written synchronously inside Supabase's `onAuthStateChange`; `main.tsx` calls `initAuthStore()` once. There is no AuthProvider.
- Components read it via `useAuth()` (backed by `useSyncExternalStore`): `user`, `session`, `loading`, `signIn`, `signUp`, `signOut`
- Supabase awaits its auth listeners, so the store is already current when `signIn()`/`signOut()` resolve
- Route guards check auth state before allowing navigation
- `InnerApp.tsx` waits for `auth.loading` to complete before rendering routes

### State Management

**Pattern:** Put state where its reader reaches it. If a guard or loader needs it, it goes in **router context** — `beforeLoad`/`loader` run outside React and can't read a React context. If the component tree needs it, it goes in a **React context**, which distributes app-wide values (auth, theme) down the tree. Auth needs both.

The user's team lives in router context (`context.team`, fetched by the root `beforeLoad`) — the single source of truth, deliberately not a React context.

### API/Service Layer

**File:** `src/lib/api.ts`

Centralized `ApiClient` class handles all HTTP requests:

- Automatically injects Supabase JWT in Authorization header
- Consistent error handling with Sentry integration
- Optional `errorContext` parameter for better error messages

**Service modules** (in `src/services/`) wrap apiClient. **Pattern:** services return `null` on 404 and throw on other errors.

### Data Loading Pattern

Route loaders fetch data before the component renders, so components read via `Route.useLoaderData()` without loading states. Loaders throw `notFound({ routeId })` on missing resources; the route's `errorComponent` handles the failure path.

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
   - Do not mock children to "test wiring." If you find yourself mocking a child component, a service module, a context, or a hook the component owns, you're describing integration territory — write that test in `src/tests/integration/` against MSW instead.

2. **Hooks** (`useLineupPicker`, `useAvatarUpload`, `useLiveRegion`)
   - Use a direct hook test only when the hook has enough internal logic (state machine, async branches, error rollback) that testing through a consumer would mean more setup than assertions.
   - Trivial passthroughs (`useAuth`) are honestly covered by integration tests of their consumers — don't add a direct test just to assert "context returns context."

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
const context = { auth: { user: null, loading: false }, team: null };
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

- Pass a complete `Auth` value to `renderWithRouter`. The helper seeds the auth store with it (for component-tree consumers like `useAuth`) and passes the same value to the router context (for guards like `requireAuth`).
- `apiClient` reads its bearer token from `supabase.auth.getSession()`, not from the auth store. With no real Supabase session in tests, no `Authorization` header is sent — handlers must not assert on it. If a future test needs a real bearer header, seed the Supabase client's session at that point; don't pre-build that machinery now.

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
  routerContext: { team: null, profile: null, currentSeason: null },
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
