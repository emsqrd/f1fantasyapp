# Plan: TanStack Query for Cross-Route Reads (#247)

Implementation plan for #247, following the decision in [ADR 006](../adr/006-tanstack-query-for-cross-route-reads.md) — the ADR holds the _why_, this plan the _how_. Tracking: #254.

The same commits carry the fix for **#249** (a transient load failure misread as "no team"): deleting the catch-all-to-`null` `beforeLoad` removes its cause, and Commits 5 and 7 implement the throw-vs-`null` handling. But the code alone doesn't _guarantee_ it — a guard that swallowed the throw back to `null` would silently reintroduce #249 — so it closes only when its regression tests (Commits 5 and 7: transient-failure-doesn't-misroute, profile-blip-doesn't-demote-Home) are green. Closable here, not closed by the migration.

## Conventions (used across commits)

**`queryClient` singleton** — `src/lib/queryClient.ts` (mirrors `src/lib/supabase.ts`), imported by `main.tsx` (provider; wires the user-switch reset) and — once Commit 8b moves context injection out of `InnerApp` — `router.tsx`. Defaults:

```ts
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
```

**`queryOptions` colocated in the service modules**, with key factories — `['me', …]` for user-scoped, bare for global. The prefix is organizational, not load-bearing: the user-switch reset (Commit 8c) wipes the whole query cache rather than the `['me']` namespace, so a user-scoped query keyed outside the prefix can't leak across identities. Per-resource definitions:

