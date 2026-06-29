# Migrate loader-returned reads to the Query store (#308)

## Context

ADR 009 makes TanStack Query the single read store: loaders prime via `context.queryClient.ensureQueryData(...)` and **return nothing**, components read `useSuspenseQuery` (loader-guaranteed) or `useQuery` (independent), and `useLoaderData` is no longer a data path. Several reads predate that decision and still return data from their loaders, so the codebase doesn't yet match the recorded rule (`web/CLAUDE.md` → Data Loading Pattern flags the migration as in-progress).

This migrates the remaining loader-returned reads onto the Query cache, reconciles the writes that feed them, and disables the router's competing loader cache. It moves **storage only** — whether a surface blocks or streams (ADR 008) is unchanged. The reference is already in place: `myTeamRoute` primes `teamQueries.mine()` and `Team.tsx`'s `MyTeamRoute` reads it via `useSuspenseQuery`.

**Decision (confirmed):** `getLeagueStandings`'s factory lives in `standingsService.ts` as `standingsQueries.forLeague(leagueId)`, keyed under the existing `standingsQueries.all` (`['me','standings']`). The join/create writes already invalidate `standingsQueries.all`, so league standings reconciliation comes for free.

## The pattern (applied per route)

For each route below: add the `queryOptions` factory member, convert the loader to prime + return nothing, switch the component to read from cache, and reconcile any write that changes the read.

- **Loader:** replace direct service calls + `return { ... }` with `await context.queryClient.ensureQueryData(<query>)`. Keep `notFound()` guards by reading the primed result: `const x = await ensureQueryData(...); if (!x) throw notFound({ routeId })`. Return nothing.
- **Component:** replace `useLoaderData(...)` with `useSuspenseQuery(<query>)`. The loader guarantees presence; narrow the nullable `queryFn` result with `if (!x) throw notFound()` (as `MyTeamRoute` already does).
- **Reads needing `seasonId`** (race weekends): the component reads `useSuspenseQuery(seasonQueries.current())` (primed by the loader) then `raceWeekendQueries.list(season?.id ?? null)`.

### New factory members

```ts
// leagueService.ts
export const leagueQueries = {
  all: ['leagues'] as const,
  mine: () => queryOptions({ queryKey: [...leagueQueries.all, 'mine'], queryFn: getMyLeagues }),
  available: (searchTerm?: string) =>
    queryOptions({ queryKey: [...leagueQueries.all, 'available', searchTerm ?? null],
                   queryFn: () => getAvailableLeagues(searchTerm) }),
  byId: (id: number) =>
    queryOptions({ queryKey: [...leagueQueries.all, 'detail', id], queryFn: () => getLeagueById(id) }),
};

// raceWeekendService.ts  (nullable seasonId mirrors driverQueries' `seasonYear ?? null`)
export const raceWeekendQueries = {
  all: ['raceWeekends'] as const,
  list: (seasonId: number | null) =>
    queryOptions({ queryKey: [...raceWeekendQueries.all, 'list', seasonId],
                   queryFn: () => (seasonId == null ? [] : getRaceWeekends(seasonId)),
                   staleTime: 5 * 60_000 }),
};

// teamService.ts  (extend existing teamQueries)
byId: (id: number) =>
  queryOptions({ queryKey: [...teamQueries.all, 'detail', id], queryFn: () => getTeamById(id), staleTime: 5 * 60_000 }),
summary: () =>
  queryOptions({ queryKey: [...teamQueries.all, 'summary'], queryFn: getTeamSummary, staleTime: 5 * 60_000 }),

// standingsService.ts  (extend existing standingsQueries — stays under `all`)
forLeague: (leagueId: number) =>
  queryOptions({ queryKey: [...standingsQueries.all, 'league', leagueId], queryFn: () => getLeagueStandings(leagueId) }),
```

### Writes reconciliation

| Write (file) | Add to its existing invalidation |
| --- | --- |
| `createLeague` — `CreateLeague.tsx` | `invalidateQueries({ queryKey: leagueQueries.all })` |
| `joinLeague` — `BrowseLeagues.tsx` | `invalidateQueries({ queryKey: leagueQueries.all })` |
| `joinViaInvite` — `JoinInvite.tsx` | `invalidateQueries({ queryKey: leagueQueries.all })` |
| `createTeam` — `CreateTeam.tsx` | broaden `removeQueries` from `teamQueries.mine().queryKey` to `teamQueries.all` (evicts the now-cached summary too) |

