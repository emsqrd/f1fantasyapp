# Plan: TanStack Query for Cross-Route Reads (#247)

Implementation plan for #247, following the decision in [ADR 006](../adr/006-tanstack-query-for-cross-route-reads.md) — the ADR holds the *why*, this plan the *how*. Tracking: #254.

The same commits carry the fix for **#249** (a transient load failure misread as "no team"): deleting the catch-all-to-`null` `beforeLoad` removes its cause, and Commits 5 and 7 implement the throw-vs-`null` handling. But the code alone doesn't *guarantee* it — a guard that swallowed the throw back to `null` would silently reintroduce #249 — so it closes only when its regression tests (Commits 5 and 7: transient-failure-doesn't-misroute, profile-blip-doesn't-demote-Home) are green. Closable here, not closed by the migration.

## Conventions (used across commits)

**`queryClient` singleton** — `src/lib/queryClient.ts` (mirrors `src/lib/supabase.ts`), imported by `main.tsx` (provider), `InnerApp` (router context injection), and `AuthProvider` (reset). Defaults:

```ts
new QueryClient({
  defaultOptions: { queries: {
    staleTime: 60_000, gcTime: 5 * 60_000, refetchOnWindowFocus: false, retry: 1,
  }},
});
```

**`queryOptions` colocated in the service modules**, with key factories — `['me', …]` for user-scoped, bare for global. The `['me']` prefix is load-bearing: it's the namespace the user-switch reset (Commit 8) clears with one `removeQueries({ queryKey: ['me'] })`, which is why season and (later) reference data stay *outside* it. Per-resource definitions:

```ts
// userProfileService.ts
export const profileKeys = { all: ['me', 'profile'] as const };
export const profileQuery = queryOptions({ queryKey: profileKeys.all, queryFn: () => userProfileService.getCurrentProfile(), staleTime: 5 * 60_000 });
// teamService.ts
export const teamKeys = { all: ['me', 'team'] as const };
export const teamQuery = queryOptions({ queryKey: teamKeys.all, queryFn: getMyTeam, staleTime: 5 * 60_000 });
// seasonService.ts — inherits client defaults (staleTime 60s, gcTime 5min)
export const seasonKeys = { current: ['season', 'current'] as const };
export const seasonQuery = queryOptions({ queryKey: seasonKeys.current, queryFn: getCurrentSeason });
```

Season takes **no** freshness override (unlike profile/team). It's read only in loaders via `ensureQueryData`, which returns cached data without consulting `staleTime` (it only revalidates with `revalidateIfStale`, which we don't pass) — so a `staleTime` override would be inert, and `gcTime: Infinity` would pin the season for the tab's life, making an end-of-season transition invisible until a hard refresh. The defaults still dedup within a navigation (the #247 win) while letting a transition surface after a short idle. When an end-of-season UI is built, it decides between deriving from `season.endDate` (clock-based, like roster lock) or subscribing with `useQuery` + a finite `staleTime`.

**Read patterns** — guards/loaders call `ensureQueryData`; components call `useSuspenseQuery` for loader-guaranteed data and `useQuery({ enabled: !!user })` for the dual-auth `Layout` chrome (renders for anon too; Suspense has no `enabled`). A `queryFn` returning `null` (the no-team / no-profile case) is valid and caches as data; one returning `undefined` throws in v5 — the services already return `null`, just don't let one slip to `undefined`.

