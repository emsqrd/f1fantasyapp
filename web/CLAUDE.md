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

**Pattern:** Put state where its reader reaches it. `beforeLoad`/`loader` run outside React, so anything a guard or loader needs goes in **router context** — `{ auth, queryClient }`. `auth` is a live view over the auth store (reads evaluate at guard/loader execution time, never a render-time copy); `queryClient` reaches the TanStack Query cache, where reads live — each defined as a `queryOptions` in its service module. The component tree reads the same sources through hooks: `useAuth()` for the store, `useQuery`/`useSuspenseQuery` for the cache.

### API/Service Layer

**File:** `src/lib/api.ts`

Centralized `ApiClient` class handles all HTTP requests:

- Automatically injects Supabase JWT in Authorization header
- Consistent error handling with Sentry integration
- Optional `errorContext` parameter for better error messages

**Service modules** (in `src/services/`) wrap apiClient. **Pattern:** services return `null` on 404 and throw on other errors.

### Data Loading Pattern

**TanStack Query is the single read store** (ADR 009). Every read is defined once as `queryOptions` in a per-resource `…Queries` factory in its service module, structured most-generic to most-specific: an `all` base key, then one member per read — named for the read, its key extending `all`.

How a read is consumed:

- **Loader-guaranteed reads** — a guard or loader primes the read with `context.queryClient.ensureQueryData(...)`, which blocks and returns nothing; the component reads `useSuspenseQuery(...)` with no loading state of its own.
- **Independent reads** — a component issues the read with `useQuery`, not loader-primed. Use for data that loads or fails independently of its route, renders for anonymous users (`useQuery({ ...profileQueries.current(), enabled: !!user })`), or whose key isn't known until render (dialogs, typeahead, pagination).

Loaders prime the cache; they do not return fetched data, and components do not read `useLoaderData` for it. Whether a surface blocks on a read or streams it in is a separate, load-strategy question (ADR 008), independent of where the data lives — both read through the Query cache.

> **Migration in progress:** some routes still return data from their loaders and read `useLoaderData` (pre-ADR-009). Treat the rule above as the target for new and changed reads; pre-existing loader-data reads migrate incrementally.

**Writes** that change a query-cached resource use `useMutation` and reconcile the cache via `invalidateQueries` in `onSuccess`/`onSettled`. Optimistic writes additionally snapshot + `setQueryData` in `onMutate` with an `onError` rollback (see `useSetCaptain`). Invalidate with `invalidateQueries`, not `router.invalidate()` — the latter only re-runs loaders, and `ensureQueryData` then serves the stale cache entry, so it won't refresh these reads.

Loaders throw `notFound({ routeId })` on missing resources; the route's `errorComponent` handles the failure path.

### Loading-state representation

How a wait is shown:

- **Skeleton** when the layout is predictable — mirror it to reserve the box (no layout shift); use the vendored `Skeleton` primitive.
- **Spinner** when the shape is unknown or the content is trivial.
- **Nothing** when the wait is sub-threshold — a fast load shouldn't flash a loader.

Delay-gating the loader avoids that flash: route loaders get it from `pendingMs`/`pendingMinMs`.

### Error Handling

**Multi-level error boundary strategy:**

- **React 19 error handlers** in `main.tsx` - `onUncaughtError`, `onCaughtError`, `onRecoverableError`
- **ErrorFallback** - User-friendly fallback UI
- **ErrorState** - Full-page error display for data failures
- **InlineError** - Form validation/submission errors
- **Route errorComponent** - Handles loader/guard errors

**When to use:**

- Toasts: Background operations only (e.g., avatar uploads)
- InlineError: Form errors, validation failures
- ErrorState: Page-level data fetching failures

### Frontend Test Layering

See root `CLAUDE.md` `## Testing Strategy` for cross-cutting rules (unit vs integration vs E2E, anti-patterns). This section covers frontend-specific layering within the unit/component-test level.

**Decide the layer by the boundary a test crosses.** A component test runs in jsdom, renders real children and real hooks, and supplies whatever providers the component needs to render (a `QueryClient`, theme); it makes no network call and runs none of a route's loader, guards, or navigation. An integration test crosses a boundary: the network (stubbed with MSW), or a real route tree running its loader, guards, and navigation.

**Files:** `src/setupTests.ts`, `src/tests/test-utils/mockFactories.ts`

**Two layers at the jsdom level:**

1. **Leaf / presentational components** (`ConstructorCard`, `DriverCard`, list items, form fields, picker components when rendered with their real children)
   - Props in, DOM out. User interactions, callback invocations, conditional rendering by props, accessibility attributes.
   - Do not mock children to "test wiring." If you find yourself mocking a child component, a service module, a context, or a hook the component owns, you're describing integration territory — write that test in `src/tests/integration/` against MSW instead.

2. **Hooks** (`useLineupPicker`, `useAvatarUpload`, `useLiveRegion`)
   - Use a direct hook test only when the hook has enough internal logic (state machine, async branches, error rollback) that testing through a consumer would mean more setup than assertions.
   - Trivial passthroughs (`useAuth`) are honestly covered by integration tests of their consumers — don't add a direct test just to assert "context returns context."

