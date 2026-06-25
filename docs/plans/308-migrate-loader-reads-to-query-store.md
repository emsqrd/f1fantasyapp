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
  - Migrate the inline `indexRoute` loader in `root-routing.integration.test.tsx` to the priming shape; check `route-error-recovery.integration.test.tsx` for an index-loader mirror to migrate too. Verify the summary-failure case still holds.
  - **Add a behavior test for the summary refresh** — the failure mode the `teamQueries.all` broadening exists to fix, currently only in the manual browser check: create a team from the no-team Home, navigate back Home, assert the team-variant summary renders (not CreateTeamHero). This is the observable consequence of evicting the cached summary; the integration layer is where it belongs.
  - **Replace `create-team.integration.test.tsx`'s white-box cache assertion** (`getQueryData(teamQueries.mine().queryKey)).toBeUndefined()`, line ~110) — it asserts the eviction *mechanism*, and its bare-stub destination renders no team data so the consequence is unobservable by construction. Make the evict-not-seed contract observable instead: give the post-create destination a surface that reads `teamQueries.mine()` and renders a field present only in the full `GET /me/team` shape (MSW returns a fuller GET than the slim POST), and assert that field renders. If pinning evict-not-seed without a rendered surface is wanted, push it to a **unit test of `createTeam`'s reconciliation** — not a `getQueryData` assertion inside the flow test. Keep the request-body wire-contract assertion (`create-team:107`) as-is.
  - **Re-evaluate `root-routing`'s `summaryCalls===1`/`racesCalls===1`** (lines ~236-237). It's a fetch-count (mechanism) assertion, but the defensible case: it pins the prime-once-then-read-from-cache contract that is this migration's whole point and has no clean DOM signal. Keep it only if it still pins that after migration (loader primes once, `useSuspenseQuery` doesn't re-issue); if the migration makes it assert something the rendered output already proves, drop it.

**7 — Disable the router loader cache.** Set `defaultPreloadStaleTime: 0` in `createRouter`. Verify no per-route `staleTime`/`gcTime` remain and no `useLoaderData` data reads survive (`grep`). This is the convergence gate.

## Key files

- Factories: `web/src/services/{leagueService,raceWeekendService,teamService,standingsService}.ts`
- Routes + router config: `web/src/router.tsx`
- Components: `IndexRoute.tsx`, `LeagueList.tsx`, `BrowseLeagues.tsx`, `League.tsx`, `Leaderboard.tsx`, `Team.tsx`
- Writes: `CreateLeague.tsx`, `BrowseLeagues.tsx`, `JoinInvite.tsx`, `CreateTeam.tsx`
- Tests: `web/src/tests/integration/{leagues,join-invite,leaderboard,team-lineup,view-team,root-routing,route-error-recovery,create-team}.integration.test.tsx`; **add** `league-membership.integration.test.tsx` (commit 1); **delete** `league-loader.integration.test.tsx` (commit 3, folded into `leagues`)

## Verification

- **Per commit:** `npm run web:test` (or `web:test:integration` focused) + `web:lint` + `web:format:check` + `web:build`, all green.
- **After commit 7, grep the convergence invariants:** no `useLoaderData` data reads remain in the migrated components; no `staleTime`/`gcTime` on routes in `router.tsx`; `defaultPreloadStaleTime: 0` is set.
- **Final regression gate (once, end of PR):** run the existing e2e suite — `cd e2e/supabase && supabase start`, then `npm run e2e`. No new e2e tests are added (this migration's failure modes belong at the integration layer); the existing sign-in → build-team → join-league → view-scores journeys traverse the migrated reads and their invalidating writes against the real API, confirming cache wiring and invalidation keys hold beyond MSW.
- **Manual browser check (dev stack, throwaway user)** — these are the runtime payoffs tests don't fully surface:
  - Edit your team, then go Home — the summary still reflects identity (no stale wipe).
  - Create a league / join from Browse / join via invite link — My Leagues and the league member count reflect it on next view (no stale list).
  - Create a team from the no-team Home, navigate back Home — summary flips from CreateTeamHero to the team variant.
  - League leaderboard shows your row after you join.
