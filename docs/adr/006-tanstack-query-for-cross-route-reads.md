# ADR 006: TanStack Query for Cross-Route Reads (profile, team, season)

**Date:** 2026-06-07
**Status:** Proposed

## Context

Three reads the authenticated app needs across many routes — the current user's profile, their team, and the current season — were fetched together in `rootRoute.beforeLoad` and written into router context on every navigation. Measured against the live network, this produced redundant work: all three re-fetched on every navigation (no caching), two of them fetched twice within a single navigation (`/account` re-fetched profile, `/my-team` re-fetched team, each having their own loader call the same service the root `beforeLoad` already called), and they were fetched on pages that don't render them.

The fix has to respect a hard constraint: this data is read both **above `_authenticated`** (the always-on `Layout` chrome, the index route `/`, the invite route `/join/$token`) and inside a **`beforeLoad` guard** (`requireTeam`). Router context flows downward only, and a route's loader cache can't be read from a `beforeLoad`, so neither an `_authenticated` layout loader nor the router's own loader cache can serve all readers at once. A cache that is **not tree-positional** — readable from a guard, a loader, and a component above `_authenticated` alike — is what the situation needs.

This reverses an earlier "not now" call on TanStack Query: the win here is **client-side dedup across guards/loaders/components**, not the SSR dehydration features that earlier note dismissed it on (irrelevant to this SPA).

Tracking issue #254. Closes #247 and #249 (the failure-handling fix shares this code).

## Decision

Adopt TanStack Query for data read **across multiple routes, or in both a guard and a component**. A single `queryClient` lives in router context (so `beforeLoad`/loaders reach it) and behind `QueryClientProvider` (so components reach it); profile, team, and season move out of router context into that cache, leaving context as `{ auth, queryClient }`. This delivers those three reads; the shared reference data — drivers, constructors, race-weekends (#255) — is sequenced onto the same foundation. **Single-route-owned** data — leagues, league/team detail, the index route's summary/standings — stays on the router's loader cache. Not a wholesale migration, and not limited to these three reads.

**The non-obvious part is that each read is ensured where it's consumed, and the placements differ on purpose:** team is ensured in the guards' `beforeLoad` (`requireTeam` / `requireNoTeam` / `teamRoute`), because the whole `beforeLoad` chain runs before any loader and a guard's redirect decision can only read a value ensured in a `beforeLoad`; profile is primed in `rootRoute`'s **loader** (its only readers are the always-on chrome and the account route — no guard reads it, and `rootRoute` is the one ancestor of every authed-reachable route, so it warms the chrome without a flash); season is ensured in the leaf loaders that read `season.id`. A reader expecting all three in one place should know this asymmetry is deliberate.

**Existence sheds the embedded team.** `/me/profile` returns the full team aggregate today and the client discards it; it is replaced by a computed `hasTeam`, and the team name moves to `/me/team/summary`. Existence then has three readers split by concern: **routing** reads the team query (a transient failure **throws** — never a `/create-team` misroute; a `null` is genuine absence), **nav chrome** reads `profile.hasTeam` (tolerant), and **`Home`'s body** reads the loader-ensured summary (`summary === null` ⟺ no team), which fails honestly rather than demoting a team-owner. Reads are not collapsed to `null` by a shared `catch`; transient-failure-versus-genuine-absence is the seam #249 owns.

Implementation specifics — query definitions and keys, freshness windows, read patterns, the user-switch reset, and the create-team cache maintenance — live in the plan (`docs/plans/247-tanstack-query-cross-route-reads.md`), not here.

## Consequences

- Two caches coexist by design, and the boundary is the **access pattern, not the entity**: data read across routes or in both a guard and a component lives in the Query cache (profile/team/season now, the reference data via #255); single-route-owned data stays on the router loader cache. A reader must understand that line — and that the Query layer is expected to grow along it.
- The Query cache outlives navigation and even sign-out within a tab, so a change of user identity must explicitly clear the user-scoped (`['me']`) entries or risk showing one user another's data. The reset runs at the auth-event source (see plan).
- #247 and #249 close together.
- #248 (preloading) and #252 (post-write refresh) become tractable on top: the heavy `beforeLoad` fan-out is gone, and components subscribe to the cache, so an invalidation reactively updates them — the reason reads use `useSuspenseQuery`, not `useLoaderData`.
- New dependency `@tanstack/react-query`, in the production bundle.
- Full-stack change: the `/me/profile` and `/me/team/summary` contracts move in lockstep with the frontend. No schema migration — `hasTeam` is computed from existence and `teamName` already exists on the team.

## Alternatives Considered

### Keep these reads in router context (status quo)
Rejected — re-fetches on every navigation, cannot dedup the data read in both a guard and a component, and produces the duplicate per-navigation fetches that motivated #247.

### A combined `/me/bootstrap` endpoint
Rejected — a single response can't differentiate the three failure points, which #249's honest-degradation requires.

### An `_authenticated` layout loader for profile/team/season
Rejected — the index route, the invite route, and the `Layout` chrome read this data **above** `_authenticated`, and router context/loader data flows downward only, so the layout loader would starve them. The non-tree-positional Query cache is precisely what removes this constraint.

### A team-identity stub on the profile (`{ id, name }`)
Considered as a way to feed both nav existence and Home's team name from one prime. Rejected — it invents a "team identity" concept the domain doesn't have. The team name goes on the team summary instead, where Home already loads it.

### Fully lazy (no root prime; components fetch on render)
Rejected — profile is consumed only by the always-on `Layout`, never by a loader, so on a cold load it would fetch at render time and flash the sidebar. That defers a visible regression to #248 rather than avoiding it.

## References

- Tracking: #254. Closes #247; co-fixes #249, which closes once its regression tests confirm a transient failure no longer reads as "no team." Unblocks #248, #252, #255.
- Builds on ADR 002 (`/` renders Home for authed users) and ADR 003 (index loader guards on auth — its `context.currentSeason!.id` read now goes through `seasonQuery`).
- Composes with ADR 004 (apiClient owns token refresh): the QueryClient's `retry: 1` layers onto `makeRequest`'s recovery.
