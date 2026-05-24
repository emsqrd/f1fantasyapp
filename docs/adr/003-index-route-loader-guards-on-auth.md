# ADR 003: `indexRoute` Loader Guards on Auth State

**Date:** 2026-05-24
**Status:** Accepted

## Context

ADR 002 commits `indexRoute` at `/` to render two distinct components (`Home` for authed, `LandingPage` for anon) based on `context.auth.user`. TanStack Router's "Non-Redirected Authentication" guide blesses the component-branch idiom (`component: () => isAuthed ? <Home /> : <Landing />`), but the data-loading docs are silent on conditional fetches inside a `loader`.

`Home` needs three parallel reads to render: `GET /me/team/summary`, `GET /me/standings`, `GET /seasons/current/races`. `LandingPage` needs none. If the loader fires those reads unconditionally, anon visitors to `/` pay for three fetches their branch ignores — three 401s per anon visit, Sentry noise, wasted bandwidth.

## Decision

The `indexRoute` loader guards on `context.auth.user`. When the user is unauthed, the loader returns `{ home: null }`. When authed, the loader fires the three reads in parallel and returns `{ home: { summary, standings, races } }`. The component branches on the loader result:

```ts
loader: async ({ context }) => {
  if (!context.auth.user) return { home: null };
  const [summary, standings, races] = await Promise.all([
    getMyTeamSummary(),
    getMyStandings(),
    getCurrentSeasonRaces(context.currentSeason!.id),
  ]);
  return { home: { summary, standings, races } };
},
component: IndexRoute,
```

## Consequences

- Anon visitors pay zero data cost on `/`.
- The loader shape (`{ home: null | {...} }`) doubles as the auth-state discriminator — the component branches on the loader result, not on a separate `useRouteContext()` call. One source of truth per render.
- This is a local convention, not a TanStack-blessed pattern. A reader who already knows the docs may wonder why the loader has an auth check instead of letting an `_auth` layout redirect. ADR 002 explains why redirect-based auth was rejected for `/`.

## Alternatives Considered

### Fetch unconditionally; component branches on `useRouteContext()`
Closer to the literal docs example for "Non-Redirected Authentication" — loader fires the three reads regardless; component reads `useRouteContext()` for auth state and branches. Rejected because anon visitors would generate three 401s per `/` visit plus matching Sentry noise — the local-convention loader guard costs nothing and avoids both.

### Use `beforeLoad` to skip data fetches for anon
Rejected — `beforeLoad` is documented as the place to throw redirects, not to short-circuit data loading. Using it for non-redirect branching mismatches its idiomatic role and offers no advantage over the loader guard.
