# Issue #226 — Make router context the single source of truth for the user's team

## Context

The user's team currently lives in **two** places:

1. **Router context** — `context.team`, a fully-loaded `Team`, fetched by the root route's `beforeLoad` (`router.tsx:111`) on every navigation.
2. **React `TeamContext`** — a `myTeamId: number | null` plus `hasTeam`, `setMyTeamId`, `refreshMyTeam`, hand-synced to match (1) via `setMyTeamId` side-effects inside route guards and the root `beforeLoad`.

`TeamContext` is a **manually-synced mirror** of `context.team`. It exists for one historical reason: the original team guards fetched the team themselves and pushed its id into `TeamContext` "for components that need it" (the sidebar's `hasTeam`, `JoinInvite`'s `hasTeam`, and `teamRoute.beforeLoad`'s self-redirect). The mirror had a gap — it only updated when a guard ran — so `CreateTeam` called `refreshMyTeam()` to poke the new id in after creating a team, because no guard runs on `/create-team`.

Since #225, the guards read `context.team` directly instead of fetching, leaving the `setMyTeamId` writes as the only thing keeping the now-unread mirror alive. This is the SSOT follow-up #225 explicitly parked: retire the `TeamContext` mirror, make `context.team` the single source of truth, and re-back the `useTeam` accessor onto router context.

This conforms the code to the repo's own state-ownership rule (web `CLAUDE.md`): **router context holds fetched data; React contexts hold identity/auth state only.** `TeamContext` was the standing violation.

## Why this is safe (validated against TanStack's docs + the existing codebase, not inferred)

**Reading `context.team` from a component is already a shipped, idiomatic pattern in this repo.** `useRouteContext` is TanStack's documented hook "for accessing the current route context in a component" ([useRouteContext docs](https://tanstack.com/router/latest/docs/framework/react/api/router/useRouteContextHook)), and the codebase already uses it against root context in `IndexRoute` (`const { profile, team } = useRouteContext({ from: '__root__' })`), `AppSidebar`, `AccountMenu`, and — most relevantly — wraps it in a domain-named custom hook in `useCurrentAvatar.ts`. Re-backing `useTeam` is copying `useCurrentAvatar`, not inventing a pattern.

**The root `beforeLoad` re-runs on every navigation, so `context.team` is always fresh.** Confirmed in #225 against the primary-source guides and [discussion #3432](https://github.com/TanStack/router/discussions/3432): `__root__`'s `beforeLoad` re-runs on every navigation, even between siblings under the same layout. `staleTime` governs loaders only, not `beforeLoad`.

**The create-team self-redirect timing is guaranteed by `beforeLoad` ordering.** `beforeLoad` runs serially, parent-before-child, each parent awaited before its child ([Router Context guide](https://tanstack.com/router/latest/docs/framework/react/guide/router-context)). For `navigate({ to: '/team/$newId' })`:

```
root beforeLoad      → awaits getMyTeam() → context.team = newTeam   ← fetch resolves here
  _authenticated     → requireAuth ✓
    _team-required   → requireTeam reads context.team ✓
      team/$teamId   → context.team?.id === teamId → redirect /my-team
```

The root fetch resolves and merges into `context.team` **before** `teamRoute.beforeLoad` reads it. The parent-`beforeLoad`-return → child-`beforeLoad`-read hop is the same one #225 already proves in CI (the `_team-required` guard reads root-set `context.team` in the same navigation). Read-after-write is not a new risk — today's `refreshMyTeam()` already does `getMyTeam()` immediately after `createTeam()` against the same single Postgres.

So `refreshMyTeam()` is replaced by **nothing** — not by `router.invalidate()`. The post-create `navigate()` re-runs the root `beforeLoad`, which does exactly what `refreshMyTeam` was hand-rolling. `invalidate()` would only add a redundant `/me/team` round-trip the navigation performs anyway.

## Decisions (from the grilling session)

- **Accessor:** re-back `useTeam` (keep the hook + name, minimal consumer churn) by mirroring `useCurrentAvatar` — `useRouteContext({ from: '__root__' })`, **no `select`**. New return shape: `{ team: Team | null, hasTeam: boolean }`. No `myTeamId` / `setMyTeamId` / `refreshMyTeam`, and no "must be used within a TeamProvider" throw (router context needs no provider).
- **`CreateTeam` refresh:** **drop `refreshMyTeam` with no replacement.** No `router.invalidate()`. Rely on the post-create `navigate()` re-running the root `beforeLoad`. Diverges from the issue's "router invalidation" wording, which the issue itself invites ("validate the approach independently").
- **`TeamContext`:** **removed entirely** — every field is derivable from `context.team`, and after dropping the side-effects and `refreshMyTeam` it serves no purpose.
- **`teamRoute.beforeLoad` self-redirect:** read `context.team?.id` instead of `context.teamContext.myTeamId`.
- **Commits:** two, gated — **sever the mirror, then delete it.** Commit 1 routes all team reads/writes through router context, leaving the `TeamContext` code inert; Commit 2 deletes the inert code and its test scaffolding. (See the `InnerApp` note below for why the `setMyTeamId` removal must land in Commit 1, not Commit 2.)
- **Docs:** **no ADR, no `CONTEXT.md` change** (mirrors #225) — this is routing/state implementation reaching the *less*-surprising idiomatic shape (the mirror was the deviation), not a domain term or a hard-to-reverse trade-off. Update web `CLAUDE.md`'s State Management section + the guard unit-test example in Commit 2.

### The `InnerApp` bridge (gap found in review)

`InnerApp` is not just a `useTeam` consumer — it's the **bridge** that injects the `TeamProvider` value into router context: `const teamContext = useTeam(); … <RouterProvider context={{ auth, teamContext, team: null }} />`. Re-backing `useTeam` to return `{ team, hasTeam }` would feed the wrong shape into the `teamContext` field.

This is why **Commit 1 must also remove the `setMyTeamId` writes** (both guards + the root `beforeLoad`) and drop `teamContext` from `InnerApp`'s `RouterProvider` context (`context={{ auth, team: null }}`). Once nothing reads or writes `context.teamContext`, the still-typed field is harmlessly defaulted by `createRouter`'s `teamContext: undefined!` until Commit 2 deletes it. The alternative — keeping the writes alive in Commit 1 — would force `InnerApp` to bridge via a raw `useContext(TeamContext)` just to feed a mirror nobody reads. Severing fully in Commit 1 is cleaner.

### Test coverage for the self-redirect (gap found in review)

The `teamRoute.beforeLoad` self-redirect (`myTeamId === teamId → /my-team`) is **currently untested at the unit/integration level** — `team-lineup`'s mirrored `team/$teamId` route has no `beforeLoad`, so its "viewing another team" test passes purely via the loader and its `myTeamId: 1` override is dead. Two facts shape the coverage plan:

- **E2E `team.spec.ts:15`** ("new user creates a team and lands on /my-team") already exercises the full create → self-redirect journey through the real stack. This is the **primary regression guard** for dropping `refreshMyTeam`: it passes only if the self-redirect fires post-create without the manual refresh.
- Changing the `beforeLoad`'s left operand (`myTeamId` → `context.team?.id`) warrants a **fast** test too. Add the production `beforeLoad` to `team-lineup`'s `buildTeamByIdRouteTree` and assert both branches (own team → `/my-team`; another team → renders read-only). This also retroactively closes the pre-existing gap.

No elaborate stateful-handler test is added to `create-team` — that would duplicate E2E `team.spec.ts:15` on the same path (the redundant-overlap anti-pattern in the testing strategy).

## Approach

Two self-contained commits, each independently passing build/lint/test/format, each a gate (wait for approval before the next).

1. **Sever the `TeamContext` mirror** — every team read *and* write goes through router context; the `TeamContext` code is left in place but inert (no readers, no writers, not injected).
2. **Delete the inert mirror** — remove the dead context, its `RouterContext` field, the provider, and the test scaffolding.

---

## Commit 1 — Sever the `TeamContext` mirror

After this commit, the user's team flows only through `context.team`. `TeamContext.tsx`/`.ts` and `<TeamProvider>` still exist but have zero readers, zero writers, and are no longer injected into router context.

### Source

- **`web/src/hooks/useTeam.ts`** — rewrite to read router context:
  ```ts
  import { useRouteContext } from '@tanstack/react-router';

  export function useTeam() {
    const { team } = useRouteContext({ from: '__root__' });
    return { team, hasTeam: team !== null };
  }
  ```
  Drop the `TeamContext` import and the provider-guard throw. `useNavDestinations` and `JoinInvite` keep destructuring `hasTeam` unchanged.
- **`web/src/router.tsx`**
  - `teamRoute.beforeLoad` (~line 614): `context.team?.id === validationResult.data.teamId` (was `context.teamContext.myTeamId === …`).
  - Root `beforeLoad`: delete both `context.teamContext.setMyTeamId(...)` calls (success + degraded-catch paths) and their `// Sync … TeamContext` comments. The returned `{ profile, currentSeason, team }` is unchanged.
- **`web/src/lib/route-guards.ts`** — delete the `context.teamContext.setMyTeamId(...)` line and its comment from both `requireTeam` and `requireNoTeam`. Guards stay synchronous `context.team` readers; their return types are unchanged.
- **`web/src/components/CreateTeam/CreateTeam.tsx`** — remove the `useTeam` import, `const { refreshMyTeam } = useTeam()`, and the `await refreshMyTeam()` call. The `createTeam()` → `navigate()` sequence is otherwise unchanged.
- **`web/src/InnerApp.tsx`** — remove `const teamContext = useTeam()` and the `useTeam` import; change the `RouterProvider` context to `{ auth, team: null }`. (`teamContext` is now defaulted by `createRouter` and read by no one.)

### Tests

- **`web/src/hooks/useNavDestinations.test.tsx`** — **delete.** It renders the hook under a bare `TeamContext.Provider`, which no longer feeds `useTeam`; rebuilding its harness to stand up a router would just to assert "`hasTeam` gates three nav items" duplicates `navigation.integration.test.tsx`, which verifies both branches through the real sidebar. (Web `CLAUDE.md`: trivial passthroughs are covered by consumer integration tests.)
- **`web/src/tests/integration/navigation.integration.test.tsx`** — drop the `TeamContext.Provider` wrapper and `teamContextValue` param from `buildNavRouteTree`; the nav reads `context.team` now. Inject `team: createMockTeam()` (has-team) / `team: null` (no-team) via `routerContext`; the `hasTeam` option toggles `team`. (This tree currently relies solely on the Provider — it injects no `team` today, so this is a required change.)
- **`web/src/tests/integration/join-invite.integration.test.tsx`** — same: drop the Provider wrapper from `buildJoinInviteRouteTree`; in `makeRouterContext`, replace `createTeamContext({ myTeamId: 1, hasTeam: true })` with `team: createMockTeam()` and the no-team cases with `team: null`. (Also currently injects no `team`.)
- **`web/src/tests/integration/create-team.integration.test.tsx`** — `CreateTeam` no longer reads `useTeam`, so drop the `TeamContext.Provider` wrapper, the `teamContextValue` param, and the `createTeamContext`/`TeamContext` imports; use `createBaseRouterContext()` for `routerContext`. The existing assertions hold: GET `/me/team` → 404 renders the form (root `beforeLoad` → `context.team` null → `requireNoTeam`); the success test still lands on the `team/$teamId` stub (a bare stub with no self-redirect); the redirect-search-param test still lands on `/leagues`.
- **`web/src/tests/integration/team-lineup.integration.test.tsx`** — add the production self-redirect to `buildTeamByIdRouteTree`'s `team/$teamId` route and a `/my-team` stub sibling:
  ```ts
  beforeLoad: ({ context, params }) => {
    const teamId = Number(params.teamId);
    if (Number.isInteger(teamId) && context.team?.id === teamId) {
      throw redirect({ to: '/my-team', replace: true });
    }
  },
  ```
  Add a **positive** case (`initialEntry: '/team/1'` with `context.team` id 1 → asserts the `/my-team` stub; no `/teams/1` handler needed — the `beforeLoad` redirect short-circuits the loader) and keep the **negative** "viewing another team" case (`/team/2`, `context.team` id 1 → renders read-only), which now genuinely exercises the guard. Drop the dead `makeRouterContext({ myTeamId: 1 })` override → `makeRouterContext()`.
- **`web/src/lib/route-guards.test.ts`** — delete the two `expect(teamContext.setMyTeamId).toHaveBeenCalledWith(...)` assertions (guards no longer write). Keep `teamContext` in the inline context objects for now (still a required `RouterContext` field until Commit 2). Keep the `context.team`-varying redirect/return cases.
- **`web/src/InnerApp.test.tsx`** — `InnerApp` no longer calls `useTeam`; remove the `vi.mock('./hooks/useTeam')`, `mockUseTeam`, and `createMockTeamContext` machinery. The loading/transition-state assertions are otherwise unaffected.

**Gate:** `web:build`, `web:lint`, `web:test`, `web:format:check` all pass. (E2E `team.spec.ts:15` is the end-to-end guard for the `refreshMyTeam` removal.)

---

## Commit 2 — Delete the inert mirror

Pure removal of the now-dead context, its type, and test scaffolding. Nothing reads, writes, or injects `TeamContext` after Commit 1.

### Source

- **`web/src/lib/router-context.ts`** — remove the `teamContext: TeamContextType` field and its import.
- **`web/src/router.tsx`** — remove `teamContext: undefined!` from the `createRouter` context defaults.
- **`web/src/main.tsx`** — remove the `<TeamProvider>` wrapper and its import.
- **Delete** `web/src/contexts/TeamContext.tsx` and `web/src/contexts/TeamContext.ts`.

### Test-utils

- **`web/src/tests/test-utils/renderContexts.ts`** — delete `createTeamContext` and the `TeamContextType` import; remove `teamContext` from `createBaseRouterContext`'s defaults.
- **`web/src/tests/test-utils/index.ts`** — drop the `createTeamContext` re-export.
- **`web/src/tests/test-utils/routeTreeBuilders.tsx`** — remove the `TeamContext`-provider reference in `buildRootRoute`'s doc comment.

### Tests

- **Delete** `web/src/contexts/TeamContext.test.tsx`.
- **`web/src/lib/route-guards.test.ts`** — remove `teamContext` from the inline context objects (the field is gone from `RouterContext`) and the `createTeamContext` import.
- **`web/src/InnerApp.test.tsx`** — remove the residual `TeamContextType` import / any leftover teamContext references.
- **Provider-wrapper / `teamContext`-field cleanup** — drop the now-vestigial `TeamContext.Provider` wrappers and/or `teamContext` `routerContext` fields (and the `createTeamContext`/`TeamContext`/`TeamContextType` imports) from: `route-guards.integration` (Provider was only scaffolding for the removed `setMyTeamId`), `root-routing.integration` (Provider is vestigial; `IndexRoute` reads router context and `team` is already injected), `leaderboard`, `leagues`, `league-invite-dialog`, `league-loader`, and `team-lineup` (also drop its now-unused `teamContextOverrides` param). All of these already inject a non-null `team`, so removing `teamContext` is the only change.

### Docs

- **`web/CLAUDE.md`** — State Management section: drop the `TeamContext` bullet; state that the user's team lives in router context (`context.team`) as the single source of truth, with React contexts holding auth/identity only. Update the guard unit-test example (`teamContext: { hasTeam: false }` → `team: null`) and the `renderWithRouter` `routerContext` example (remove `teamContext`).

**Gate:** build/lint/test/format all pass; manually verify: create-team happy path (sign in with no team → `/create-team` → create → lands on `/my-team`); sidebar shows team nav after creation and clears on sign-out; has-team user hitting `/create-team` lands on `/`.

---

## Out of scope

- The root `beforeLoad` fetching profile/team/season on every navigation is pre-existing behavior, unchanged here.
- No change to the gate model (redirects) or the `_no-team` / `_team-required` / `_authenticated` layout structure (settled in #225).

## Verification

- `npm run web:build`, `web:lint`, `web:test`, `web:format:check`.
- E2E `team.spec.ts` (`new user creates a team and lands on /my-team`) covers the create → self-redirect journey end-to-end.
- Manual: create-team → `/my-team`; sidebar team nav appears post-create and clears on sign-out; `/create-team` with an existing team → `/`; navigation between team-required routes still works.
