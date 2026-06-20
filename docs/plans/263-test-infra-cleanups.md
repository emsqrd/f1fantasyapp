# Plan: Test-infra cleanups deferred from the #247 migration (issue #263)

## Context

Two behavior-neutral test-infra cleanups surfaced by the #247 `RouterContext` migration, split out of that PR to keep it reviewable. Both are pure refactors of the `web/` Vitest test infrastructure — no production code changes, the existing suite is the regression guard. They land as **two self-contained commits**, each independently green on build, lint, test, and format.

The cleanups remove two patterns that no longer reflect best practice:

1. **`setupTests.ts` leaks exports.** A Vitest [`setupFiles`](https://vitest.dev/config/setupfiles) entry runs for side effects before each test file; the runner ignores its exports. Yet `setupTests.ts` re-exports `server`/`API_BASE` as a back-compat shim and defines `setMobileViewport` + the `matchMedia` stub inline, so 16 tests import values *from the setup file* — a pattern the tool doesn't intend. MSW's [Node integration](https://mswjs.io/docs/integrations/node) keeps `server` in a module tests import directly, with the setup file only wiring lifecycle.

2. **`createBaseRouterContext` is vestigial.** Since #247 narrowed `RouterContext` to `{ auth, queryClient }`, the helper returns `{}`, and `renderWithRouter` already defaults `routerContext` to `{}` — so `routerContext: createBaseRouterContext()` is equivalent to omitting the arg. Three local test wrappers exist only to run a `server.use(...)` side effect and then return that empty `{}`.

Per repo convention, each commit is a review gate — the second commit does not begin until the first is approved.

---

## Commit 1 — Side-effect-only `setupTests.ts` + `@/mocks` import surface

Make `setupTests.ts` export nothing; route shared fixtures through dedicated modules tests import directly.

### New files

- **`web/src/mocks/index.ts`** — barrel matching the existing `@/tests/test-utils` pattern:
  ```ts
  export { API_BASE } from './handlers';
  export { server } from './server';
  ```
- **`web/src/tests/test-utils/matchMedia.ts`** — move the `matchMedia` machinery out of `setupTests.ts`. Holds the module-level `let mobileViewport = false` flag plus:
  - `installMatchMediaMock()` — assigns `window.matchMedia` (the stub body currently at `setupTests.ts:39-49`), for the setup-file side effect.
  - `setMobileViewport(value: boolean)` — flips the flag (currently `setupTests.ts:32-34`), for tests. Keep the existing doc comment.

### Edits

- **`web/src/setupTests.ts`**: remove the two re-export lines (`10-11`), the inline `setMobileViewport` (`27-34`), the `matchMedia` stub + `mobileViewport` var (`25`, `36-49`). Import `installMatchMediaMock` + `setMobileViewport` from `./tests/test-utils/matchMedia`; call `installMatchMediaMock()` at top level (where the stub was) and `setMobileViewport(false)` in the `afterEach` (replacing the `mobileViewport = false` on line 56). Keep the existing internal `import { API_BASE }`/`import { server }` (lines 5-6) — those stay for env-stub + lifecycle wiring. **Net result: `setupTests.ts` exports nothing.**
- **`web/src/mocks/handlers.ts`**: rewrite the stale comment (lines ~5-7) that references "re-exported from setupTests" — `API_BASE` is no longer re-exported there. Trim to state what `API_BASE` is (the base URL the suite targets); drop the setupTests/cycle framing.
- **`web/src/tests/test-utils/index.ts`**: add `export { setMobileViewport } from './matchMedia';`.
- **Repoint the 16 `@/setupTests` importers** (15 in `src/tests/integration/*.integration.test.tsx`, plus `src/hooks/useCurrentAvatar.test.tsx`): change `import { API_BASE, server } from '@/setupTests'` → `from '@/mocks'`. The one exception is `navigation.integration.test.tsx`, which also imports `setMobileViewport`: split it — `server`/`API_BASE` from `@/mocks`, `setMobileViewport` from `@/tests/test-utils`.
- **`web/CLAUDE.md`**: update the two references — the Stack paragraph's "(both re-exported from `setupTests.ts` as `server` / `API_BASE`)" and "Build URLs from `API_BASE` exported by `setupTests.ts`" — to point at `@/mocks`.

### Gate

`setupTests.ts` exports nothing; no file imports `server`/`API_BASE` from `@/setupTests`; tests get them from `@/mocks` and `setMobileViewport` from `@/tests/test-utils`.

---

## Commit 2 — Drop the vestigial `createBaseRouterContext` helper

Remove the no-op helper and the `routerContext` plumbing it fed; convert the three side-effect-only wrappers to `stub…` seed functions.

### Edits

- **`web/src/tests/test-utils/renderContexts.ts`**: delete `createBaseRouterContext` (keep `createUnauthAuth`, `createAuthedAuth`).
- **`web/src/tests/test-utils/index.ts`**: drop `createBaseRouterContext` from the `./renderContexts` re-export line.
- **`web/src/tests/test-utils/renderWithRouter.tsx`**: remove the `routerContext` field from `RenderWithRouterOptions` (and its doc block), the `routerContext = {}` param, and the `...routerContext` spread — context becomes `{ auth: routerAuth, queryClient }`.
- **Drop `routerContext: createBaseRouterContext()` at its direct call sites** — ~42 occurrences across 11 integration test files (`account`, `account-menu`, `auth-confirm`, `auth-toggle`, `create-team`, `leaderboard`, `league-loader`, `navigation`, `root-routing`, `route-guards`, `signup-resend`). Each just loses that one line from the `renderWithRouter({...})` object. (The issue estimated 40; actual is ~42 — the pattern covers all.)
- **Convert the three local wrappers to `stub…` side-effect functions** (each lives in one file, used in one file; keep them local). Each keeps its `server.use(...)` body, drops the `return createBaseRouterContext()`, and returns nothing. At every call site, hoist the call to a statement *before* `renderWithRouter(...)` and omit `routerContext`:
  - `leagues.integration.test.tsx`: `authedRouterContext()` → `stubMyTeam()` — 16 sites.
  - `league-invite-dialog.integration.test.tsx`: `ownerRouterContext()` → `stubLeagueOwner()` — 5 sites.
  - `join-invite.integration.test.tsx`: `makeRouterContext(team)` → `stubProfileForTeam(team)` — 11 sites (keeps the `team` param).

  Transformation shape:
  ```ts
  // before
  renderWithRouter({ routeTree, initialEntry, auth: createAuthedAuth(), routerContext: authedRouterContext() });
  // after
  stubMyTeam();
  renderWithRouter({ routeTree, initialEntry, auth: createAuthedAuth() });
  ```
- **`web/CLAUDE.md`**: in the `renderWithRouter` signature note, drop the `routerContext` mention — signature becomes `routeTree`, `initialEntry`, `auth`.

### Gate

`createBaseRouterContext` and the `routerContext` param/type are gone; tests seed via the `stub…` side effects.

---

## Verification (run per commit)

```bash
npm run web:test          # full frontend suite — the regression guard for both refactors
npm run web:lint          # catches unused imports / dangling symbols
npm run web:format:check
npm run web:build         # tsc type-check (catches removed-type references)
```

Grep gates:

```bash
# Commit 1
grep -rn "from '@/setupTests'" web/src        # → no matches
grep -n "export" web/src/setupTests.ts        # → no `export` statements

# Commit 2
grep -rn "createBaseRouterContext\|routerContext" web/src   # → no matches
```

This is a pure refactor — no manual browser check needed; a green `web:test` proves behavior is unchanged.
