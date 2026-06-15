# Plan: Dedupe drivers & constructors across routes via TanStack Query (#255)

## Context

Each route loader fetches the active-driver and active-constructor lists independently,
and the router's loader cache keys by route — so navigating `my-team` ↔ `team/$teamId`
re-fetches these large, slow-changing lists every time (latency only, no correctness
issue). Moving both onto the TanStack Query cache (keyed by query key, not route — the
ADR 006 foundation already used for profile/team/season) makes them fetch once and share.
Scope is drivers + constructors only; race-weekends are split to #278.

One focused commit — services, loaders, and components must change together (the build
breaks otherwise), and the updated tests ship with it.

`getDrivers` / `getConstructors` have no callers besides the two loaders below
(`CreateTeam` doesn't use them), so this is the complete change surface.

## 1. Services — add `queryOptions`

`web/src/services/driverService.ts` (mirror in `constructorService.ts`), leaving
`getDrivers` / `getConstructors` unchanged:

```ts
import { queryOptions } from '@tanstack/react-query';

export const driverKeys = { all: ['drivers'] as const };

export const driversQuery = queryOptions({
  queryKey: driverKeys.all,
  queryFn: () => getDrivers(),
  staleTime: 5 * 60_000,
});
```

- **Wrap the `queryFn` in an arrow**, not a bare `queryFn: getDrivers` like `seasonQuery` —
  these take an optional `seasonYear`, so the bare form fails `strict` tsc (TanStack's
  context arg doesn't fit the param). Parameterless matches the fixed `['drivers']` /
  `['constructors']` keys.
- `staleTime: 5 * 60_000`, default `gcTime` — mirrors `profileQuery`.

## 2. Loaders — `web/src/router.tsx`

In `teamRoute` (`team/$teamId`) and `myTeamRoute` (`my-team`): replace `getDrivers()` /
`getConstructors()` with `context.queryClient.ensureQueryData(driversQuery)` /
`ensureQueryData(constructorsQuery)`, and drop `activeDrivers` / `activeConstructors` from
the returned object. Reorder `Promise.all` so route-owned reads come first:

```ts
const [team, races] = await Promise.all([
  getTeamById(teamId),
  season ? getRaceWeekends(season.id) : Promise.resolve([]),
  context.queryClient.ensureQueryData(driversQuery),
  context.queryClient.ensureQueryData(constructorsQuery),
]);
return { team, races };          // myTeamRoute → return { races };
```

- **Delete the loaders' explicit inline return-type annotation** (`): Promise<{...}> =>`)
  and let it infer, as `indexRoute` already does — don't rewrite the annotation.
- Update imports: drop `getDrivers` / `getConstructors` and the now-unused `Driver` /
  `Constructor` types; add the two queries. Leave `indexRoute` alone — it doesn't read
  these.

## 3. Components — `web/src/components/Team/Team.tsx`

In `MyTeamRoute` and `TeamRoute`, read the two lists via `useSuspenseQuery` instead of
`useLoaderData`:

```ts
const { data: activeDrivers } = useSuspenseQuery(driversQuery);
const { data: activeConstructors } = useSuspenseQuery(constructorsQuery);
```

Keep `useLoaderData` for `team` (TeamRoute) and `races` (both); `MyTeamRoute` still reads
`team` via `useSuspenseQuery(myTeamQuery)`. `TeamView` and the pickers stay prop-driven —
unchanged. Add the query imports.

## 4. Tests

Update the two integration trees that mirror these loaders —
**`view-team.integration.test.tsx`** and **`team-lineup.integration.test.tsx`**: change
their inline loaders the same way (ensureQueryData, drop the two fields, swap the service
imports for the query imports), and **keep** their local `/drivers` + `/constructors` MSW
handlers (the queries still hit those endpoints). These already mount the routes and
assert the pickers populate — that's the coverage for the new read path.

No new automated test: the dedup is the library's by-key caching and a latency-only
optimization with no rendered difference (verified manually below); key-sharing is
structural via the single `driversQuery`. The `getDrivers` / `getConstructors` unit tests
and the default MSW handlers are untouched.

## Verification

1. `npm run web:test` — full frontend suite green (the two updated trees populate their
   pickers through the new read path).
2. `npm run web:lint`, `npm run web:format:check`, `npm run web:build` — clean (no unused
   imports in `router.tsx`; loader inference + component switch typecheck).
3. **Manual — where the latency win is verified:** `npm run web:dev`, open DevTools
   Network, sign in, visit `/my-team`, then open a league and click another member's team
   (`/team/$teamId`). Confirm `/drivers` and `/constructors` each fire **once** across
   both views, not once per route.
