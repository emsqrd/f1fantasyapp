# Plan: Frontend Integration Test Layer (#134)

## Context

The frontend test suite today catches unit-level bugs cleanly (`vi.mock()` at the hook / router / service-module boundary) and the new Playwright suite (#131) covers full-stack journeys. A class of bugs sits between them with no natural home: route guard + loader + component + form + mutation wiring against varied API response shapes (errors, validation, edge payloads), and UX enforcement of business rules. The recent constructor-uniqueness drift bug — backend rule changed, frontend didn't, prod shipped bad UX — is exactly the failure mode this layer should make natural to catch.

The work stands up that layer using Vitest + jsdom (already in place) plus MSW at the network seam. The deliverable is the plumbing plus one reference integration test against the `/account` flow — the smallest authenticated flow in the app, useful as both validation that the wiring works and the pattern future flow tests copy.

## Validated facts (state of the repo on 2026-04-25)

- **MSW is NOT installed** — it appears in `web/package-lock.json` only as a transitive lockfile reference, not in `web/package.json` `devDependencies`, and `web/node_modules/msw` does not exist. `npm i -D msw` is required.
- **No `public/mockServiceWorker.js`** in `web/public/` (only `_redirects`, `f1_fantasy_favicon.svg`, `vite.svg`). Confirmed nothing to clean up.
- **No `web/src/tests/` directory** yet.
- **`web/src/setupTests.ts`** already stubs `VITE_F1_FANTASY_API` to `http://localhost/api` — MSW handlers should target that origin.
- **`web/vite.config.ts`** already excludes `src/setupTests.ts`, `src/test-utils`, `src/main.tsx`, `src/router.tsx` from coverage. The `src/test-utils` entry will be replaced by `src/tests/**` (covers both the moved helpers and the integration suite).
- **Account component:** `web/src/components/Account/Account.tsx` reads loader data via `getRouteApi('/_authenticated/account').useLoaderData()` (lines 31–34). **Implication:** the test's route tree must produce that exact route ID — a `_authenticated` pathless layout with an `account` child — or the lookup throws. Reusing the production `accountRoute` definition is the simplest way to guarantee ID stability.
- **`/account` route** in `web/src/router.tsx` (lines 303–328): child of `authenticatedLayoutRoute`, loader calls `userProfileService.getCurrentProfile()`, `errorComponent` wraps `ErrorFallback` (renders `"Something went wrong"` heading — usable assertion).
- **`userProfileService.getCurrentProfile()`** (`web/src/services/userProfileService.ts`) hits `GET /me/profile` via the real `apiClient`.
- **`apiClient`** (`web/src/lib/api.ts`) reads `VITE_F1_FANTASY_API` for the base URL and pulls the bearer token from `supabase.auth.getSession()` — not from `AuthContext`. In tests with no real Supabase session, `session` is null and no `Authorization` header is sent. Handlers must not assert on it.
- **`AuthContextType`** (`web/src/contexts/AuthContext.ts`) has 9 fields: `user`, `session`, `loading`, `isAuthTransitioning`, `signIn`, `signUp`, `signOut`, `startAuthTransition`, `completeAuthTransition`. `renderWithRouter` callers must supply a complete value (function fields can be `vi.fn()`).
- **Existing route-component tests** mock `vi.mock('@tanstack/react-router', () => ({ getRouteApi: () => ({ useLoaderData: mockLoaderData }) }))`. The new layer deliberately doesn't do that — that's the whole point.
- **Root `package.json`** delegates to web via `web:*` scripts (`web:test`, `web:test:watch`, `web:coverage`). No `web:test:integration` exists yet.

## Commits

Each commit is self-contained — passes build, lint, format, tests on its own. Wait for approval between commits.

---

### Commit 1 — Install MSW and wire it into `setupTests.ts`

Stand up the global MSW server in strict mode. Existing tests must continue to pass because none of them reach the real fetch boundary (they all mock above it).

**Changes:**

- `web/package.json`: `npm i -D msw` from inside `web/` (run via `npm run web:install` workflow). **Do not** run `npx msw init`.
- `web/src/setupTests.ts`: import `setupServer` from `msw/node`, instantiate and export `server = setupServer()` (no default handlers), and add lifecycle hooks alongside the existing `cleanup()` afterEach:
  - `beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))`
  - `afterEach(() => server.resetHandlers())`
  - `afterAll(() => server.close())`

**Verification:**

- `npm run web:test` — full suite passes; the existing 53 test files continue to pass under strict-mode global server.
- `npm run web:lint && npm run web:format:check && npm run web:build` — clean.

---

### Commit 2 — Add `renderWithRouter` harness, `createMockUserProfile` factory, and coverage exclusion

Provide the test-utils all integration tests will lean on, plus the coverage tweak so test-only files don't pollute the report.

**Changes:**

- `web/src/tests/test-utils/renderWithRouter.tsx` (new) — exports `renderWithRouter({ routes, initialEntry, auth })`:
  - `routes` is a route tree (root + descendants). Internally builds the router via `createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [initialEntry] }) })`.
  - Wraps `RouterProvider` in `AuthContext.Provider value={auth}`.
  - Returns RTL's `render(...)` result so callers can use `screen`, `findByRole`, etc.
  - `auth` is typed as `AuthContextType`. Callers supply the full shape; helper does not provide defaults — keeps the harness honest about what each test is asserting.
- `web/src/tests/test-utils/mockFactories.ts` — add `createMockUserProfile(overrides: Partial<UserProfile> = {}): UserProfile` returning sensible defaults aligned with the existing factory pattern. Match the `UserProfile` contract: `id`, `email`, `firstName`, `lastName`, `displayName`, `avatarUrl`.
- `web/src/tests/test-utils/index.ts` — re-export `renderWithRouter` and `createMockUserProfile`.
- Move pre-existing `web/src/test-utils/` → `web/src/tests/test-utils/` so `tests/` holds both the integration suite and shared helpers as siblings (otherwise `tests/` would have a single `integration/` child). Rewrites `@/test-utils` → `@/tests/test-utils` across the existing 21 import sites.
- `web/vite.config.ts` — replace the now-redundant `'src/test-utils'` coverage exclude with `'src/tests/**'` (covers both helpers and the integration suite).

**Verification:**

- `npm run web:test` — full suite still passes. New helpers are unused at this point but compile.
- `npm run web:build` — type-check clean.

---

### Commit 3 — Reference integration test for `/account`

The `/account` flow validates the layer end-to-end. Real `Account` + real `userProfileService` + real `apiClient` + MSW + real router. No `vi.mock` of `@tanstack/react-router`, no service-module mock.

**Constraint:** the `Account` component looks up loader data with `getRouteApi('/_authenticated/account')`. The test must reproduce that route ID. Cleanest approach: import `authenticatedLayoutRoute` and `accountRoute` from `web/src/router.tsx` and compose them as children of a fresh `createRootRoute()`. That guarantees the full route ID `/_authenticated/account` matches what the component asks for, and the test exercises the production loader/component/errorComponent wiring as written. (If `authenticatedLayoutRoute`'s `beforeLoad: requireAuth` blocks rendering during the test because router context isn't authenticated, fall back to defining a local pathless `createRoute({ id: '_authenticated', ... })` layout without the guard, then reuse `accountRoute`'s loader, component, and errorComponent inline. Pick whichever works; auth is a precondition at the React level via `AuthContext.Provider`, not the route-context level, per the issue.)

**File:** `web/src/tests/integration/account.integration.test.tsx`

**Cases:**

1. **Stub success** — `server.use(http.get('http://localhost/api/me/profile', () => HttpResponse.json(createMockUserProfile({ displayName: 'Ada Lovelace' }))))`. Render with `renderWithRouter({ routes: <accountRouteTree>, initialEntry: '/account', auth: authedAuth })`. Assert `findByDisplayValue('Ada Lovelace')` (or another visible profile field) appears — proves loader → component data flow.
2. **500 error path** — `server.use(http.get('http://localhost/api/me/profile', () => new HttpResponse(null, { status: 500 })))`. Render same harness. Assert `findByRole('heading', { name: /something went wrong/i })` appears — proves the route's `errorComponent` (ErrorFallback) renders on loader failure.

**Auth value:** build a `mockAuthContext: AuthContextType` with `user`, `session` populated as `{} as User` / `{} as Session` (the test only needs the React-level precondition; apiClient reads its token from supabase, not auth context), `loading: false`, `isAuthTransitioning: false`, and the four function fields as `vi.fn()`. Reuse the pattern already in `Account.test.tsx` lines 74–84.

**Verification:**

- `npm run web:test` — new test passes alongside the existing suite. No regressions.
- Manually toggle the success-handler URL to a wrong path — confirm the test fails with MSW's "unhandled request" error pointing at `http://localhost/api/me/profile`. This proves strict mode is active and the assertion isn't a false positive.

---

### Commit 4 — Document the layer and add the optional script

Make the convention discoverable and give focused-iteration ergonomics for writing a single flow test.

**Changes:**

- `web/CLAUDE.md` — add a section under `### Frontend Test Layering` (or as a sibling section, "Frontend Integration Tests"):
  - Layer location: `src/tests/integration/<flow>.integration.test.tsx`.
  - Naming: by user flow, not by component or page.
  - The `renderWithRouter` helper signature and a one-paragraph example.
  - When to reach for it vs. unit vs. E2E (mirror the framing in root `CLAUDE.md` `## Testing Strategy` — don't restate the table).
  - Auth as React-level precondition only — `AuthContext.Provider` is for component-tree auth checks; `apiClient` pulls its bearer token from `supabase.auth.getSession()`, so handlers should not assert on `Authorization`.
  - Mock at the network layer (MSW), not at service modules.
  - Per-test handler overrides via `server.use(...)` from the exported `server` in `setupTests.ts`.
- `web/package.json` — add `"test:integration": "vitest run src/tests/integration"`.
- Root `package.json` — add `"web:test:integration": "cd web && npm run test:integration"`.

**Verification:**

- `npm run web:test:integration` — runs only the new integration test, passes.
- `npm run web:test` — still picks up the integration test (Vitest's default include matches `.test.tsx`), full suite passes.
- `npm run web:format:check` and prettier on the CLAUDE.md change — clean.

---

## Out of scope (per issue)

- Migrating existing unit tests into the layer (#133).
- Other feature integration tests beyond `/account` reference (those come with feature work).
- Splitting Vitest into separate unit / integration projects.
- Replacing `vi.mock()` in existing unit tests with MSW.
- Seeding Supabase client's internal session for `Authorization`-header assertions — defer until a test needs it.
- Fixing the root loader's three-call precondition — sidestepped by per-test minimal route trees.

## Critical files

- `web/package.json` — add msw devDep, add `test:integration` script.
- `web/src/setupTests.ts` — extend with MSW server + lifecycle.
- `web/src/tests/test-utils/renderWithRouter.tsx` — new harness.
- `web/src/tests/test-utils/mockFactories.ts` — add `createMockUserProfile`.
- `web/src/tests/test-utils/index.ts` — re-export.
- `web/vite.config.ts` — coverage exclude `src/tests/**`.
- `web/src/tests/integration/account.integration.test.tsx` — new reference test.
- `web/CLAUDE.md` — document the layer.
- Root `package.json` — add `web:test:integration` delegate.

## End-to-end verification

After all four commits land:

1. `npm run web:test` — full suite (existing + new integration) passes.
2. `npm run web:test:integration` — integration suite alone passes.
3. `npm run web:build && npm run web:lint && npm run web:format:check` — clean.
4. `npm run web:coverage` — `src/tests/**` does not appear in the coverage report.
5. `ls web/public` — confirm no `mockServiceWorker.js` was generated.
6. Quick negative test: temporarily change the MSW success handler URL in the account test to a wrong path; confirm Vitest reports an MSW "unhandled request" error pointing at `http://localhost/api/me/profile`. Revert.