**Heuristic:** if the setup is longer than the assertions, the test is probably in the wrong layer.

**Frontend-specific do-not-test list** (in addition to root anti-patterns):

- Third-party library internals (React Hook Form, Radix, shadcn/ui primitives).
- Basic UI primitives (Button, Card, Sheet) — trust the library.
- Static JSX (headings, labels) unless position/order matters.
- Styling / CSS classes.
- Zod schema rules in isolation — exercise them through the real form (render, type, submit, assert the error or payload).

**Route components belong in the integration layer.** Mounting a route component with `vi.mock('@tanstack/react-router', ...)` to stub `useLoaderData`/`useNavigate` decouples the test from the very wiring (loader → component, guard → redirect) that integration tests exist to verify. Build a per-test route tree in `src/tests/integration/<flow>.integration.test.tsx` instead — see "Frontend Integration Tests" below.

**Unit-testing route guards** — call guard functions directly, not through components. (Integration tests cover guard wiring by mounting layouts with the real guard attached — see "Frontend Integration Tests" below.)

```typescript
const context = { auth: { user: null }, queryClient: new QueryClient() };
expect(() => requireAuth(context)).toThrow();
```

**Mock factories:** `createMockTeam`, `createMockDriver` from `@/tests/test-utils`.

**Reference docs** (RTL, Vitest, TanStack Router testing): `/testing-library/react-testing-library`, `/vitest-dev/vitest`, `/facebook/react`, `/tanstack/router`.

### Frontend Integration Tests

See root `CLAUDE.md` `## Testing Strategy` for when to reach for this layer vs. unit vs. E2E. This section covers the local conventions.

**Location:** `src/tests/integration/<flow>.integration.test.tsx`. Name files by user flow (`account`, `create-team`, `join-league`), not by component.

**Run:** `npm run web:test:integration` (focused) or `npm run web:test` (full suite).

**Stack:** Vitest + jsdom + MSW intercepting at the `fetch` boundary. Tests exercise the real router, real loaders, real components, and the real `apiClient` — only the network is mocked. The MSW server lives in `src/mocks/server.ts` with the shared default handlers in `src/mocks/handlers.ts` (tests import `server` / `API_BASE` from the `@/mocks` barrel); it runs in strict mode (`onUnhandledRequest: 'error'`) and resets handlers after each test.

**Reference test:** `src/tests/integration/account.integration.test.tsx`. Copy its shape for new flows.

**Route trees:**

- Build per-test with `createRootRouteWithContext<RouterContext>()` so production guards can read context the same way they do in `router.tsx`.
- Wire the real guards (`requireAuth`, `requireTeam`) on layout routes — don't drop them. Auth must flow through both the React tree and the router context; `renderWithRouter` handles both from a single `auth` value.
- Production routes in `router.tsx` are not exported, so mirror the loader / component / errorComponent inline for the route under test. Keep this mirror minimal — only what the test needs to mount.

**Auth:**

- Pass a complete `Auth` value to `renderWithRouter`. The helper seeds the auth store with it (for component-tree consumers like `useAuth`) and passes the same value to the router context (for guards like `requireAuth`).
- `apiClient` reads its bearer token from `supabase.auth.getSession()`, not from the auth store. With no real Supabase session in tests, no `Authorization` header is sent — handlers must not assert on it. If a future test needs a real bearer header, seed the Supabase client's session at that point; don't pre-build that machinery now.

**MSW handlers:**

- Build URLs from `API_BASE` exported by `@/mocks`: ``http.get(`${API_BASE}/me/profile`, ...)``. Don't hardcode the base.
- **Defaults cover the cross-route reads** every authenticated tree touches: `src/mocks/handlers.ts` seeds `/me/profile` (a profile with `hasTeam: false`), `/me/team` (404 — no team), and `/seasons/current`. They model a freshly-authenticated user without a team; a test mounting a `_team-required` route overrides `/me/team` with a present team via `server.use(...)`.
- Declare everything else per test via `server.use(...)` — strict mode forces each test to spell out the rest of its network surface. Promote a handler to a default only once it's copy-pasted across three or more flow tests.
- **Don't introduce per-service path constants** (e.g. `USER_PROFILE_PATH = '/me/profile'`). The service module is already the single source of truth for each path. Strict-mode MSW reports the exact unhandled URL on a typo or rename, so drift is caught loudly — constants would just add a second place to maintain.
- For 4xx/5xx, use `new HttpResponse(null, { status })`. For success bodies, use `HttpResponse.json(factoryOutput)` so the response shape is typed via the factory.

**`renderWithRouter` signature:** `routeTree`, `initialEntry`, and `auth` (`auth` and `queryClient` are wired into router context automatically). The helper creates a fresh per-test `QueryClient`, wraps the tree in its provider, and returns it, so tests can seed or assert the Query cache directly (e.g. `queryClient.setQueryData(teamQueries.mine().queryKey, mockTeam)`).

```typescript
const { queryClient } = renderWithRouter({
  routeTree: buildAccountRouteTree(),
  initialEntry: '/account',
  auth: authedAuth,
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

## Path Aliases

- `@/` maps to `src/` directory
- Always use absolute imports: `import { Button } from '@/components/ui/button'`
