# Plan: TanStack Query for Cross-Route Reads (#247)

Implementation plan for #247, following the decision in [ADR 006](../adr/006-tanstack-query-for-cross-route-reads.md) — the ADR holds the *why*, this plan the *how*. Tracking: #254.

The same commits carry the fix for **#249** (a transient load failure misread as "no team"): deleting the catch-all-to-`null` `beforeLoad` removes its cause, and Commits 5–6 implement the throw-vs-`null` handling. But the code alone doesn't *guarantee* it — a guard that swallowed the throw back to `null` would silently reintroduce #249 — so it closes only when its regression tests (Commits 5–6: transient-failure-doesn't-misroute, profile-blip-doesn't-demote-Home) are green. Closable here, not closed by the migration.

## Conventions (used across commits)

**`queryClient` singleton** — `src/lib/queryClient.ts` (mirrors `src/lib/supabase.ts`), imported by `main.tsx` (provider), `InnerApp` (router context injection), and `AuthProvider` (reset). Defaults:

```ts
new QueryClient({
  defaultOptions: { queries: {
    staleTime: 60_000, gcTime: 5 * 60_000, refetchOnWindowFocus: false, retry: 1,
  }},
});
```

**`queryOptions` colocated in the service modules**, with key factories — `['me', …]` for user-scoped, bare for global. The `['me']` prefix is load-bearing: it's the namespace the user-switch reset (Commit 7) clears with one `removeQueries({ queryKey: ['me'] })`, which is why season and (later) reference data stay *outside* it. Per-resource definitions:

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