```ts
// userProfileService.ts
export const profileKeys = { all: ['me', 'profile'] as const };
export const profileQuery = queryOptions({ queryKey: profileKeys.all, queryFn: () => userProfileService.getCurrentProfile(), staleTime: 5 * 60_000 });
// teamService.ts
export const teamKeys = { all: ['me', 'team'] as const };
export const myTeamQuery = queryOptions({ queryKey: teamKeys.all, queryFn: getMyTeam, staleTime: 5 * 60_000 });
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
- **Preloading / waterfall elimination** — #247's impact notes a two-stage waterfall (beforeLoad wave → loader wave). This work removes the _redundant requests_; collapsing the remaining waterfall via intent preloading is **#248**, which it unblocks.
- **Reference-data dedup** (drivers / constructors / race-weekends) — **#255**, sequenced onto this foundation.

## Verifying #247's acceptance

#247's AC — no re-request of unchanged profile/team/season, nothing fetched twice per navigation, revisit serves from cache — is **not** checked with a request-count test: dedup-by-shared-key and `staleTime` caching are TanStack Query guarantees (the strategy's "don't test third-party internals"), and exact-count assertions are brittle. It's verified instead by:

- **construction + review** — each read goes through the one colocated `queryOptions` (single key by definition), its freshness is intentional (profile/team set `staleTime: 5 * 60_000`; season inherits the client defaults — see Conventions), and _no stray direct `getMyTeam` / `getCurrentProfile` / `getCurrentSeason` remains in a loader_ (the double-call #247 measured); and
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

Independent of the team→query migration: it relies only on Commit 5's `profile` query (`profile.hasTeam`) and leaves `context.team` / `requireTeam` untouched, so it stands on its own — and it lands before Commit 7 so that commit can strip `context.team` without having to migrate a guard that's being deleted.

- **Drop `requireNoTeam`; gate `/create-team` in the component instead.** The backend enforces one-team-per-user (service pre-check + a unique index on `Teams.UserId` → a clean 409, never a duplicate), so the guard carried no integrity value — only UX for a self-inflicted path with no nav entry (`/create-team` is reachable via the `requireTeam` redirect, the Home/`JoinInvite` CTAs shown to no-team users, or a manual URL). Remove `requireNoTeam`, the `_no-team` layout route (reparent `createTeamRoute` directly under `_authenticated`), and the `buildNoTeamLayout` test helper.
- **In-component state.** `CreateTeam` reads `profile.hasTeam` (`useQuery({ ...profileQuery, enabled: !!user })` — primed by the root loader in prod, fetched on mount in tests) and renders a message-only "you already have a team" state instead of the form when true. No in-card link: `useNavDestinations` already exposes "My Team" → `/my-team` in the sidebar and mobile nav exactly when `hasTeam` is true (the same condition this state renders under), so a link would duplicate the persistent nav. More informative than the old silent redirect, and it self-handles the post-create back button once Commit 7 invalidates `profileQuery` on create.
- **Tests:** delete the `requireNoTeam` cases from `route-guards.test.ts` and the `buildNoTeamLayout` helper; `route-guards.integration.test.tsx` and `create-team.integration.test.tsx` both drop the `_no-team` layer — the former also deletes its `requireNoTeam` wiring test, the latter adds a "has-team user sees the already-have-a-team message, not the form" case (override `/me/profile` → `hasTeam: true`).
- **Gate:** `/create-team` is gated in the component; `requireTeam` and `context.team` are untouched. The create-then-join flow (`league.spec.ts:97`) stays red here — `JoinInvite`'s `profile.hasTeam` isn't refreshed after a team is created until Commit 7 invalidates `profileQuery` on create — and goes green there.

## Commit 7 — Migrate `team` to a query (fix "/my-team fetched twice")

- **`teamService` + `RouterContext` teardown.** Add `myTeamQuery` (see Conventions). `requireTeam` and `teamRoute.beforeLoad` become async and read the team via `ensureQueryData(myTeamQuery)`, returning `void` — same happy path, different jobs:
  - `requireTeam` (on `_team-required`): `null` → redirect `/create-team`; **throw** → propagate (honest error — the #249 fix); team present → continue.
  - `teamRoute.beforeLoad` (`team/$teamId`): validates the `teamId` param (early-return on a bad one), then reads the team via `ensureQueryData(myTeamQuery)` for the own-team → `/my-team` redirect. It runs after `requireTeam`, so this is a warm-cache read, not a second fetch.

  Delete the now-empty root `beforeLoad` (the profile-priming `loader` from Commit 5 stays). Remove `team` from `RouterContext` → `{ auth, queryClient }`; `createBaseRouterContext` returns `{}` and the `routerContext` arg becomes droppable. Update `buildRootRoute` (drop the `context.team` seed) and `buildTeamRequiredLayout` (the guard now reads the query, primed via the `/me/team` MSW handler).

- **My-team read migration.** _MyTeamRoute_ switches its team read from `useLoaderData` to `useSuspenseQuery(myTeamQuery)`. The `queryFn` is `Team | null`, so narrow with `if (!team) throw notFound()` — the route already has a fitting `notFoundComponent` (→ Create Team), and `requireTeam` guarantees non-null at runtime, so this is the type-honest backstop, not a live branch. The my-team loader keeps drivers/constructors/races/season **and** adds `ensureQueryData(myTeamQuery)` (the documented loader-primes + component-`useSuspenseQuery` pairing; a warm-cache hit after the guard). _TeamRoute_ (`team/$teamId`) is otherwise untouched — it reads `getTeamById(id)`, a _different_ team, route-owned via `useLoaderData`.

  _Why the gate stays in `beforeLoad`, not a loader:_ loaders for the matched chain run in parallel, so a redirect thrown from the `_team-required` loader wouldn't stop the leaf loader from firing — only `beforeLoad` short-circuits the subtree. The `beforeLoad` fetch is gating logic; the leaf-loader fetch is the render read; they share one cache key, so there's no double fetch.

- **Lineup-edit refresh.** Re-point `useLineupPicker`'s `router.invalidate()` to `queryClient.invalidateQueries({ queryKey: myTeamQuery.queryKey })` (via `useQueryClient()`). Once the read is the query, `router.invalidate()` no longer refreshes it (`ensureQueryData` returns the stale cache), so add/remove driver/constructor would silently stop reflecting. Captain (`Team.handleSetCaptain`) keeps its local optimistic state and stays **#252** (once team is a query, that fix is a one-line `invalidateQueries`).
- **`CreateTeam.onSubmit`.** After `createTeam`, `queryClient.removeQueries({ queryKey: myTeamQuery.queryKey })` + invalidate `profileQuery` (its `hasTeam` flips — also what makes Commit 6's back-button case show the message, and what un-reds the create-then-join e2e `league.spec.ts:97`: `JoinInvite` re-reads `profile.hasTeam` and shows "Join League"), then navigate to `/team/$teamId` as today. Eviction, not the originally planned `setQueryData(created)`: `POST /teams` returns a slimmer shape than `GET /me/team` (no `drivers`/`constructors`), so caching it crashed `/my-team` on `team.drivers.find` — invisible to the integration test, whose POST mock returns a full team; `team.spec`'s create journey is the contract-drift regression guard. Evicting also clears the `null` a `requireTeam` redirect cached, and the destination's guard fetches the full team (the one `GET /me/team` the seeding was meant to skip).
- **Error surface (scoped).** Add an `errorComponent` to the `_authenticated` layout route (reusing `ErrorBoundary`/`ErrorFallback`, `onReset={reset}`). The `requireTeam` team-fetch throw (the #249 case) renders there — inside the root `Layout` outlet, so the sidebar stays and the user gets a retry. Placed on the ancestor, not `_team-required` itself, because a route's own `errorComponent` doesn't reliably catch its own `beforeLoad` throw on a hard load (TanStack Router #3462). Leaf routes keep their own `errorComponent`s, so this only catches the layout-guard throw.
- **Tests.**
  - `route-guards.test.ts`: `requireTeam` is async and reads the query — seed the per-test `QueryClient` (`setQueryData(teamKeys.all, mockTeam | null)`), assert redirect-vs-`void`; delete the old `{ team }` return assertions. (`requireNoTeam` cases already removed in Commit 6.)
  - `useLineupPicker.test.ts`: **update** the two `router.invalidate()` assertions — provide a `QueryClient` and assert `invalidateQueries` fires with `myTeamQuery.queryKey`. This is the real regression guard for the re-point; the team-lineup integration test never completes an add/remove, so it does not cover it.
  - `routeTreeBuilders.tsx`: drop the `context.team` seed from `buildRootRoute` (the guards read the query now).
  - `team-lineup.integration.test.tsx`: update the mirrored my-team route to the new shape (guard primes the query, component `useSuspenseQuery`); stays green as the lineup-**render** regression guard.
  - `create-team.integration.test.tsx`: the create → `/team/$teamId` happy path stays green (`onSubmit` now also primes `myTeamQuery`).
  - New integration (`route-guards.integration.test.tsx`): **#249 transient-500-does-not-misroute** — authed, `/me/team` → 500, navigating to a team route renders the `_authenticated` `errorComponent` (with retry), not `/create-team`.
  - `view-team.integration.test.tsx`: mirror the new `teamRoute.beforeLoad` — validate the id, early-return on a bad one, else `ensureQueryData(myTeamQuery)` for the own-team redirect; seed `/me/team` so `/team/1` self-redirects and `/team/2` doesn't.
  - **Integration fixtures.** The default `/me/team` handler returns 404 (a no-team user) — it does _not_ hand a team to tests that render a `_team-required` page. Each such test now seeds a present team through `/me/team` instead of the old `context.team`: `leaderboard`, `leagues`, `league-invite-dialog`, `league-loader` (and `view-team` above) swap `createBaseRouterContext({ team: … })` for `server.use(/me/team)` + `createBaseRouterContext()`. (`renderContexts.ts` drops the helper's `overrides` param so it returns `{}`; `renderWithRouter`'s `routerContext` becomes optional.)
- **Gate:** `RouterContext` is `{ auth, queryClient }`; the root `beforeLoad` is gone. **#247 acceptance:** run `/verify` against a prod-like build — each of `/me/profile`, `/me/team`, `/seasons/current` fetched at most once per navigation and served from cache on revisit; and review confirms no stray direct `getMyTeam` / `getCurrentProfile` / `getCurrentSeason` is left in a loader. (Rationale in "Verifying #247's acceptance" above.)

## Commits 8a–8c — synchronous auth store + user-switch cache reset (revises Commit 8)

The original Commit 8 — the reset in `AuthProvider`'s `onAuthStateChange`, then `router.invalidate()` — presupposed the router context is current when the listener fires. It isn't: `RouterProvider` receives `auth` as a React-state snapshot that commits asynchronously, so an invalidate (or a handler's `navigate`) issued in the same tick as the auth event re-runs guards/loaders against the _previous_ user. Verified live: sign-out re-runs the matched authenticated loaders with the token already cleared → a 401 burst (`/me/team/summary`, `/me/standings`, season endpoints — or `/leagues/available` from `/browse-leagues`) → the index `errorComponent` with no recovery; sign-in navigates before the commit, so the index loader still sees `user: null` → LandingPage under the authed chrome, and `InnerApp.useInvalidateOnUserChange` races the in-flight load and loses. Production fails identically on every sign-out (prod Sentry: `GET /me/profile|/me/team|/seasons/current failed`), masked there by the root-`beforeLoad` catch-all (whose removal is the #249 fix) and its fan-out's timing buffer (removed in Commit 7).

The reset is only timing-correct against an auth source that updates synchronously with the Supabase event — supabase-js awaits its `onAuthStateChange` listeners inside `signInWithPassword`/`signOut`, so a store written in the listener is current the moment those calls resolve, with no React commit in the path. That store is **#187** (`useSyncExternalStore`); collapsing token / React state / router context to one truth is **#262**'s direction. Both close with these commits. (TanStack Router's own React `authenticated-routes` example concedes the race — `await sleep(1)` "hack… to wait for the auth state to update"; its Solid variant needs none because signals are synchronous.)

## Commit 8a — synchronous auth store behind `useAuth`

- **`src/lib/authStore.ts`** (mirrors the `supabase.ts` / `queryClient.ts` singleton convention): snapshot `{ user, session, loading, isAuthTransitioning }` plus actions (`signIn` / `signUp` / `signOut` / `startAuthTransition` / `completeAuthTransition`) as `Auth`, replacing `AuthContextType`; `getAuthSnapshot()` / `subscribeAuth()`; `initAuthStore()` wires `getSession()` + `onAuthStateChange`, called once from `main.tsx`. `signIn`/`signUp` bodies move verbatim from `AuthProvider`; `signOut` drops the hand-rolled wait-for-`SIGNED_OUT` promise (supabase-js awaits its listeners — pinned by the timing test below). Test-only helpers: `seedAuthStore(partial)` / `resetAuthStore()`.
- `useAuth` → `useSyncExternalStore(subscribeAuth, getAuthSnapshot)` + actions, same surface — components untouched. Delete `AuthProvider`/`AuthContext` (`src/contexts/`); `main.tsx` calls `initAuthStore()` and drops the provider wrapper. Router context wiring is unchanged in this commit (`InnerApp` still injects from `useAuth()`), so behavior is identical — the bug fixes land in 8b.
- Test infra: `renderWithRouter` drops its `AuthContext.Provider` wrapper and seeds the store from the existing `auth` param (signature, `createUnauthAuth`/`createAuthedAuth`, and their call sites unchanged); `setupTests.ts` adds `resetAuthStore()` to `afterEach`.
- **Tests:** `authStore.test.ts` ports the `AuthContext.test.tsx` matrix to the store. New `auth-store.integration.test.ts` pins the load-bearing timing assumption against the real supabase client + MSW (`auth/v1/token`, `auth/v1/logout`): `getAuthSnapshot()` is current **immediately** after `await signIn()` / `await signOut()` — no `waitFor` — so a supabase-js upgrade that stops awaiting listeners fails loudly.
- **Gate:** same behavior, new source of truth; suite green with no assertion changes beyond the ported matrix.

## Commit 8b — live auth in router context; guards stop compensating

- `authStore.ts` adds `routerAuth`, a getter-backed live view `{ user }`. `RouterContext.auth` narrows to it (`user` is the only field any guard/loader reads), injected at `createRouter` in `router.tsx`; `InnerApp` renders `<RouterProvider router={router} />` with no context prop (keeps the `loading` gate and the transition overlay; `useInvalidateOnUserChange` survives until 8c). Every `context.auth.user` read site stays textually identical but now reads live values — fixing both bugs: sign-out's invalidate finds `user: null`, so `requireAuth` redirects before any authenticated loader fires; sign-in's navigate finds the user, so the index loader takes the Home branch.
- `requireAuth` drops its `getSession()` fallback — the lag it compensated for (#187's motivating case, the #164 bounce) can no longer exist.
- **Tests:** `route-guards.test.ts` deletes the supabase mock and the "context lags but Supabase has a session" case (obsolete failure mode); context literals shrink to `{ auth: { user }, queryClient }`. E2E `auth.spec.ts` sign-out journey hardened: starts from `/my-team` (matched authenticated loaders are what the failure needs) and asserts the error fallback is **not** shown — the existing Sign In-button assertion also passes on the broken error page, which is why the suite never caught this.
- **Gate:** sign-out → landing page with zero 4xx; sign-in → Home without a manual navigation; E2E auth journeys green.

## Commit 8c — user-switch cache reset

- `initAuthStore({ onUserChange })`: fires only on a user-id change after first population (the initial session restore is the baseline; `TOKEN_REFRESHED` / `USER_UPDATED` / same-id re-emits are no-ops). New `src/lib/authReactions.ts` exports `resetCaches(queryClient, router)` — `queryClient.clear()`, `router.clearCache()`, **then** `router.invalidate()` (order load-bearing: the re-run loaders must not read the previous identity's entries). `main.tsx` wires it. Delete `InnerApp.useInvalidateOnUserChange`; drop `AccountMenu.handleSignOut`'s explicit `router.invalidate()` (the reaction runs before `signOut()` even resolves).
- **Both wipes are deliberately blunt.** The originally planned `removeQueries({ queryKey: ['me'] })` carries a forever-convention — every user-scoped query must be keyed under `['me']` — whose violation is a silent cross-user leak; `clear()`'s worst case is a few refetches on a rare event (one serial `seasons/current` fetch inside the sign-in transition). `router.clearCache()` is the router-side analogue, and it also fixes the sign-in flash: with the anonymous `/` match still servable, the `_unauthenticated` guard's redirect SWR-committed the stale landing page and resolved the form's awaited `navigate` early, dropping the transition overlay before the home loader finished. With the match cache empty, the navigate can only resolve at the fresh commit, so the overlay covers the whole load.
- **Tests:** gating matrix in `authStore.test.ts` (initial no-op; sign-in / sign-out / A→B fire; refresh no-op); `authReactions.test.ts` (query cache fully emptied and router cache cleared, both before `invalidate` runs); the 8a integration test extends to assert the reaction fires exactly once per real sign-in/out round-trip; `InnerApp.test.tsx` drops its invalidation block but keeps a minimal `vi.mock('./router', () => ({ router: {} }))` — unmocked, that unit test would load the app's whole route tree. The no-flash property itself has no automated pin (a frame-timing E2E would be flaky); the eviction-order unit test pins the mechanism, and Commit 12's switch-user spec covers the user-visible consequence.
- **Gate:** an identity change wipes both caches and re-runs the matched routes against the new user; nothing fetched or rendered for the previous identity survives.

## Commits 9–11 — moved to #263

The three behavior-neutral cleanups originally planned here — the `mocks/` import surface + side-effect-only setup file, the `profileQuery`/`seasonQuery` → `currentProfileQuery`/`currentSeasonQuery` renames, and dropping the vestigial `createBaseRouterContext` helper — are split to follow-up **#263** (child of #254) to keep this PR reviewable. Their full specs live in that issue. Commit 12 keeps its number; it's referenced above.

## Commit 12 — Docs + E2E

- **Land-time docs:** `web/CLAUDE.md` — State Management (router context is `{ auth, queryClient }`; profile/team/season in the Query cache), Data Loading Pattern (`ensureQueryData` in loaders/guards + `useSuspenseQuery`/`useQuery` for those reads; route-owned stays on `useLoaderData`), Frontend Integration Tests (`renderWithRouter` signature + the extracted profile/team/season MSW handlers). Root `CLAUDE.md` — the "initial page load fires three concurrent requests" note. `docs/adr/003` — a one-line "see ADR 006" pointer on the `context.currentSeason!.id` snippet (don't rewrite the body). _CONTEXT.md (Team summary) and ADR 006 are already updated._
- **E2E:** confirm existing journeys cover the contract — `team.spec`'s create-team→`/my-team` already covers the create happy path; `avatar.spec` + `auth.spec` traverse `/me/profile`; `league.spec`'s create-then-join (`league.spec.ts:97`) exercises the Commit 7 `onSubmit` `profileQuery` invalidation and is red until it lands. Add one same-session **switch-user-no-leak** spec: sign in as A (with team) → sign out → sign in as B → assert B's identity/team, not A's — the journey-level guard for Commit 8c's reset. No migration or seeding-fixture changes (computed `hasTeam`, pre-existing `teamName`).
- **Gate:** docs match the landed code; E2E green.
