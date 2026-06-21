# Adopt per-resource query factories across the query layer (#305)

## Context

Each of the six cached resources (team, profile, season, standings, drivers, constructors) exposes a single-member key factory like `teamKeys = { all: ['me','team'] }` plus a standalone `…Query`. That shape uses the `all` base _as the query's own key_, so there's no way to invalidate a resource's reads as a group versus a single read — they share one key. It also diverges from the idiomatic TanStack Query factory.

This is a **mechanical, no-behavior-change refactor**. Each resource will expose one per-resource `…Queries` factory: an `all` base key, then one named member per read whose key _extends_ `all`. Invalidate a whole resource through `all`; address a single read through the member's `.queryKey`. Cache keys are ephemeral (rebuilt each session; user-switch reset is `queryClient.clear()` — key-agnostic), so changing the key strings has no observable effect as long as every reader and writer stays consistent.

Reference pattern: [TkDodo — Effective React Query Keys](https://tkdodo.eu/blog/effective-react-query-keys) and [The Query Options API](https://tkdodo.eu/blog/the-query-options-api).

## Target factory shape

`all` stays a **value** (so group-invalidation reads `…Queries.all`, matching today's `…Keys.all` usage). Members are **functions returning `queryOptions`** — required so `list(seasonYear?)` can take a param, and so a member can spread `…Queries.all` into its key without the object-literal init-order trap (the spread runs lazily at call time).

```ts
// teamService.ts
export const teamQueries = {
  all: ['me', 'team'] as const,
  mine: () =>
    queryOptions({
      queryKey: [...teamQueries.all, 'mine'] as const,
      queryFn: getMyTeam,
      staleTime: 5 * 60_000,
    }),
};
```

Per resource (member name → resulting key):

| Service     | Factory              | `all`              | Member             | Key                                   | Notes                                                  |
| ----------- | -------------------- | ------------------ | ------------------ | ------------------------------------- | ------------------------------------------------------ |
| team        | `teamQueries`        | `['me','team']`    | `mine()`           | `['me','team','mine']`                | wraps `getMyTeam`, `staleTime 5m`                      |
| userProfile | `profileQueries`     | `['me','profile']` | `current()`        | `['me','profile','current']`          | wraps `getCurrentProfile`, `staleTime 5m`              |
| season      | `seasonQueries`      | `['season']`       | `current()`        | `['season','current']`                | **key unchanged** from today; no `staleTime`           |
| standings   | `standingsQueries`   | `['me','standings']` | `mine()`         | `['me','standings','mine']`           | wraps `getMyStandings`; no `staleTime`                 |
| driver      | `driverQueries`      | `['drivers']`      | `list(seasonYear?)`  | `['drivers','list', seasonYear ?? null]`      | `queryFn: () => getDrivers(seasonYear)`, `staleTime 5m`      |
| constructor | `constructorQueries` | `['constructors']` | `list(seasonYear?)`  | `['constructors','list', seasonYear ?? null]` | `queryFn: () => getConstructors(seasonYear)`, `staleTime 5m` |

The standalone `…Keys` and `…Query` exports are removed. Non-query reads stay as plain service functions, untouched: team `getTeamById`/`getTeamSummary`, standings `getLeagueStandings`.

Service files: `web/src/services/{team,userProfile,season,standings,driver,constructor}Service.ts`.

## The one nuance that breaks tests if missed

Today several sites **seed/read a specific query at the bare `…Keys.all`**. Now the real query lives at the member key (e.g. `['me','team','mine']`), while `all` (`['me','team']`) is only its prefix. Sort every touchpoint into one of two buckets:

- **Group invalidation → keep `…Queries.all`** (prefix match still hits the member): the standings invalidations in `CreateLeague.tsx`, `JoinInvite.tsx`, `BrowseLeagues.tsx`.
- **Specific read/seed → move to `…Queries.<member>().queryKey`**: anywhere code seeds, reads, removes, or asserts one query.
  - `route-guards.test.ts` — `setQueryData(teamKeys.all, …)` → `teamQueries.mine().queryKey`. **Critical:** `requireTeam` reads `teamQueries.mine()`; seeding at `.all` would leave the guard's read unseeded and trigger a real fetch.
  - `leagues.integration.test.tsx` and `join-invite.integration.test.tsx` — `setQueryData(standingsKeys.all, [])` + `getQueryState(...).isInvalidated` → `standingsQueries.mine().queryKey`. Production still invalidates via `standingsQueries.all`; the member key extends it, so the prefix invalidation marks it — and now the test verifies the _real_ read is invalidated, not a synthetic group entry.
  - `web/CLAUDE.md` renderWithRouter snippet `setQueryData(teamKeys.all, mockTeam)` → `teamQueries.mine().queryKey`.

## Consumer migration (mechanical)

Pattern across all consumers: rename the import, then replace the symbol. Reads `myTeamQuery` → `teamQueries.mine()`, `profileQuery` → `profileQueries.current()`, `seasonQuery` → `seasonQueries.current()`, `standingsQuery` → `standingsQueries.mine()`, `driversQuery` → `driverQueries.list()`, `constructorsQuery` → `constructorQueries.list()`. Keys: `myTeamQuery.queryKey` → `teamQueries.mine().queryKey`, etc.

Production consumers:

- `router.tsx` — loaders/guards: `ensureQueryData(profileQuery|seasonQuery|myTeamQuery|driversQuery|constructorsQuery)`. Update the stale `useSuspenseQuery(myTeamQuery)` comment.
- `route-guards.ts` — `ensureQueryData(myTeamQuery)` → `teamQueries.mine()`.
- `Team.tsx` — three `useSuspenseQuery(...)` reads (team/drivers/constructors), drivers+constructors appear twice.
- `MyLeaguesList.tsx` — `useQuery(standingsQuery)` → `useQuery(standingsQueries.mine())`.
- `CreateTeam.tsx` — `useQuery({ ...profileQuery, enabled })`, `removeQueries({ queryKey: myTeamQuery.queryKey })` (specific read → `mine().queryKey`), `invalidateQueries(profileQuery)`.
- `Account.tsx` — `useSuspenseQuery(profileQuery)` + two `invalidateQueries(profileQuery)`.
- Profile-shell `useQuery({ ...profileQuery, enabled: !!user })` → `{ ...profileQueries.current(), enabled: !!user }`: `IndexRoute.tsx`, `Leaderboard.tsx`, `AccountMenu.tsx`, `AppSidebar.tsx`, `League.tsx`, `JoinInvite.tsx`, `useCurrentAvatar.ts`, `useNavDestinations.ts`.
- `useSetCaptain.ts` — four `myTeamQuery.queryKey` sites (cancel/get/set/invalidate); hoist `const teamKey = teamQueries.mine().queryKey;` once in the hook to avoid rebuilding. Update the `useSetCaptain` comment (in `useSetCaptain.test.ts`, references `myTeamQuery`/`teamKeys`) to the new symbol.
- `useLineupPicker.ts` — two `invalidateQueries({ queryKey: myTeamQuery.queryKey })`.

Test consumers (besides the seed/read nuance above): `account.integration.test.tsx` (`ensureQueryData(profileQuery)`, `getQueryData(profileQuery.queryKey)`), `create-team.integration.test.tsx` (`getQueryData(myTeamQuery.queryKey)`), `view-team.integration.test.tsx` + `team-lineup.integration.test.tsx` (`ensureQueryData` of team/season/drivers/constructors), `root-routing.integration.test.tsx` (`ensureQueryData(seasonQuery)`), `useSetCaptain.test.ts` (`setQueryData`/`getQueryData` on `myTeamQuery.queryKey`).

## Docs

- **`web/CLAUDE.md` → Data Loading Pattern.** Add the convention note (verbatim from the issue):
  > **Query definitions.** Each resource's reads live in a per-resource `…Queries` factory in its service module, structured most-generic to most-specific: an `all` base key, then one member per read — named for the read, its key extending `all`.

  Also update the inline example `useQuery({ ...profileQuery, enabled: !!user })` → `{ ...profileQueries.current(), enabled: !!user }`, and the renderWithRouter snippet `setQueryData(teamKeys.all, mockTeam)` → `teamQueries.mine().queryKey`.

- **`docs/adr/003-index-route-loader-guards-on-auth.md`** — de-specify: drop the `queryClient.ensureQueryData(seasonQuery)` symbol; say the loader reads the season from the TanStack Query cache (still link ADR 006).
- **`docs/adr/006-tanstack-query-for-cross-route-reads.md`** — de-specify: `…its 'context.currentSeason!.id' read now goes through 'seasonQuery'` → `…now goes through the Query cache`. (The line that already delegates query definitions/keys to the plan stays — no new ADR.)

## Commits

1. **Query factories + consumers + tests.** Replace the six `…Keys`/`…Query` pairs with `…Queries` factories; update every consumer and test (including the seed/read-vs-invalidate split). Must pass build, lint, test, format with no behavior change.
2. **Docs.** `web/CLAUDE.md` convention note + example updates; ADR 003 & 006 de-specify.

## Verification

- `npm run web:test` — full frontend suite stays green (integration tests exercise the real router/loaders/guards through MSW, so they catch any seed/read key mismatch).
- `npm run web:lint` and `npm run web:format:check` — clean (no dangling `…Keys`/`…Query` imports).
- `rg "teamKeys|profileKeys|seasonKeys|standingsKeys|driverKeys|constructorKeys|myTeamQuery|profileQuery|seasonQuery|standingsQuery|driversQuery|constructorsQuery" web/src` returns nothing.
- `npm run web:build` — type-checks the new factory shapes.
- Optional smoke check against the dev stack: sign in, view Home (standings + leagues), open My Team (team/drivers/constructors load), set a captain (optimistic update + rollback path), create/join a league (standings refreshes).
