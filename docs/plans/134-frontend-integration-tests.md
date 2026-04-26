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

- `web/src/tests/test-utils/renderWithRouter.tsx` (new) — exports `renderWithRouter({ routeTree, initialEntry, auth })`:
  - `routeTree` is a route tree (root + descendants). Internally builds the router via `createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [initialEntry] }) })`.
  - Wraps `RouterProvider` in `AuthContext.Provider value={auth}`.
  - Returns RTL's `render(...)` result so callers can use `screen`, `findByRole`, etc.
  - `auth` is typed as `AuthContextType`. Callers supply the full shape; helper does not provide defaults — keeps the harness honest about what each test is asserting.
  - **Note:** the harness gains a required `routerContext: Omit<RouterContext, 'auth'>` option in commit 3 once we wire production guards. Originally added without it; revised before commit 3 landed because guard wiring needs router-context auth.
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

**Constraint:** the `Account` component looks up loader data with `getRouteApi('/_authenticated/account')`. The test must reproduce that route ID.

**Approach taken:** the production `authenticatedLayoutRoute` and `accountRoute` are not exported from `web/src/router.tsx`, so we mirror them inline. The test builds a route tree with `createRootRouteWithContext<RouterContext>()`, a pathless `_authenticated` layout that runs the **real** `requireAuth` guard, and an `account` child whose `loader`, `component`, and `errorComponent` mirror `accountRoute`. This reproduces the production wiring (guard → loader → component → errorComponent) end-to-end. Reusing the production routes directly would have required exporting them from `router.tsx` solely for tests, which has its own smell.

**`renderWithRouter` extension:** the helper accepts a required `routerContext: Omit<RouterContext, 'auth'>` so `auth` flows to both the React tree (via `AuthContext.Provider`) and the router context (so guards see the same value) from a single source. Rationale: dropping the guard at the route-context level (initial plan) would have established a precedent for future flow tests to skip guard wiring entirely — exactly the kind of drift the layer is meant to catch. Wiring it here sets the right reference shape.

**File:** `web/src/tests/integration/account.integration.test.tsx`

**Cases:**

1. **Stub success** — `` server.use(http.get(`${API_BASE}/me/profile`, () => HttpResponse.json(createMockUserProfile({ displayName: 'Ada Lovelace' })))) ``. Render with `renderWithRouter({ routeTree, initialEntry: '/account', auth: authedAuth, routerContext: baseRouterContext })`. Assert `findByDisplayValue('Ada Lovelace')` — proves guard → loader → component data flow.
2. **500 error path** — `` server.use(http.get(`${API_BASE}/me/profile`, () => new HttpResponse(null, { status: 500 }))) ``. Render same harness. Assert `findByRole('heading', { name: /something went wrong/i })` — proves the route's `errorComponent` (ErrorFallback) renders on loader failure.

**Auth value:** build an `authedAuth: AuthContextType` with `user: { id: 'user-123' } as User`, `session: {} as Session`, `loading: false`, `isAuthTransitioning: false`, and the four function fields as `vi.fn()`. The truthy `user` satisfies `requireAuth`'s `context.auth.user` check.

**Router context:** build `baseRouterContext: Omit<RouterContext, 'auth'>` with a stubbed `TeamContextType` (`myTeamId: null`, `hasTeam: false`, `setMyTeamId: vi.fn()`, `refreshMyTeam: vi.fn()`) plus `team: null`, `profile: null`, `currentSeason: null`. Future tests that exercise `requireTeam` will populate `team`/`teamContext.myTeamId` accordingly.

**Verification:**

- `npm run web:test` — new test passes alongside the existing suite. No regressions.
- Toggle the success-handler URL to a wrong path — confirm the test fails with MSW's "unhandled request" error pointing at `http://localhost/api/me/profile`. Proves strict mode is active and the assertion isn't a false positive.
- Set `authedAuth.user = null` — confirm the success test fails because `requireAuth` redirects and `Account` never mounts. Proves the guard is actually executing, not silently passing.

---

### Commit 4 — Document the layer and add the optional script

Make the convention discoverable and give focused-iteration ergonomics for writing a single flow test.

**Changes:**