**Mutations** — once a read is a query, the old "mutate → `router.invalidate()` → loader refetches" path no longer refreshes it (`router.invalidate()` doesn't touch the Query cache; `ensureQueryData` returns the stale entry). Every write that changes profile or team must `queryClient.invalidateQueries(...)` (or `setQueryData`) the affected query — see Commits 5–6.

Each commit below is a gate: it includes its own tests and independently passes build, lint, test, and format. Backend (data/contract) lands before the frontend consumes it; the foundation lands before the read-site migration; each migration empties one more of the old `rootRoute.beforeLoad` fan-out.

## Scope — not in this plan

- **Route-owned loader `staleTime`** — #247's evidence notes it's absent on `index`/`leagues`/`account`. Those loaders hold single-route data (summary/standings, my-leagues), not profile/team/season; normalizing their cache settings is separate from this migration and stays out.
- **Preloading / waterfall elimination** — #247's impact notes a two-stage waterfall (beforeLoad wave → loader wave). This work removes the *redundant requests*; collapsing the remaining waterfall via intent preloading is **#248**, which it unblocks.
- **Reference-data dedup** (drivers / constructors / race-weekends) — **#255**, sequenced onto this foundation.

## Verifying #247's acceptance

#247's AC — no re-request of unchanged profile/team/season, nothing fetched twice per navigation, revisit serves from cache — is **not** checked with a request-count test: dedup-by-shared-key and `staleTime` caching are TanStack Query guarantees (the strategy's "don't test third-party internals"), and exact-count assertions are brittle. It's verified instead by:

- **construction + review** — each read goes through the one colocated `queryOptions` (single key by definition), its freshness is intentional (profile/team set `staleTime: 5 * 60_000`; season inherits the client defaults — see Conventions), and *no stray direct `getMyTeam` / `getCurrentProfile` / `getCurrentSeason` remains in a loader* (the double-call #247 measured); and
- **re-running #247's network capture** once Commit 6 lands (manually or via the `verify` skill against a prod-like build) — confirming profile/team/season each drop to once-per-navigation and serve from cache.

The automated suite stays on the correctness failure modes the migration could break — existence-from-summary, the create-team no-bounce, #249's no-misroute, the user-switch reset — per the strategy's "failure modes, not scenarios."

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
- Chrome consumers — `AppSidebar`, `AccountMenu`, `useCurrentAvatar`, and `IndexRoute`'s greeting name — switch from `useRouteContext` to `useQuery(profileQuery, { enabled: !!user })`.
- Existence consumers move off the team object: `useNavDestinations` and `JoinInvite` read `profile.hasTeam`; `Home` takes existence + name from the loader-ensured summary (`home.summary === null` → no-team variant; else `summary.teamName`); drop the `profile === null` clause from `IndexRoute`'s LandingPage branch (anon is `home === null`).
- Account: the loader `ensureQueryData(profileQuery)` and the `Account` component reads `useSuspenseQuery(profileQuery)` (was `useLoaderData`). On profile save, `invalidateQueries(profileQuery)` — the sidebar `useQuery` is persistent (it doesn't remount on navigation), so without this the updated name lags up to `staleTime`. Avatar upload keeps its `avatarEvents` optimistic display but also invalidates `profileQuery` for consistency. Remove `profile` from `RouterContext` (and `renderWithRouter`).
- **Tests:** extract `src/mocks/handlers.ts` with the now-common profile/team/season defaults; existence-from-summary integration test (incl. a transient profile failure not demoting `Home`); chrome component behavior through the `QueryClientProvider`.
- **Gate:** profile is read through the query everywhere; team is still in context for the guards.

## Commit 6 — Migrate `team` to a query (guards → `void`, create-team bounce fix)

- `teamService`: add `teamQuery`. `requireTeam` / `requireNoTeam` / `teamRoute.beforeLoad` become async and call `ensureQueryData(teamQuery)`, returning `void`: `null` → `/create-team`, **throw** → propagate (honest error — the #249 fix), team present → continue. Remove `team` from `rootRoute.beforeLoad` (now empty → delete the `beforeLoad`) and from `RouterContext`, now `{ auth, queryClient }` (`createBaseRouterContext` returns `{}` and the `routerContext` arg becomes droppable).
- **My-team read migration (the "/my-team fetched twice" fix):** `Team.tsx`'s *MyTeamRoute* switches its team read from `useLoaderData` to `useSuspenseQuery(teamQuery)`, and the my-team loader drops `getMyTeam` (keeping drivers/constructors/races). *TeamRoute* (`team/$id`) is left alone — it reads `getTeamById(id)`, a *different* team, route-owned via `useLoaderData`.
- **Lineup-edit refresh:** re-point `useLineupPicker`'s `router.invalidate()` to `queryClient.invalidateQueries(teamQuery)`. Once the read is the query, `router.invalidate()` no longer refreshes it (`ensureQueryData` returns the stale cache), so add/remove driver/constructor would silently stop reflecting without this. Captain (`Team.handleSetCaptain`) keeps its local optimistic state and stays **#252** — #247 neither regresses nor fixes it (once team is a query, #252 is a one-line `invalidateQueries(teamQuery)`).
- `CreateTeam.onSubmit`: after `createTeam`, `queryClient.setQueryData(teamQuery.queryKey, created)` + invalidate `profileQuery`, then navigate — otherwise the `null` cached by `requireNoTeam` on `/create-team` bounces the user back.
- **Tests:** guard unit tests seed the QueryClient (`setQueryData(['me','team'], null | mockTeam)`) and assert redirect-vs-`void` (the old `{ team }` return assertions delete; the guards are async now); `/me/team` MSW handler; create-team no-bounce integration; #249 transient-500-does-not-misroute integration; the existing **team-lineup integration test stays green** — it's the regression guard for the `useLineupPicker` → `invalidateQueries(teamQuery)` re-point.
- **Gate:** `RouterContext` is `{ auth, queryClient }`; the root `beforeLoad` is gone. **#247 acceptance:** run `/verify` against a prod-like build — navigating the authenticated routes fetches each of `/me/profile`, `/me/team`, `/seasons/current` at most once per navigation and serves them from cache on revisit; and review confirms no stray direct `getMyTeam` / `getCurrentProfile` / `getCurrentSeason` is left in a loader. (Rationale in "Verifying #247's acceptance" above.)

## Commit 7 — User-switch cache reset

- `AuthProvider`'s `onAuthStateChange`: on a change of user id (gated so the initial session is a no-op), `queryClient.removeQueries({ queryKey: ['me'] })` **then** `router.invalidate()`. Delete `InnerApp.useInvalidateOnUserChange`; drop `AccountMenu.handleSignOut`'s explicit `router.invalidate()` (the subscription now handles `SIGNED_OUT`).
- **Tests:** extract the reset into a testable function and unit-test the id-change → clear-then-invalidate logic; the existing sign-out E2E (`auth.spec`) stays green.
- **Gate:** switching users wipes user-scoped data; global queries (season, later reference data) survive.

## Commit 8 — Docs + E2E

- **Land-time docs:** `web/CLAUDE.md` — State Management (router context is `{ auth, queryClient }`; profile/team/season in the Query cache), Data Loading Pattern (`ensureQueryData` in loaders/guards + `useSuspenseQuery`/`useQuery` for those reads; route-owned stays on `useLoaderData`), Frontend Integration Tests (`renderWithRouter` signature + the extracted profile/team/season MSW handlers). Root `CLAUDE.md` — the "initial page load fires three concurrent requests" note. `docs/adr/003` — a one-line "see ADR 006" pointer on the `context.currentSeason!.id` snippet (don't rewrite the body). _CONTEXT.md (Team summary) and ADR 006 are already updated._
- **E2E:** confirm existing journeys cover the contract — `team.spec`'s create-team→`/my-team` already guards the bounce fix; `avatar.spec` + `auth.spec` traverse `/me/profile`. Add one same-session **switch-user-no-leak** spec: sign in as A (with team) → sign out → sign in as B → assert B's identity/team, not A's. No migration or seeding-fixture changes (computed `hasTeam`, pre-existing `teamName`).
- **Gate:** docs match shipped code; E2E green.

---

**Dependency order:** 1, 2 (backend contract) → 3 (foundation) → 4 → 5 → 6 (read-site migration; 5 before 6 so nav/join touch `profile.hasTeam` once) → 7 → 8. Commits 1–2 and 4–6 each leave the app in a working, shippable state.
