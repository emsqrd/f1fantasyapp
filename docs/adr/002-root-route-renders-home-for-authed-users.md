# ADR 002: `/` Renders Home for Authed Users (No `/home` Bounce)

**Date:** 2026-05-24
**Status:** Accepted

## Context

Issue #198 introduces a Home page — an authed landing surface that aggregates cross-domain state (team identity, next race, scoring snapshots, leagues). Before #198, `/` rendered the marketing landing page for everyone, with the `_unauthenticated` layout's `beforeLoad` redirecting authed users to a "default authed destination" (`/leagues` or `/my-team` depending on team state).

TanStack Router's canonical auth pattern uses pathless `_auth` layouts with `beforeLoad` throwing `redirect()` to a login page. Authed-only content lives at distinct paths (`/dashboard`, `/home`, etc.) behind that gate. Following that pattern strictly would mean `/` continues to be Landing-only, with authed users redirected to a new `/home` route post-auth and on every direct visit to `/`.

Both major fantasy-sports competitors (Yahoo Fantasy, ESPN Fantasy) land authed users at `/` directly. The redirect-on-every-`/`-hit pattern was the source of the single-purpose-page-conflation problem #198 was created to fix.

## Decision

`/` is the canonical destination for both anon and authed users. `indexRoute` is mounted as a direct child of `rootRoute` (not under `_unauthenticated`). The component branches on `context.auth.user`: anon → `LandingPage`, authed → `Home`. Every post-auth redirect (sign-in, signup welcome, email confirm) targets `/`.

## Consequences

- No bounce on `/` for either auth state. Direct visits, shared links, and post-auth flows all land at `/` and render the right content based on auth state.
- `_unauthenticated.beforeLoad` (the redirect-authed-away guard) still applies to `/sign-in` and `/sign-up` — those routes stay under `_unauthenticated` and bounce authed users to `/`.
- The `indexRoute`'s `loader` and `component` both have to handle two distinct shapes — see ADR 003 for the loader-side half.
- Issues #199 (redirect refactor) and #200 (signup welcome) both target `/` as their post-auth destination. Reversing this ADR means rewriting both.

## Alternatives Considered

### `/home` for authed users; `/` always Landing
The TanStack-blessed shape. Authed users get redirected from `/` to `/home`. Rejected because it forces a bounce on every direct hit to `/` — the same single-purpose-page redirect problem #198 exists to solve.

### Two routes at `/` via pathless layouts
Use one `_unauthenticated` layout wrapping `LandingPage` and another `_authenticated` layout wrapping `Home`, both children rendering at path `/`. Rejected as awkward — paths are unique in TanStack Router; faking two routes at the same path requires conditional `beforeLoad`-throw-redirect logic that ends up more convoluted than the component branch.