- `web/CLAUDE.md` — new "Frontend Integration Tests" sibling section after `### Frontend Test Layering`:
  - Layer location: `src/tests/integration/<flow>.integration.test.tsx`. Naming by user flow, not component.
  - Stack summary: Vitest + jsdom + MSW at the `fetch` boundary, strict mode (`onUnhandledRequest: 'error'`), handler reset per test.
  - Reference test pointer: `account.integration.test.tsx` is the shape to copy.
  - Route trees: `createRootRouteWithContext<RouterContext>()`, wire real guards on layouts, mirror loader/component/errorComponent inline (production routes aren't exported from `router.tsx`).
  - Auth: passed once via `renderWithRouter`'s `auth` field, wired to both the React provider and the router context. `apiClient` pulls bearer from supabase, not auth context — handlers must not assert on `Authorization`. Defer Supabase session seeding until a test needs it.
  - MSW conventions: build URLs from `API_BASE` exported by `setupTests.ts`. Per-test handlers via `server.use(...)`; **no shared defaults today** because strict mode forces every test to spell out its network surface. **Trigger to extract a default:** the same handler copy-pasted across 3+ tests — at that point introduce `src/mocks/{handlers,server}.ts` and override per-test.
  - **Don't introduce per-service path constants.** Service modules already are the source of truth; strict-mode MSW catches drift loudly. A constant just adds a second place to maintain.
  - `renderWithRouter` signature with a one-block example.
  - Don't `vi.mock('@tanstack/react-router', ...)` or service modules — those mocks belong in the unit/component layer; mocking them here defeats the point.
- `web/src/setupTests.ts` — export `API_BASE = 'http://localhost/api'` so handler URLs build from a single source. (Already landed alongside commit 3 because the value carried into the reference test.)
- `web/package.json` — add `"test:integration": "vitest run src/tests/integration"`.
- Root `package.json` — add `"web:test:integration": "cd web && npm run test:integration"`.

**Verification:**

- `npm run web:test:integration` — runs only the integration test, passes.
- `npm run web:test` — still picks up the integration test (Vitest's default include matches `.test.tsx`), full suite passes.
- `npm run web:format:check` — clean.

---

## Out of scope (per issue)

- Migrating existing unit tests into the layer (#133).
- Other feature integration tests beyond `/account` reference (those come with feature work).
- Splitting Vitest into separate unit / integration projects.
- Replacing `vi.mock()` in existing unit tests with MSW.
- Seeding Supabase client's internal session for `Authorization`-header assertions — defer until a test needs it.
- Fixing the root loader's three-call precondition — sidestepped by per-test minimal route trees.
- A `src/mocks/` module with default handlers — deferred until the same handler is copy-pasted across 3+ flow tests (the trigger is documented in `web/CLAUDE.md`). Keeps the strict-mode "every test spells out its network surface" property until the boilerplate cost becomes concrete.
- Per-service path constants (e.g. `USER_PROFILE_PATH`) — strict-mode MSW catches typos/renames loudly; service modules stay the single source of truth.

## Critical files

- `web/package.json` — add msw devDep, add `test:integration` script.
- `web/src/setupTests.ts` — extend with MSW server + lifecycle, export `API_BASE`.
- `web/src/tests/test-utils/renderWithRouter.tsx` — new harness; takes `routeTree`, `initialEntry`, `auth`, `routerContext` (auth wired to both React provider and router context).
- `web/src/tests/test-utils/mockFactories.ts` — add `createMockUserProfile`.
- `web/src/tests/test-utils/index.ts` — re-export.
- `web/vite.config.ts` — coverage exclude `src/tests/**`.
- `web/src/tests/integration/account.integration.test.tsx` — new reference test; route tree uses `createRootRouteWithContext<RouterContext>()` and runs real `requireAuth`.
- `web/CLAUDE.md` — document the layer (location, MSW conventions, handler-default trigger, no path constants).
- Root `package.json` — add `web:test:integration` delegate.

## End-to-end verification

After all four commits land:

1. `npm run web:test` — full suite (existing + new integration) passes.
2. `npm run web:test:integration` — integration suite alone passes.
3. `npm run web:build && npm run web:lint && npm run web:format:check` — clean.
4. `npm run web:coverage` — `src/tests/**` does not appear in the coverage report.
5. `ls web/public` — confirm no `mockServiceWorker.js` was generated.
6. Quick negative test: temporarily change the MSW success handler URL in the account test to a wrong path; confirm Vitest reports an MSW "unhandled request" error pointing at `http://localhost/api/me/profile`. Revert.