**Mutations** — once a read is a query, the old "mutate → `router.invalidate()` → loader refetches" path no longer refreshes it (`router.invalidate()` doesn't touch the Query cache; `ensureQueryData` returns the stale entry). Every write that changes profile or team must `queryClient.invalidateQueries(...)` (or `setQueryData`) the affected query — see Commits 5 and 7.

Each commit below is a gate: it includes its own tests and independently passes build, lint, test, and format. Backend (data/contract) lands before the frontend consumes it; the foundation lands before the read-site migration; each migration empties one more of the old `rootRoute.beforeLoad` fan-out.

## Scope — not in this plan

- **Route-owned loader `staleTime`** — #247's evidence notes it's absent on `index`/`leagues`/`account`. Those loaders hold single-route data (summary/standings, my-leagues), not profile/team/season; normalizing their cache settings is separate from this migration and stays out.
- **Preloading / waterfall elimination** — #247's impact notes a two-stage waterfall (beforeLoad wave → loader wave). This work removes the *redundant requests*; collapsing the remaining waterfall via intent preloading is **#248**, which it unblocks.
- **Reference-data dedup** (drivers / constructors / race-weekends) — **#255**, sequenced onto this foundation.

## Verifying #247's acceptance

#247's AC — no re-request of unchanged profile/team/season, nothing fetched twice per navigation, revisit serves from cache — is **not** checked with a request-count test: dedup-by-shared-key and `staleTime` caching are TanStack Query guarantees (the strategy's "don't test third-party internals"), and exact-count assertions are brittle. It's verified instead by:

- **construction + review** — each read goes through the one colocated `queryOptions` (single key by definition), its freshness is intentional (profile/team set `staleTime: 5 * 60_000`; season inherits the client defaults — see Conventions), and *no stray direct `getMyTeam` / `getCurrentProfile` / `getCurrentSeason` remains in a loader* (the double-call #247 measured); and
- **re-running #247's network capture** once Commit 7 lands (manually or via the `verify` skill against a prod-like build) — confirming profile/team/season each drop to once-per-navigation and serve from cache.

The automated suite stays on the correctness failure modes the migration could break — existence-from-summary, create-team's has-team gating, #249's no-misroute, the user-switch reset — per the strategy's "failure modes, not scenarios."

---

## Commit 1 — Backend: `/me/profile` returns `hasTeam`, sheds the embedded team

- `UserProfileResponse`: drop `TeamResponse? Team`, add `bool HasTeam`. `UserProfileResponseMapper`: `HasTeam = userProfile.Team != null` — the read keeps `.Include(x => x.Team)` and the mapper derives existence from the loaded nav. (Projecting only existence in SQL was considered and dropped: `.Include(x => x.Team)` loads one small team row, and #247's request-dedup goal is a frontend concern, untouched by this DB read.)
- Frontend `src/contracts/UserProfile.ts`: add `hasTeam: boolean`. It's a required field, so also seed the `createMockUserProfile` default and the raw `UserProfile` literals in `userProfileService.test.ts` (`tsc -b` type-checks tests under `src`).
- **Tests:** `UserProfileResponseMapper` unit owns the `HasTeam` true/false matrix + field copy; one integration test (WebApplicationFactory + Testcontainers) for the contract — a user with a team gets `hasTeam: true` and no `team` field (the false branch isn't re-walked at HTTP). No existing test asserted the embedded-team shape.
- **Check:** no other server-side consumer relies on `UserProfileResponse.Team` — `RegisterUserAsync` returns the same DTO (no team exists at registration, so it's safe, but confirm).
- **Gate:** backward-compatible — the current frontend already ignores the embedded team; `hasTeam` is additive.

## Commit 2 — Backend: `/me/team/summary` returns `teamName`

- `TeamSummaryResponse` + mapper add `TeamName` (free — `GetTeamSummaryForUserAsync` is already team-scoped). Frontend `src/contracts/TeamSummary.ts`: add `teamName: string`. Update CONTEXT.md is already done.
- **Tests:** integration asserting `teamName`; mapper unit.
- **Gate:** additive, backward-compatible. (Combinable with Commit 1 as one "backend contract" commit if preferred.)

## Commit 3 — Query foundation

- Add `@tanstack/react-query`. Create `src/lib/queryClient.ts`. Wrap `QueryClientProvider` around `InnerApp` in `main.tsx` (above `RouterProvider`; its position relative to `AuthProvider` doesn't matter — `AuthProvider` imports the singleton, not the context). Add `queryClient` to `RouterContext` (and the `createRouter` placeholder context in `router.tsx`); inject the singleton in `InnerApp`'s `RouterProvider`. `renderWithRouter` creates its own per-test client (`retry: false`), wraps the `QueryClientProvider`, injects it into the router context, and returns it — so its caller-facing `routerContext` param and `createBaseRouterContext` are typed `Omit<RouterContext, 'auth' | 'queryClient'>` (callers never pass `queryClient`).
- No read-site changes — profile/team/season still flow through context.
- **Tests:** `createBaseRouterContext` still supplies profile/team/season for now; `queryClient` is owned by `renderWithRouter`, not caller-supplied. The new required `RouterContext` field also forces the guard unit-test context literals to add `queryClient` and the three integration-test wrapper signatures (`leagues`, `join-invite`, `league-invite-dialog`) to widen their `Omit` to `'auth' | 'queryClient'`. Existing suite stays green.
- **Gate:** pure infrastructure, no behavior change.

## Commit 4 — Migrate `season` to a query

- `seasonService`: add `seasonQuery`. Index / `my-team` / `team/$id` loaders `ensureQueryData(seasonQuery)` instead of reading `context.currentSeason`. Remove the season fetch from `rootRoute.beforeLoad` and `currentSeason` from `RouterContext` (and `renderWithRouter`). The index loader keeps `summary`/`standings`/`races` as route-owned loader data — only `season` moves to the query.
- **Tests:** the three route tests get a `/seasons/current` MSW handler and drop `currentSeason` from `routerContext`. The narrowed `RouterContext` also forces `createBaseRouterContext` and the guard unit-test context literals (`route-guards.test.ts`) to drop `currentSeason`.
- **Gate:** season is read entirely through the query; nothing else touched.

## Commit 5 — Migrate `profile` to a query

- `userProfileService`: add `profileQuery`. `rootRoute` gains a loader that primes profile, auth-gated and failure-tolerant: `if (context.auth.user) await context.queryClient.ensureQueryData(profileQuery).catch(() => null)`. Remove profile from `rootRoute.beforeLoad`. (On a cold cache this blocks behind the default pending component — same as today's blocking `beforeLoad`.)
- Chrome consumers — `AppSidebar`, `AccountMenu`, `useCurrentAvatar`, and `IndexRoute`'s greeting name — switch from `useRouteContext` to `useQuery({ ...profileQuery, enabled: !!user })`.
- Identity consumers — `Leaderboard` (marks the viewer's own row by `profile.id`) and `League` (gates the owner-only invite button on `profile.id === league.ownerId`) — also move from `useRouteContext` to `useQuery({ ...profileQuery, enabled: !!user })`, since `profile` is leaving `RouterContext`.
- Existence consumers move off the team object: `useNavDestinations` and `JoinInvite` read `profile.hasTeam`; `Home` takes existence + name from the loader-ensured summary (`home.summary === null` → no-team variant; else `summary.teamName`); drop the `profile === null` clause from `IndexRoute`'s LandingPage branch (anon is `home === null`).
- Account: the loader `ensureQueryData(profileQuery)` and the `Account` component reads `useSuspenseQuery(profileQuery)` (was `useLoaderData`). On profile save, `invalidateQueries(profileQuery)` — the sidebar `useQuery` is persistent (it doesn't remount on navigation), so without this the updated name lags up to `staleTime`. Avatar upload keeps its `avatarEvents` optimistic display but also invalidates `profileQuery` for consistency. Remove `profile` from `RouterContext` (and `renderWithRouter`).
- **Tests:** extract `src/mocks/handlers.ts` + `src/mocks/server.ts` with the now-common profile/team/season defaults; existence-from-summary integration test (incl. a transient profile failure not demoting `Home`); chrome component behavior through the `QueryClientProvider`.
- **Gate:** profile is read through the query everywhere; team is still in context for the guards.

## Commit 6 — Retire the no-team guard (gate create-team in the component)

Independent of the team→query migration: it relies only on Commit 5's `profile` query (`profile.hasTeam`) and leaves `context.team` / `requireTeam` untouched, so it ships on its own — and it lands before Commit 7 so that commit can strip `context.team` without having to migrate a guard that's being deleted.

- **Drop `requireNoTeam`; gate `/create-team` in the component instead.** The backend enforces one-team-per-user (service pre-check + a unique index on `Teams.UserId` → a clean 409, never a duplicate), so the guard carried no integrity value — only UX for a self-inflicted path with no nav entry (`/create-team` is reachable via the `requireTeam` redirect, the Home/`JoinInvite` CTAs shown to no-team users, or a manual URL). Remove `requireNoTeam`, the `_no-team` layout route (reparent `createTeamRoute` directly under `_authenticated`), and the `buildNoTeamLayout` test helper.
- **In-component state.** `CreateTeam` reads `profile.hasTeam` (`useQuery({ ...profileQuery, enabled: !!user })` — primed by the root loader in prod, fetched on mount in tests) and renders a "you already have a team → view your team" state (link to `/my-team`) instead of the form when true. More informative than the old silent redirect, and it self-handles the post-create back button once Commit 7 invalidates `profileQuery` on create.
- **Tests:** delete the `requireNoTeam` cases from `route-guards.test.ts` and the `buildNoTeamLayout` helper; `create-team.integration.test.tsx` drops the `_no-team` layer and adds a "has-team user sees the already-have-a-team message, not the form" case (override `/me/profile` → `hasTeam: true`).
- **Gate:** `/create-team` is gated in the component; `requireTeam` and `context.team` are untouched; the app is shippable.

## Commit 7 — Migrate `team` to a query (fix "/my-team fetched twice")

- **`teamService` + `RouterContext` teardown.** Add `teamQuery` (see Conventions). `requireTeam` and `teamRoute.beforeLoad` become async and read the team via `ensureQueryData(teamQuery)`, returning `void` — same happy path, different jobs:
  - `requireTeam` (on `_team-required`): `null` → redirect `/create-team`; **throw** → propagate (honest error — the #249 fix); team present → continue.
  - `teamRoute.beforeLoad` (`team/$teamId`): reads the team via `ensureQueryData(teamQuery)` for the own-team → `/my-team` redirect. It runs after `requireTeam`, so this is a warm-cache read, not a second fetch.

  Delete the now-empty root `beforeLoad` (the profile-priming `loader` from Commit 5 stays). Remove `team` from `RouterContext` → `{ auth, queryClient }`; `createBaseRouterContext` returns `{}` and the `routerContext` arg becomes droppable. Update `buildRootRoute` (drop the `context.team` seed) and `buildTeamRequiredLayout` (the guard now reads the query, primed via the `/me/team` MSW handler).
- **My-team read migration.** *MyTeamRoute* switches its team read from `useLoaderData` to `useSuspenseQuery(teamQuery)`. The `queryFn` is `Team | null`, so narrow with `if (!team) throw notFound()` — the route already has a fitting `notFoundComponent` (→ Create Team), and `requireTeam` guarantees non-null at runtime, so this is the type-honest backstop, not a live branch. The my-team loader keeps drivers/constructors/races/season **and** adds `ensureQueryData(teamQuery)` (the documented loader-primes + component-`useSuspenseQuery` pairing; a warm-cache hit after the guard). *TeamRoute* (`team/$teamId`) is otherwise untouched — it reads `getTeamById(id)`, a *different* team, route-owned via `useLoaderData`.

  _Why the gate stays in `beforeLoad`, not a loader:_ loaders for the matched chain run in parallel, so a redirect thrown from the `_team-required` loader wouldn't stop the leaf loader from firing — only `beforeLoad` short-circuits the subtree. The `beforeLoad` fetch is gating logic; the leaf-loader fetch is the render read; they share one cache key, so there's no double fetch.
- **Lineup-edit refresh.** Re-point `useLineupPicker`'s `router.invalidate()` to `queryClient.invalidateQueries({ queryKey: teamQuery.queryKey })` (via `useQueryClient()`). Once the read is the query, `router.invalidate()` no longer refreshes it (`ensureQueryData` returns the stale cache), so add/remove driver/constructor would silently stop reflecting. Captain (`Team.handleSetCaptain`) keeps its local optimistic state and stays **#252** (once team is a query, that fix is a one-line `invalidateQueries`).
- **`CreateTeam.onSubmit`.** After `createTeam`, `queryClient.setQueryData(teamQuery.queryKey, created)` + invalidate `profileQuery` (its `hasTeam` flips — also what makes Commit 6's back-button case show the message), then navigate to `/team/$teamId` as today. With `requireNoTeam` already gone there's no stale `null` to bounce on, so `setQueryData` is an optimization (skips a redundant `/me/team` after the POST) — the destination's `requireTeam` reads the team from cache.
- **Error surface (scoped).** Add an `errorComponent` to the `_authenticated` layout route (reusing `ErrorBoundary`/`ErrorFallback`, `onReset={reset}`). The `requireTeam` team-fetch throw (the #249 case) renders there — inside the root `Layout` outlet, so the sidebar stays and the user gets a retry. Placed on the ancestor, not `_team-required` itself, because a route's own `errorComponent` doesn't reliably catch its own `beforeLoad` throw on a hard load (TanStack Router #3462). Leaf routes keep their own `errorComponent`s, so this only catches the layout-guard throw.
- **Tests.**
  - `route-guards.test.ts`: `requireTeam` is async and reads the query — seed the per-test `QueryClient` (`setQueryData(teamKeys.all, mockTeam | null)`), assert redirect-vs-`void`; delete the old `{ team }` return assertions. (`requireNoTeam` cases already removed in Commit 6.)
  - `useLineupPicker.test.ts`: **update** the two `router.invalidate()` assertions — provide a `QueryClient` and assert `invalidateQueries` fires with `teamQuery.queryKey`. This is the real regression guard for the re-point; the team-lineup integration test never completes an add/remove, so it does not cover it.
  - `routeTreeBuilders.tsx`: drop the `context.team` seed from `buildRootRoute` (the guards read the query now).
  - `team-lineup.integration.test.tsx`: update the mirrored my-team route to the new shape (guard primes the query, component `useSuspenseQuery`); stays green as the lineup-**render** regression guard.
  - `create-team.integration.test.tsx`: the create → `/team/$teamId` happy path stays green (`onSubmit` now also primes `teamQuery`).
  - New integration: **#249 transient-500-does-not-misroute** — authed, `/me/team` → 500, navigating to a team route renders the `_authenticated` `errorComponent` (with retry), not `/create-team`.
  - `/me/team` already seeded in the default MSW handlers.
- **Gate:** `RouterContext` is `{ auth, queryClient }`; the root `beforeLoad` is gone. **#247 acceptance:** run `/verify` against a prod-like build — each of `/me/profile`, `/me/team`, `/seasons/current` fetched at most once per navigation and served from cache on revisit; and review confirms no stray direct `getMyTeam` / `getCurrentProfile` / `getCurrentSeason` is left in a loader. (Rationale in "Verifying #247's acceptance" above.)

## Commit 8 — User-switch cache reset

- `AuthProvider`'s `onAuthStateChange`: on a change of user id (gated so the initial session is a no-op), `queryClient.removeQueries({ queryKey: ['me'] })` **then** `router.invalidate()`. Delete `InnerApp.useInvalidateOnUserChange`; drop `AccountMenu.handleSignOut`'s explicit `router.invalidate()` (the subscription now handles `SIGNED_OUT`).
- **Tests:** extract the reset into a testable function and unit-test the id-change → clear-then-invalidate logic; the existing sign-out E2E (`auth.spec`) stays green.
- **Gate:** switching users wipes user-scoped data; global queries (season, later reference data) survive.

## Commit 9 — Test-infra follow-up: `mocks/` import surface + side-effect-only setup file

Cleanup surfaced by Commit 5. That commit extracted `src/mocks/handlers.ts` + `src/mocks/server.ts`, but left `setupTests.ts` re-exporting `server`/`API_BASE` so the ~14 existing `import { … } from '@/setupTests'` sites kept working. That re-export is a back-compat shim, against the grain of both tools: Vitest [`setupFiles`](https://vitest.dev/config/setupfiles) are for side effects that run before each test file (extend `expect`, polyfills, lifecycle hooks), not a module tests import values from; MSW's [Node integration](https://mswjs.io/docs/integrations/node) keeps `server` in a dedicated `mocks/` module that tests import from directly, with the setup file only consuming it to wire `listen`/`resetHandlers`/`close`.

- Add `src/mocks/index.ts` barrel — `export { API_BASE } from './handlers'; export { server } from './server'` — so tests do `import { server, API_BASE } from '@/mocks'`.
- Relocate `setMobileViewport` + its `matchMedia` stub out of `setupTests.ts` into `src/tests/test-utils/matchMedia.ts` (`setMobileViewport` for tests + `installMatchMediaMock` for setup); `setupTests` calls `installMatchMediaMock()` for its side effect and resets via `setMobileViewport(false)` in `afterEach`.
- Repoint the ~14 `@/setupTests` importers: `server`/`API_BASE` → `@/mocks`, `setMobileViewport` → `@/tests/test-utils`. `setupTests.ts` then **exports nothing** — purely the Vitest setup entry (jest-dom, env stubs, `ResizeObserver`, matchMedia install, MSW lifecycle).
- **Tests:** pure refactor, no behavior change — the existing suite is the regression guard; build, lint, format, test stay green.
- **Gate:** `setupTests.ts` exports nothing; tests import shared fixtures from `@/mocks` / `@/tests/test-utils`, never from the setup file.

## Commit 10 — Docs + E2E

- **Land-time docs:** `web/CLAUDE.md` — State Management (router context is `{ auth, queryClient }`; profile/team/season in the Query cache), Data Loading Pattern (`ensureQueryData` in loaders/guards + `useSuspenseQuery`/`useQuery` for those reads; route-owned stays on `useLoaderData`), Frontend Integration Tests (`renderWithRouter` signature + the extracted profile/team/season MSW handlers). Root `CLAUDE.md` — the "initial page load fires three concurrent requests" note. `docs/adr/003` — a one-line "see ADR 006" pointer on the `context.currentSeason!.id` snippet (don't rewrite the body). _CONTEXT.md (Team summary) and ADR 006 are already updated._
- **E2E:** confirm existing journeys cover the contract — `team.spec`'s create-team→`/my-team` already covers the create happy path; `avatar.spec` + `auth.spec` traverse `/me/profile`. Add one same-session **switch-user-no-leak** spec: sign in as A (with team) → sign out → sign in as B → assert B's identity/team, not A's. No migration or seeding-fixture changes (computed `hasTeam`, pre-existing `teamName`).
- **Gate:** docs match shipped code; E2E green.

---

**Dependency order:** 1, 2 (backend contract) → 3 (foundation) → 4 → 5 → 6 → 7 → 8, then 10 (docs) last. The read-site migration spans 5–7: profile (5) before the create-team `hasTeam` state (6, which needs it) before the team→query migration (7, which strips `context.team`, so the no-team guard must already be gone). Commits 1–2 and 4–7 each leave the app in a working, shippable state. Commit 9 is an independent test-infra follow-up: it depends only on Commit 5's `mocks/` extraction and can land any time after.
