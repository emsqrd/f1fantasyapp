# Issue #225 — Simplify team-state route guards

## Context

The team-state guards (`requireTeam` / `requireNoTeam` in `web/src/lib/route-guards.ts`) do redundant work on every gated navigation:

1. **They re-fetch team.** Each guard calls `getMyTeam()`, even though the root route's `beforeLoad` (`router.tsx:111`) already fetches `team` into router context on every navigation. That fetched `context.team` is currently **read by nobody** — the guards ignore it and fetch their own copy, so every gated navigation pays two `/me/team` round-trips instead of one.
2. **They re-check auth.** `requireTeam` calls `requireAuth`, but it lives under the `_authenticated` layout, which already enforced auth in its own `beforeLoad`. `requireNoTeam` calls `requireAuth` too — but for it the check is **load-bearing**, because `_no-team` is mounted directly under `rootRoute`, outside the authed subtree.
3. **They write to React context as a side effect.** Each guard calls `context.teamContext.setMyTeamId(...)`, duplicating the identical call the root `beforeLoad` already makes.

This issue makes the guards lean: decide redirects from `context.team` instead of re-fetching, and enforce auth once at the layer. It is a cleanup — **the gate model (redirects) is kept**, not replaced with empty states (that was #199's rejected direction). Removing the `setMyTeamId` side effect and the duplicate React-context team state is the **single-source-of-truth follow-up, out of scope here** — this issue leaves that sync in place. Independent of #224 (either order).

### Why reading `context.team` is safe (validated against TanStack's docs, not inferred)

The refactor rests on the root `beforeLoad` producing a fresh `context.team` before any child guard reads it. Confirmed against the primary-source guides (`docs/router/guide/*.md` in `TanStack/router`, read raw — the `tanstack.com` site is a client-rendered SPA):

- **`beforeLoad` runs on every navigation, outside the loader cache.** The lifecycle puts `route.beforeLoad` in "Route Pre-Loading (Serial)", separate from the cached "Route Loading (Parallel)" loader phase; stale-while-revalidate `staleTime` (default `0`) governs **loaders only**. Confirmed empirically by [discussion #3432](https://github.com/TanStack/router/discussions/3432) (a user reporting `__root.tsx`'s `beforeLoad` re-runs "every time a user navigates between child routes … even when navigating between sibling routes that share the same parent layout").
- **Parent `beforeLoad` runs before child `beforeLoad`, and its return merges down.** `authenticated-routes.md`: *"the `beforeLoad` function for a route is called before any of its child routes' `beforeLoad` functions. It is essentially a middleware function for the route and all of its children."* `router-context.md`: context *"is passed down the route tree and is merged at each route … available to all child routes."*

So in the create-team flow — `createTeam()` (awaits the POST) → `navigate('/team/$teamId')` → root `beforeLoad` re-runs and `getMyTeam()` returns the just-created team → `context.team` populated → `requireTeam` reads it → allows. `context.team` is exactly as fresh as today's guard fetch, so **no `router.invalidate()` is needed**. The pre-existing degraded-fetch failure mode (root's `getMyTeam()` throws → `context.team` null → guard redirects) is unchanged — today's guard would throw on its own fetch in the same situation.

> Caveat worth carrying into review: TanStack's *code examples* only ever consume merged context in a `loader`; the parent-`beforeLoad`-return → child-`beforeLoad` hop is asserted in prose, and there are open issues about context inheritance occasionally misbehaving ([#3430](https://github.com/TanStack/router/issues/3430), [#3578](https://github.com/TanStack/router/issues/3578)). The integration tests below exercise that exact hop in our router version, so a regression surfaces in CI rather than in production.

## Decisions (from the grilling session)

- **Auth structure:** move `_no-team` under `_authenticated` so auth is enforced once at the layer; both guards become auth-free, synchronous readers of `context.team`.
- **`requireNoTeam` redirect destination:** `/` (Home), consistent with ADR 002 and the #224 convergence-on-`/` direction. (Was `/leagues`, the "arbitrary" choice the issue flagged.)
- **`setMyTeamId` side effect:** left in place (parked SSOT work).
- **Tests:** add a `buildRootRoute` helper that mirrors production's team-fetching root `beforeLoad`; the guard-wiring tests adopt it so the existing `/me/team` handlers drive guard state through the real root→context→guard path. (Static-injecting `context.team` was rejected — it would skip the very hop the docs only assert in prose.)
- **Docs:** no ADR, no `CONTEXT.md` change — this is routing implementation, not a domain term, and the end state is the *less*-surprising idiomatic shape (re-fetch-in-guard was the deviation). Delete the now-wrong JSDoc that tells future guards to fetch in `beforeLoad`.

## Approach

Two self-contained commits, each independently passing build/lint/test/format, each a gate (wait for approval before the next):

1. **Move `_no-team` under `_authenticated`** — structural, behavior-preserving. Lays the auth-enforced-once foundation.
2. **Lean the guards + their tests** — read `context.team`, drop the redundant `requireAuth`, retarget `requireNoTeam` to `/`, and rewire the guard-wiring tests through `buildRootRoute`.

---

## Commit 1 — Move `_no-team` under `_authenticated`

Pure route-tree restructure. Guards are untouched (they still fetch and still self-check auth), so behavior is identical — `requireNoTeam`'s now-redundant internal `requireAuth` simply runs after the layer's, which is idempotent.

**`web/src/router.tsx`** — re-parent in the route tree (`routeTree`, ~line 753):

```ts
authenticatedLayoutRoute.addChildren([
  accountRoute,
  noTeamLayoutRoute.addChildren([createTeamRoute]), // moved in from rootRoute's children
  teamRequiredLayoutRoute.addChildren([
    leaguesRoute,
    browseLeaguesRoute,
    leagueRoute,
    teamRoute,
    myTeamRoute,
  ]),
]),
// noTeamLayoutRoute no longer appears as a direct child of rootRoute
```

`noTeamLayoutRoute`'s `getParentRoute` changes `() => rootRoute` → `() => authenticatedLayoutRoute` (`router.tsx:390`). The route's `id: '_no-team'` is unchanged; only the full route-id path shifts to `/_authenticated/_no-team/create-team`. `createTeamRoute`'s `path: 'create-team'` is unchanged, so the URL stays `/create-team`.

**`web/src/components/CreateTeam/CreateTeam.tsx:22`** — the route-id string in `useSearch` must track the move (TanStack type-checks `from` against registered route ids, so `web:build` fails loudly if missed):

```ts
const search = useSearch({ from: '/_authenticated/_no-team/create-team' });
```

No guard changes. **One test change was required** (an earlier pass of this plan said none): `CreateTeam` reads `useSearch({ from: '/_authenticated/_no-team/create-team' })`, and TanStack resolves that `from` **at runtime** against whatever route tree is mounted — including a test's own tree. `create-team.integration.test.tsx` mounts the real `CreateTeam` under a tree that nested `_no-team` directly under root (route id `/_no-team/create-team`), so after the move the component threw on an unresolvable `from`. Fix: nest `_no-team` under an `_authenticated` layer there (`buildNoTeamLayout(buildAuthenticatedLayout(rootRoute))`) so the test's route id matches production. This mirrors production placement — the integration layer's contract — rather than papering over the string. (The `web:build` type-check only validates `from` against the *production* tree; runtime resolution against a test tree is invisible to it, which is why this surfaced only in `web:test`.)

`route-guards.integration.test.tsx` also has a `_no-team` layer but stubs `create-team` (it never mounts the real `CreateTeam`), so it doesn't resolve `useSearch` and was left untouched in this commit — it still nests `_no-team` under root, a now-divergent placement that Commit 2 aligns. The integration tests otherwise build their own route trees and don't import the production tree.

An unauthed hit to `/create-team` still redirects to `/`, now via `_authenticated`'s `requireAuth` instead of `requireNoTeam`'s.

**Gate:** `npm run web:build`, `web:lint`, `web:test`, `web:format:check` all pass.

---

## Commit 2 — Lean the guards and rewire their tests

### `web/src/lib/route-guards.ts`

`requireAuth` is **unchanged** (still used by the `_authenticated` layout and the test layout builder; keep the `getSession()` lag fallback).

Rewrite the two team guards as synchronous, auth-free `context.team` readers. Keep the `setMyTeamId` sync (parked) and keep returning the (narrowed) team so child loaders still see a non-null `context.team` type:

```ts
export function requireTeam(context: RouterContext): { team: Team } {
  // context.team is populated by the root beforeLoad, which re-runs every
  // navigation — reading it is as fresh as a re-fetch. Don't re-fetch here.
  if (!context.team) {
    throw redirect({ to: '/create-team', replace: true });
  }
  context.teamContext.setMyTeamId(context.team.id);
  return { team: context.team };
}

export function requireNoTeam(context: RouterContext): { team: null } {
  if (context.team) {
    throw redirect({ to: '/', replace: true });
  }
  context.teamContext.setMyTeamId(null);
  return { team: null };
}
```

- Drop the `requireAuth` call from both (the `_authenticated` layer owns auth).
- Drop the `getMyTeam` import/usage.
- `requireNoTeam` redirect `/leagues` → `/`.
- **JSDoc:** delete the "beforeLoad should fetch required data rather than relying on async React context state" guidance from both guards — it now prescribes the opposite of the design. Replace with a one-line note that the team comes from the root `beforeLoad`. Drop the now-irrelevant "protected route flashing" link if it no longer applies.

### `web/src/router.tsx`

- `teamRequiredLayoutRoute.beforeLoad` and `noTeamLayoutRoute.beforeLoad` (~lines 392, 444) can drop `async`/`await` now that the guards are synchronous: `beforeLoad: ({ context }) => requireTeam(context)`.
- No destination edits here — `requireNoTeam`'s `/` target lives in the guard.

### `web/src/tests/test-utils/routeTreeBuilders.tsx`

Add a `buildRootRoute` helper that mirrors production's team-fetching root `beforeLoad`. It takes an optional `component` so tests that need `TeamContext` in the React tree (e.g. `route-guards.integration`) keep their provider wrapper:

```tsx
export function buildRootRoute({ component }: { component?: () => React.ReactNode } = {}) {
  return createRootRouteWithContext<RouterContext>()({
    beforeLoad: async ({ context }: { context: RouterContext }) => {
      if (!context.auth.user) return { team: null };
      const team = await getMyTeam(); // hits MSW /me/team
      return { team };
    },
    component: component ?? (() => <Outlet />),
  });
}
```

Simplify the `buildTeamRequiredLayout` / `buildNoTeamLayout` wrappers to drop `async`/`await` (the guards are sync now).

### `web/src/lib/route-guards.test.ts` (unit)

- **`requireAuth` block:** unchanged (keep the `supabase.auth.getSession` mock and its three cases).
- **Remove** the `vi.mock('@/services/teamService')` / `getMyTeam` mock — no guard fetches anymore.
- **`requireTeam` block:** drop the `getMyTeam` setup; vary `context.team`. `team: null` → expect `redirect({ to: '/create-team', replace: true })`; `team: createMockTeam()` → returns `{ team }`. **Delete** "delegates to requireAuth when not authenticated" (the guard no longer owns auth).
- **`requireNoTeam` block:** `team: createMockTeam()` → expect `redirect({ to: '/', replace: true })` (was `/leagues`); `team: null` → returns `{ team: null }`. **Delete** the "delegates to requireAuth" case.
- Assertions become synchronous (`expect(() => requireTeam(ctx)).toThrow()` / `expect(requireTeam(ctx)).toEqual({ team })`).

### `web/src/tests/integration/route-guards.integration.test.tsx` (guard wiring)

- Build the root via `buildRootRoute({ component: () => <TeamContext.Provider value={tc}><Outlet/></TeamContext.Provider> })` so the existing `/me/team` handlers feed `context.team` through the real root `beforeLoad`. This is the test that proves the root→context→guard hop in-repo.
- Mirror production placement: nest `_no-team` under `_authenticated` (`buildNoTeamLayout(authenticatedLayoutRoute)`), matching Commit 1.
- The existing handlers carry over: 404 → no team, `HttpResponse.json(team)` → team.
- **"with a team from /create-team"** now redirects to `/`, not `/leagues` — point the assertion at the `/` stub (rename its heading, e.g. `Home`) and drop the now-unused `leagues` stub.

### `web/src/tests/integration/create-team.integration.test.tsx`

- Swap its inline root for `buildRootRoute(...)`. (The `_no-team`-under-`_authenticated` nesting was already done in Commit 1; this commit only changes the root.) The existing `/me/team` → 404 handlers now drive "no team" through root into `context.team`, so the form renders via the guard reading null. The submit-flow handler (`/me/team` for `refreshMyTeam`) stays.
- Any "redirect when a team exists" case asserts the `/` destination.

### Flow tests — inject `team` via `routerContext`, drop dead guard handlers

These mount routes under `_team-required` but aren't _about_ the guard, so they supply `context.team` directly instead of wiring `buildRootRoute`:

- **Already injected a non-null `team`** (`team-lineup`, `leagues`, `league-invite-dialog`): the refactored `requireTeam` reads it and passes — context wiring unchanged.
- **Relied on the old guard's `/me/team` fetch** (`league-loader`, `leaderboard`): passed `team: null` plus a `/me/team` handler that fed the guard's old fetch. With the guard reading context, that handler no longer fires, so the guard saw `null` and redirected. Fixed by injecting `team` via `routerContext`.

A `/me/team` handler **stays only where a route loader consumes it** (e.g. the `/my-team` lineup tests, whose loader calls `getMyTeam()`). Handlers that existed solely for the old guard fetch are now dead — strict MSW errors on unhandled _requests_, not unused handlers, so harmless to leave — and were removed from `leagues`, `league-invite-dialog`, and the team-by-id case in `team-lineup`.

**Gate:** build/lint/test/format all pass; manually verify the create-team happy path (sign in with no team → `/create-team` → create → lands on `/team/$id` without bouncing back) and that a has-team user hitting `/create-team` lands on `/`.

---

## Out of scope / follow-ups

- **Single-source-of-truth work:** remove the `setMyTeamId` side effect from the guards (and root `beforeLoad`) and retire the duplicate `TeamContext` team-id state in favor of `context.team`. Tracked separately; this issue deliberately leaves the sync in place.
- **#224** (post-auth landing → `/`, removing `defaultAuthedDestination`) is independent and can land in either order.

## Verification

- `npm run web:build`, `web:lint`, `web:test`, `web:format:check`.
- Manual: create-team flow (above), navigation between team-required routes (no second `/me/team` round-trip per navigation in the network panel), unauthed `/create-team` → `/`.