- `leagueQueries.all` is the base prefix, so a single invalidation covers My Leagues, Browse, and the league-detail `byId` (member count). It's added in commit 1 and automatically covers `available`/`byId` once those members exist — the writes are edited once.
- `standingsQueries.all` is already invalidated by all three join/create writes → covers `forLeague`. No change there.
- **Deliberately unchanged:** roster edits (`useLineupPicker`, `useSetCaptain`) keep invalidating only `teamQueries.mine()`. `TeamSummary` (`teamName`, `seasonTotalPoints`, `lastRace`) is not affected by pre-lock roster edits — only `createTeam` flips it (null → present). `getTeamById` needs no write reconciliation: it's a read-only view of *other* teams (own team redirects to `/my-team` in `beforeLoad`).
- **Router cache:** set `defaultPreloadStaleTime: 0` in `createRouter` (`router.tsx`); remove the now-defunct per-route `staleTime`/`gcTime` from `browseLeaguesRoute`, `teamRoute`, `myTeamRoute` (each removed in that route's commit).

## Commit sequence (gates — wait for approval between each)

Each commit is independently green (`npm run web:test`, `web:lint`, `web:format:check`, `web:build`) and migrates one read/route end-to-end including its tests.

**1 — My Leagues (`getMyLeagues`).** Add `leagueQueries` (`all` + `mine`). `leaguesRoute` loader primes `leagueQueries.mine()`; `LeagueList.tsx` reads `useSuspenseQuery` (drop `useLoaderData` + `LeagueListLoaderData`). Add `leagueQueries.all` invalidation to `createLeague`, `joinLeague`, `joinViaInvite`. Tests:
  - Migrate `buildLeaguesListRouteTree`'s loader to the priming shape.
  - **Delete the white-box `isInvalidated`/`setQueryData` invalidation assertions** in `leagues` and `join-invite` — they assert the invalidation *mechanism*, not observable behavior.
  - **Add `league-membership.integration.test.tsx`** verifying that both My Leagues and the Home dashboard reflect a new league after each membership write (create / join-from-browse / join-via-invite). Keep the 3×2 matrix (3 writes × 2 surfaces) — each cell is a distinct failure mode (trigger flow + surface render), not just the shared cache line. The file pins each observed surface's query fresh so the assertion only passes if the write actually invalidated. It spans both `leagueQueries` (My Leagues) and the "comes for free" `standingsQueries` reconciliation (Home), so it reaches slightly past commit 1's My Leagues scope.

**2 — Browse Leagues (`getAvailableLeagues`).** Add `leagueQueries.available`. `browseLeaguesRoute` loader primes it (return nothing); `BrowseLeagues.tsx` reads `useSuspenseQuery` (drop `useLoaderData` + `PublicLeaguesLoaderData`). Remove route `staleTime`/`gcTime`. Tests: migrate `buildBrowseLeaguesRouteTree` loader.

**3 — League detail (`getLeagueById` + `getLeagueStandings`).** Add `leagueQueries.byId` and `standingsQueries.forLeague`. `leagueRoute` loader primes both, keeps the dual `notFound` guard, returns nothing. `League.tsx` + `Leaderboard.tsx` read `useSuspenseQuery` via `routeApi.useParams()` (drop `routeApi.useLoaderData()`). Tests — migrate the inline loaders to the priming shape, and **consolidate the duplicated league-detail loader coverage**:
  - **Delete `league-loader.integration.test.tsx`.** Its only non-duplicated case (standings-404 → not-found) is the second arm of the same `notFound` check already tested in the `leagues` "League page" block; its stated zod-schema-pinning purpose is unrealized (all three tests use a valid param). It's also the suite's only mechanism-named single-route loader file, against `web/CLAUDE.md`'s "name files by user flow" convention.
  - **Fold into the `leagues` "League page" block** so league-detail loader coverage lives in one place: success, league-404, standings-404 (moved in), loader-500 → errorComponent. Upgrade that block's inline mirror to use the real `leagueIdParamsSchema` (matching production, replacing the bare `Number(params.leagueId)`), and **add an invalid-param → not-found test** — the param-validation branch nobody currently exercises. Net coverage gain, not loss.
  - **`leaderboard.integration.test.tsx`** keeps its own inline loader (it primes data to assert leaderboard row rendering, not loader branching) — migrate it to the priming shape.

**4 — My Team race weekends (`getRaceWeekends`).** Add `raceWeekendQueries`. `myTeamRoute` loader primes `raceWeekendQueries.list(season?.id ?? null)` instead of returning `{ races }`; `MyTeamRoute` reads season + race weekends via `useSuspenseQuery` (drop `useLoaderData`). Remove route `staleTime`/`gcTime`. Tests: migrate `buildMyTeamRouteTree` loader in `team-lineup.integration.test.tsx`.

**5 — Team detail (`getTeamById` + races).** Add `teamQueries.byId`. `teamRoute` loader primes `teamQueries.byId(teamId)` + race weekends, keeps `notFound` guard, returns nothing. `TeamRoute` reads team + season + races via `useSuspenseQuery` (drop `useLoaderData`). Remove route `staleTime`/`gcTime`. Tests: migrate `buildTeamByIdRouteTree` loader in `view-team.integration.test.tsx`.

**6 — Home (`getTeamSummary` + races).** Add `teamQueries.summary`. `indexRoute` loader: keep the anonymous short-circuit, otherwise prime season + `teamQueries.summary()` + race weekends, return nothing. Split `IndexRoute.tsx`: `useAuth()` gate → `LandingPage` when anonymous, else an `AuthedHome` child that reads summary/season/races via `useSuspenseQuery` and renders `<Home>` (keeps the existing `useQuery(profileQueries.current())` stream and `summary === null` → CreateTeamHero path). Broaden `createTeam`'s `removeQueries` to `teamQueries.all`. Tests:
  - Migrate the inline `indexRoute` loader in `root-routing.integration.test.tsx` to the priming shape. `route-error-recovery.integration.test.tsx` has no index-loader mirror (its `/probe` route loads `getAvailableLeagues`), so nothing to migrate there. The summary-failure case still holds.
  - **No summary-refresh integration test.** Considered one (create from the no-team Home → return Home → assert the team variant), but it recomposes already-covered ground — the Home variants are pinned in `Home.test.tsx` + `root-routing`, the create workflow in `create-team` — leaving the cache invalidation as its only net-new assertion. Per TanStack Query guidance, broad invalidation is the safeguard, not something to test per consuming surface. The `teamQueries.all` eviction stays as the fix; the manual browser check (below) remains its coverage.
  - **Simplify the create-team happy-path test to the request wire contract.** Drop the white-box `getQueryData(...)` assertion. The post-create landing render is owned by the existing e2e create-team journey (it renders the real `/my-team` and would crash on a slim-body seed), so the integration test asserts only what e2e can't see: the trimmed name is sent as `{ name }`. No evict-not-seed surface — observing the eviction needs a stand-in destination, which is testing the mechanism.
  - **Drop `root-routing`'s `summaryCalls`/`racesCalls` fetch-count assertions.** The rendered outcome (the leagues widget recovers on retry) proves the behavior; the counts only pin region independence with no DOM signal — a mechanism detail the sibling "degrades only the leagues widget" test already covers through rendered output.
  - **Document the cache-testing conventions in `web/CLAUDE.md`:** don't assert Query cache internals, arrange data through MSW, don't test broad invalidation per consuming surface.

**7 — Disable the router loader cache.** Set `defaultPreloadStaleTime: 0` in `createRouter`. Verify no per-route `staleTime`/`gcTime` remain and no `useLoaderData` data reads survive (`grep`). This is the convergence gate.

**8 — Freshness policy: base `staleTime` 0 (opt-in staleness).** Follow-on cleanup the migration made necessary. Earlier commits put the same uncommented `staleTime: 5 * 60_000` on every read they moved (the earliest on `profileQuery`, 3ab5507), regardless of how often each read's data actually changes — making staleness the implicit default. On cross-user reads this client can't invalidate, that widened the freshness window with no refresh path inside it: notably `teamQueries.byId`, where a viewed team's roster can show stale for up to 5 min (≈10s pre-migration; surfaced in review). Flip the default so staleness is opt-in and fails safe — a forgotten annotation costs a wasted background refetch, not stale data on screen.
  - **`queryClient.ts` → bare `new QueryClient()`:** remove the `staleTime: 60_000` override so the QueryClient default (`0`) stands, and drop `gcTime: 5 * 60_000` (already the v5 default). Drop the two remaining overrides too — both differ from the v5 defaults but neither earns a global: `refetchOnWindowFocus: false` works against this commit's base-0 model (focus *is* engagement; the documented lever for refetch noise is per-query `staleTime`, not a global focus-off — scope it to an offending query if one ever appears), and `retry: 1` is an unprincipled bare count (retries un-retryable 4xx once, under-retries transient 5xx; services already map 404→null before Query reaches it) with no basis over the default `3`. The client now defers entirely to library defaults.
  - **Strip the blanket `staleTime: 5 * 60_000`** from the 7 reads that carry it: `teamQueries.{mine,byId,summary}`, `raceWeekendQueries.list`, `driverQueries.list`, `constructorQueries.list`, `profileQueries.current`. They inherit `0` → `refetchOnMount`/`OnWindowFocus`/`OnReconnect` revalidate on engagement (stale-while-revalidate: instant cached paint, fresh moments later). Cross-user reads (`byId`, `standings.forLeague`, league lists — which never carried a `staleTime`) get correct freshness for free.
  - **Lone opt-out:** `seasonQueries.current` → `staleTime: Infinity` (static within a session — changes annually; `Infinity`, not `'static'`, so manual invalidation still works). The only read that states its own window; everything else uses the default.
  - **Tests — no changes needed.** Nothing asserts a query `staleTime`. The only test `staleTime` references are the six `setQueryDefaults(leagueQueries.all | standingsQueries.all, { staleTime: 60_000 })` freshness pins in `league-membership.integration.test.tsx` — per-key preconditions that override the global default, so they stay intact. Dropping the global to `0` adds only one `refetchOnMount` background refetch per loader-primed query (window-focus and reconnect events don't fire in jsdom): served identically by MSW (no `once: true` handlers), no rendered-output change, no re-suspend. The singleton's options never reach the suite anyway — `renderWithRouter` builds a separate per-test `QueryClient` (`retry: false`, otherwise library defaults), so dropping `refetchOnWindowFocus`/`retry` from it is likewise test-invisible. The suite's four call-count assertions are on auth callbacks and a state-guarded invite fetch (`League.tsx` `useState`, not a query) — none on a query whose `staleTime` changes.

**9 — Join invite preview (`previewInvite`).** Retire the last return-data route onto the Query store. `joinInviteRoute` is the one read #308 left on `useLoaderData` + `return { preview }`, and its unguarded null path crashes the render — verified: a `200` with a `null` body throws `Cannot read properties of null (reading 'leagueName')` and trips the error boundary instead of showing Invite Not Found, because `previewInvite` can *return* null (not throw) on `2xx`-empty/`204`/non-JSON responses (`api.ts:123–138`) and the `as JoinInviteLoaderData` cast hides it.
  - **Factory** (`leagueInviteService.ts`): `leagueInviteQueries = { all: ['leagueInvite'], preview: (token) => queryOptions({ queryKey: [...all, 'preview', token], queryFn: () => previewInvite(token) }) }`. No `staleTime` — inherits the base-0 default (commit 8).
  - **Loader** (`joinInviteRoute`): `await context.queryClient.ensureQueryData(leagueInviteQueries.preview(params.token))` inside the existing `try` (keep `400 → notFound({ routeId })`, rethrow 5xx/network); then `if (!preview) throw notFound({ routeId })` for the `2xx`-null/empty path. Return nothing. Two absence signals (400 thrown, null returned) converge on `notFound`.
  - **Component** (`JoinInvite.tsx`): `const { token } = useParams(...)`; `const { data: preview } = useSuspenseQuery(leagueInviteQueries.preview(token)); if (!preview) throw notFound();`. Drop `useLoaderData` + the `JoinInviteLoaderData` interface/cast; the narrowing throw matches `Team`/`Leaderboard`.
  - **Writes:** none — `joinViaInvite` already invalidates `leagueQueries.all` + `standingsQueries.all`, and the user navigates away on join, so the preview needs no reconciliation.
  - **Preload:** now Query-backed, so a hover-preload + click dedupes through the cache like every other route — closes the return-data double-`previewInvite` the review noted under `defaultPreloadStaleTime: 0`.
  - **Tests** (`join-invite.integration.test.tsx`): migrate the mirror `joinInviteRoute` loader to the priming shape (ensureQueryData + both `notFound` guards, return nothing); the mirror component reads `useSuspenseQuery`. **Add the missing null-preview arm:** a `200` with a null/empty body renders "Invite Not Found", not a crash (the 400 and 500 arms already exist; this is the non-400 absence the bug exposed).
  - **Convergence:** this was the last `useLoaderData` data-read and the last return-data loader; after it, commit 7's "no `useLoaderData` data reads" invariant holds app-wide, not just across the commit 1–6 components.

## Key files

- Factories: `web/src/services/{leagueService,raceWeekendService,teamService,standingsService}.ts`; freshness cleanup (commit 8) also touches `{driverService,constructorService,userProfileService,seasonService}.ts`; join invite (commit 9) adds `leagueInviteService.ts`
- Query client default (commit 8): `web/src/lib/queryClient.ts`
- Routes + router config: `web/src/router.tsx`
- Components: `IndexRoute.tsx`, `LeagueList.tsx`, `BrowseLeagues.tsx`, `League.tsx`, `Leaderboard.tsx`, `Team.tsx`, `JoinInvite.tsx` (commit 9)
- Writes: `CreateLeague.tsx`, `BrowseLeagues.tsx`, `JoinInvite.tsx`, `CreateTeam.tsx`
- Tests: `web/src/tests/integration/{leagues,join-invite,leaderboard,team-lineup,view-team,root-routing,route-error-recovery,create-team}.integration.test.tsx`; **add** `league-membership.integration.test.tsx` (commit 1); **delete** `league-loader.integration.test.tsx` (commit 3, folded into `leagues`)

## Verification

- **Per commit:** `npm run web:test` (or `web:test:integration` focused) + `web:lint` + `web:format:check` + `web:build`, all green.
- **After commit 7, grep the convergence invariants:** no `useLoaderData` data reads remain in the migrated components; no `staleTime`/`gcTime` on routes in `router.tsx`; `defaultPreloadStaleTime: 0` is set.
- **After commit 8, grep the freshness invariants:** no `staleTime: 5 * 60_000` remains in `src/services`; `queryClient` is a bare `new QueryClient()` with no `defaultOptions`; `seasonQueries.current` is the only read with an explicit `staleTime`.
- **After commit 9:** no `useLoaderData` data-read or return-data loader remains anywhere (`joinInviteRoute` was the last holdout); `leagueInviteQueries.preview` is primed in the loader and read via `useSuspenseQuery`.
- **Final regression gate (once, end of PR):** run the existing e2e suite — `cd e2e/supabase && supabase start`, then `npm run e2e`. No new e2e tests are added (this migration's failure modes belong at the integration layer); the existing sign-in → build-team → join-league → view-scores journeys traverse the migrated reads and their invalidating writes against the real API, confirming cache wiring and invalidation keys hold beyond MSW.
- **Manual browser check (dev stack, throwaway user)** — these are the runtime payoffs tests don't fully surface:
  - Edit your team, then go Home — the summary still reflects identity (no stale wipe).
  - Create a league / join from Browse / join via invite link — My Leagues and the league member count reflect it on next view (no stale list).
  - Create a team from the no-team Home, navigate back Home — summary flips from CreateTeamHero to the team variant.
  - League leaderboard shows your row after you join.
  - **(commit 8)** View another team (`/team/$id`), change its roster server-side, return within seconds — the viewed roster updates (no multi-minute stale window).
