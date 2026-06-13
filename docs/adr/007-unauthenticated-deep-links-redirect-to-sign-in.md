# ADR 007: Unauthenticated Access to Protected Routes Redirects to `/sign-in` with a Return URL

**Date:** 2026-06-11
**Status:** Accepted

## Context

The `requireAuth` guard on the `_authenticated` layout redirected unauthenticated users to `/` with no record of where they were headed, so a cold visit to a protected deep link (`/my-team`, `/league/5`) landed on the marketing page and the destination was lost (issue #250).

The `redirectSearchSchema` plumbing for preserving a destination already existed and was *consumed* end to end — `SignInForm`, `SignUpForm` (including across the email-confirmation round-trip via `next`), and `CreateTeam` all read `search.redirect`. But it was only ever *produced* by the `/join/$token` invite flow. The generic guard — the one gate every other protected route passes through — never populated it.

This raised a question ADR 002 does not answer: when an **unauthenticated** user hits a **protected** route, where should the guard send them, and how is the destination preserved? ADR 002 governs where *authed* users and *post-auth* flows land (`/`); it is silent on the pre-auth gate.

## Decision

Follow TanStack Router's canonical authenticated-routes pattern.

- `requireAuth` captures the attempted URL (`location.href`, so query and hash survive) and throws `redirect({ to: '/sign-in', search: { redirect: location.href }, replace: true })`.
- The already-authed bounce that previously lived on the `_unauthenticated` layout moves onto `signInRoute` and `signUpRoute` — the routes that actually validate `redirect` — and honors it instead of hardcoding `/`. (The layout route stays as a grouping wrapper; its route IDs back the `useSearch({ from: '/_unauthenticated/...' })` calls.)
- The sign-in ↔ sign-up toggle links forward `redirect`, so the destination survives whichever path a visitor takes — including a brand-new user who follows a shared deep link and registers rather than signs in.
- The redirect value is validated to internal paths only via a shared `safeInternalPath` helper (resolve against the current origin; reject anything whose resolved origin differs, plus same-origin results whose resolved path is protocol-relative `//…`), closing the open-redirect class — protocol-relative (`//evil.com`), backslash, dot-segment folds that resolve same-origin but to a `//`-prefixed path (`/..//evil.com`), and absolute-external inputs.

Post-auth, the user lands at the captured destination, or `/` when there is none — consistent with ADR 002's default.

## Consequences

- Returning users with bookmarks or shared deep links land on the sign-in form, not the marketing page — the destination is restored after auth.
- **All** unauthenticated access to protected routes now routes through `/sign-in` (e.g. a session expiring mid-session), replacing the prior bounce to `/`. This is the intended behavior, not a regression.
- The `redirect` param is now attacker-influenceable from any protected URL, so it is hardened against open-redirect inputs. The same helper replaces the ad-hoc validator in `ConfirmEmailNotice`.
- The direct paths (sign-in, instant-session sign-up, already-authed bounce) restore the destination in full, including any `#fragment`. The **email-confirmation round-trip does not**: the confirmation template interpolates the destination into `next` unencoded (`api/supabase/templates/confirmation.html`), so a `#` binds to the `/auth/confirm` URL itself and never reaches `next` — path and a single query param survive, the fragment does not. `urlquery`-encoding `next` would close the gap but was rejected: a cosmetic gain (no destination uses a fragment today) against an unverifiable change on the signup critical path. Don't re-add the encoding without rendering the real email and confirming `next` still parses.
- `indexRoute` no longer needs `validateSearch: redirectSearchSchema` — with this decision nothing sends `redirect` to `/`.

## Alternatives Considered

### Keep redirecting to `/`, but carry the destination as `/?redirect=<href>`
Preserve the marketing landing in the middle and have its "Sign In" / "Sign Up" CTAs forward the param onward. Rejected: the cross-framework consensus and TanStack Router's own docs both send an unauthenticated user straight to the login page; routing a returning user through the marketing page is the very bounce a return-URL exists to avoid; and it requires threading the param through the landing CTAs and keeping the dead `validateSearch` on `indexRoute` meaningful.

### Keep redirecting to `/` with no destination
The status quo — rejected because it is the bug (#250).
