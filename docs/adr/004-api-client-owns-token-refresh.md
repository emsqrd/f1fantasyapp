# ADR 004: The API Client Owns Token Refresh; Loaders Degrade Honestly

**Date:** 2026-06-01
**Status:** Proposed

## Context

Authenticated routes fetch user data in route `beforeLoad`/loaders through `apiClient` (`web/src/lib/api.ts`), which attaches the Supabase access token per request from `supabase.auth.getSession()`. `InnerApp` gates the first render on `auth.loading` and mounts `RouterProvider` once the initial session check resolves.

That gate is insufficient: `auth.loading === false` means "a session object exists," not "the access token is currently valid." The access token is short-lived (default 1 hour), and the browser only refreshes it on a timer that runs while the tab is foregrounded. So authenticated requests can fire with a token that is expired (backgrounded-then-refocused tab), not-yet-refreshed, or not-yet-established (immediately after signup), and the API returns 401. `getSession()` refreshes "if necessary," but documented windows remain — post-signup, backgrounded-tab return, concurrent refreshes — where a request still goes out unauthenticated. ([getSession](https://supabase.com/docs/reference/javascript/auth-getsession), [sessions guide](https://supabase.com/docs/guides/auth/sessions))

ADR 003 already eliminates *anon* 401s on `/` via the index loader's auth guard. This ADR addresses the orthogonal case: *authed* requests meeting an expired or stale token.

Today `apiClient.makeRequest` throws on any non-2xx with no recovery, and `rootRoute.beforeLoad` wraps its three-read fan-out (`profile`, `team`, `currentSeason`) in a catch that collapses all three to `null` on any single failure. A transient 401 therefore (a) surfaces as a confusing degraded state or an error boundary, and (b) erases unrelated context, which downstream renders as a misleading terminal state (empty races → "Season complete"). Supabase's recommended remedy is an HTTP-layer interceptor that refreshes once and retries. ([discussion #889](https://github.com/orgs/supabase/discussions/889))

## Decision

**1. Token-expiry recovery lives in `apiClient`, centrally.** On a 401, `makeRequest` attempts a single `supabase.auth.refreshSession()` and retries the request once; if the refresh fails, it signs out and redirects to sign-in. Concurrent 401s share one in-flight refresh promise.

**2. Retry-once, not a request queue.** `auth-js` single-flights its own refresh internally, so concurrent `refreshSession()` calls de-duplicate. A per-request "on 401 → refresh → retry once" is sufficient; we do not build a pause-all/replay-all queue.

**3. Recovery does not live on the Supabase client.** A custom `fetch` passed to `createClient` only wraps requests Supabase itself makes (auth/PostgREST/storage); calls to our own .NET API go through `apiClient`'s `fetch` and would not be covered.

**4. Loaders degrade honestly.** Failure handling distinguishes "absent" (the API returned a null/empty result) from "failed" (a request threw); a single failed read does not erase unrelated context (the root `beforeLoad` resolves its reads independently); and an unknown or unloaded result is never rendered as a settled terminal state.

## Consequences

- Token staleness is recovered in one place, for every authenticated request to our API — not per-route, and not only on the surfaces we remembered to harden.
- `InnerApp`'s `auth.loading` gate no longer has to (and cannot) guarantee token freshness; the client handles expiry that occurs mid-session, which a one-time readiness gate can't.
- The `requireAuth` `getSession()` fallback and similar per-site workarounds become redundant as the readiness story consolidates.
- "Degrade honestly" constrains the UI: a failed schedule load shows a neutral/unavailable state (and, where appropriate, a retry affordance), never "Season complete."
- Retrying idempotent GETs on transient 5xx/network errors layers onto the same `makeRequest` recovery path.

## Alternatives Considered

### Custom `fetch` on the Supabase client
Rejected — it intercepts only Supabase's own requests, not our API calls, which is where these 401s originate.

### Pause-all / refresh-once / replay-all request queue
The fuller interceptor pattern. Rejected as unnecessary: `auth-js` already single-flights the refresh, so retry-once per request reaches the same correctness without the queue's complexity.

### A "token is fresh" gate before the `beforeLoad` fan-out (in `InnerApp` or a root guard)
Rejected — it duplicates what a 401-aware client does for free, adds a blocking pre-flight to every load, and still can't cover tokens that expire mid-session.

### Per-route 401 handling
Rejected — every loader author would re-implement refresh/redirect, and the failures that matter are the ones nobody remembered to handle. The client is the single choke point.

### Keep the catch-all-to-null in root `beforeLoad`
Rejected — collapsing every failure mode to `null` conflates "absent" with "failed" and lets a transient error render as a confident terminal state.
