# Plan — Issue #164: Require email confirmation on signup

## Context

Email confirmations are currently enabled in dev/e2e (`enable_confirmations = true` in `api/supabase/config.toml:176` and `e2e/supabase/config.toml`). The feature wires:

1. Signup gates on email confirmation (Supabase returns `session: null` until confirmed).
2. A pending "check your email" UI with both magic-link and typed-OTP completion paths.
3. Resend, with rate-limit handling.
4. Friendly handling when an unconfirmed user later signs in.

**Out of scope:**

- Branded email template content (deferred to #22).
- Standardizing post-auth redirect destinations app-wide (deferred to #165).
- Production Supabase dashboard configuration (manual post-deploy: enable Confirm Email, add redirect allowlist patterns, upload custom template, raise rate limits, configure SMTP).

---

## Decisions

| Decision                                | Choice                                                                                                                                                                                                                                                                                       | Rationale                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Auth flow                               | Implicit (Supabase `createClient` defaults: `flowType: 'implicit'`, `detectSessionInUrl: true`)                                                                                                                                                                                              | Documented SPA pattern. Verified at `GoTrueClient.ts:184-194`. The PKCE flow's `signUp` writes `code_challenge` (`GoTrueClient.ts:899-924`) but `resend` does not (`2535-2574`), which broke the resend path; implicit sidesteps the asymmetry.                                                                                                                                |
| Magic-link verification                 | SDK auto-detects `#access_token=...` from URL fragment during `_initialize`                                                                                                                                                                                                                  | No callback loader needed; `_initialize` saves the session and fires `SIGNED_IN`. On success the SDK strips the hash (`GoTrueClient.ts:3702-3703`); on failure it leaves `#error_description=...` for the app to read.                                                                                                                                                         |
| Typed-OTP verification                  | `supabase.auth.verifyOtp({ email, token, type: 'email' })`                                                                                                                                                                                                                                   | No alternative for typed codes. `'email'` is the type for email-confirmation OTPs from the custom template's `{{ .Token }}`.                                                                                                                                                                                                                                                   |
| Confirmation method in email            | Both magic link and OTP code                                                                                                                                                                                                                                                                 | Resilient to corporate email scanners that pre-fetch links (Supabase auth issue [#1214](https://github.com/supabase/auth/issues/1214)). The custom template includes `{{ .ConfirmationURL }}` and `{{ .Token }}`.                                                                                                                                                              |
| Email link construction                 | `{{ .ConfirmationURL }}` only                                                                                                                                                                                                                                                                | Supabase owns the URL. No template-side concatenation, no `&token_hash=` append, no requirement that `buildEmailRedirectTo` always include a query string.                                                                                                                                                                                                                     |
| Callback route                          | None                                                                                                                                                                                                                                                                                         | The implicit flow's auto-detect runs against whatever URL the user lands on. No app-side loader required.                                                                                                                                                                                                                                                                      |
| Post-confirm destination                | Caller of `signUp`/`resendConfirmation` passes `emailRedirectTo` directly (full URL). Default: `${origin}/`. Dynamic: `${origin}${search.redirect}` when SignUpForm was reached via a redirect param (e.g., `/sign-up?redirect=/join/<token>`).                                              | One source of truth for "where does this user land": the `emailRedirectTo` URL itself. No parallel `?redirect=` URL parameter, no `getPostSignupDestination` helper. Route guards continue to own routing for users landing at any given URL.                                                                                                                                  |
| Cross-browser invite preservation       | Encoded in `emailRedirectTo`                                                                                                                                                                                                                                                                 | Supabase forwards `emailRedirectTo` verbatim through `/verify`. A user who signs up from `/join/<token>` on desktop and confirms via the email on mobile lands directly at `/join/<token>` on mobile, signed in.                                                                                                                                                               |
| `/` route handling                      | Add `beforeLoad` that bounces authenticated users to `/create-team` or `/leagues` based on team state                                                                                                                                                                                        | Mirrors the existing pattern on `/sign-in` (`router.tsx:218-228`) and `/sign-up` (`router.tsx:240-250`). Eliminates the "marketing content rendered inside authenticated app shell" weirdness when a signed-in user lands at `/`. Single home for post-auth routing: route guards.                                                                                             |
| Confirmation-link failure UX            | `readConfirmationLinkError()` helper (in `lib/auth-redirect.ts`) wraps `supabase.auth.initialize()`, type-guards, and returns `'expired' \| 'generic' \| null` based on `error.details?.code`. `indexRoute.beforeLoad` calls it to decide whether to redirect to `/sign-up` with `replace: true`. `signUpRoute.beforeLoad` calls it (same cached promise — free) and returns the code as route context. `SignUpForm` reads via `useRouteContext({ from: '/sign-up' })` and renders `<InlineError>` with the mapped message. | `getSession()` discards `_initialize` errors (verified at `GoTrueClient.ts:2661-2671`), but `initialize()` itself returns them — that's the documented hook. Matching on the typed `otp_expired` code (verified in gotrue `verify.go`) beats string-matching descriptions, per Supabase's own [error-handling docs](https://supabase.com/docs/guides/auth/debugging/error-codes). Route context (vs. AuthContext state) keeps AuthContext focused on session/user and avoids a cleanup-on-unmount effect; the message naturally clears on navigation away from `/sign-up`. |
| Supabase redirect allowlist             | Wildcards: `http://localhost:5173/**` (dev), `http://localhost:5273/**` (e2e). Production: tightened to specific patterns per surface (`https://<prod>/`, `https://<prod>/join/**`, etc.).                                                                                                   | Required to allow dynamic `emailRedirectTo` paths. Wildcard support confirmed in Supabase docs; `**` matches any sequence including separators.                                                                                                                                                                                                                                |
| `requireAuth` `getSession()` fallback   | Kept                                                                                                                                                                                                                                                                                         | Still load-bearing: AuthContext's React state lags Supabase's session state by one render after any auth state change. Without the fallback, freshly-confirmed users bounce back to `/` because `context.auth.user` is briefly null in `beforeLoad`.                                                                                                                           |
| Email passing into `<CheckEmailNotice>` | React state from parent (`SignUpForm`, later `SignInForm`)                                                                                                                                                                                                                                   | Same as the original commit 2 design. Supabase identifies the user by token; email is only for display + the typed-OTP `verifyOtp` call. No URL params (OWASP: PII shouldn't appear in URLs).                                                                                                                                                                                  |
| Failure message for typed-OTP           | Static generic message: _"That code didn't match. Check your email for the latest one."_                                                                                                                                                                                                     | Same as the original commit 2 design.                                                                                                                                                                                                                                                                                                                                          |
| Sign-in unconfirmed handling            | Deferred                                                                                                                                                                                                                                                                                     | Commits 4-8 do not include the SignInForm wiring for `email_not_confirmed`. The original commit 5 plan is preserved as future work but is not part of this rework. The rework focuses on getting the signup path onto the correct foundation; the signin-unconfirmed UX reuses the same `<CheckEmailNotice>` and can be added afterward without affecting the rework's design. |

---

## Commits

### Commit 1 — PKCE flow + `/auth/callback` loader (`23ca5ec`)

Original design: switched the Supabase client to `flowType: 'pkce'` with `detectSessionInUrl: false`, added a `/auth/callback` route with a loader that called `exchangeCodeForSession`, and added `getPostSignupDestination` in `web/src/lib/auth-destination.ts`. Commit 4 reverts the client to defaults, deletes the route, and deletes the helper.

### Commit 2 — `<OtpInput>` primitive + `<CheckEmailNotice>` component (`d4a632b`)

The typed-OTP path UI. Unchanged by the rework. `verifyOtp` is called with `type: 'signup'` — the type string Supabase's email-confirmation flow uses for OTPs minted via `signUp`. End-to-end verified against real Supabase by the OTP signup E2E in commit 8.

### Commit 3 — Enable confirmations + SignUpForm wiring (`de592bc`)

- **Kept by commit 4:** `enable_confirmations = true` config flip in both `api/supabase/config.toml` and `e2e/supabase/config.toml`. The custom email template file (its content gets rewritten). `requireAuth`'s `getSession()` fallback.
- **Superseded by commit 4:** the `redirect: string` option threaded through `signUp`. The token_hash-style email template URL. The SignUpForm wiring that called `getPostSignupDestination`.

---

### Commit 4 — Replace PKCE callback with implicit-flow defaults (`93fa04a`)

**Goal:** undo the PKCE/callback infrastructure and the redirect plumbing. After this commit, the email-confirmation flow works end-to-end via either path. Users land at `${origin}/` post-confirm; the `/` route has no `beforeLoad` for authed users yet (commit 5 adds it), so a signed-in user briefly sees `LandingPage` rendered inside the authenticated app shell — functional but visually unpolished. Build/lint/test all pass.

**Files modified:**

- `api/supabase/templates/confirmation.html` — **no change in this commit**. The user customized this template (structure, text, styling) and committed those customizations in `de592bc`. The only uncommitted edit was the token_hash URL surgery on the link `href`, which the prerequisite `git restore .` step reverts automatically. After `git restore .` the template is already in the correct state for the new design (link `href = {{ .ConfirmationURL }}`). Do not regenerate or replace the file.
- `api/supabase/config.toml` — `additional_redirect_urls = ["http://localhost:5173/**"]`. Keep the comment minimal (this file is local-CLI only; the production allowlist is configured in the Supabase dashboard, covered in "Production deployment notes" below).
- `e2e/supabase/config.toml` — `additional_redirect_urls = ["http://localhost:5273/**"]`.
- `e2e/tests/_infra/config-sync.spec.ts` — extend `IGNORED_KEY_RE` to ignore `site_url` and `additional_redirect_urls` (the wildcard hosts differ between dev and e2e). This part survives from the old commit 3.
- `web/src/lib/supabase.ts` — `createClient(url, key)` with no options. No `flowType`, no `detectSessionInUrl`.
- `web/src/router.tsx` — delete `authCallbackRoute` declaration, `authCallbackSearchSchema`, its entry in `rootRoute.addChildren`, and any related imports (`Sentry`, `Link` if only used there, etc.). Leave `requireAuth`'s fallback intact.
- `web/src/contexts/AuthContext.tsx` + `.ts` — `signUp` signature becomes `signUp(email, password, additionalData, options?: { emailRedirectTo?: string })`. Default: `emailRedirectTo: ${window.location.origin}/`. The implementation passes `options?.emailRedirectTo` straight through to `supabase.auth.signUp`'s options.
- `web/src/components/auth/SignUpForm/SignUpForm.tsx` — remove `getPostSignupDestination` import and usage. Compute `emailRedirectTo` as `${window.location.origin}/` (hardcoded for this commit; commit 5 makes it dynamic). For the typed-OTP `onVerified` navigation in the same browser, navigate to `search.redirect ?? '/'` using the existing React state — let `indexRoute.beforeLoad` (added in commit 5) handle the actual routing decision rather than hardcoding `/create-team` here.

**Files deleted:**

- `web/src/lib/auth-destination.ts`
- `web/src/lib/auth-destination.test.ts`
- `web/src/tests/integration/auth-callback.integration.test.tsx`

**Tests updated:**

- `web/src/contexts/AuthContext.test.tsx` — drop the `redirect` option tests. Add tests for the new shape: `signUp` calls Supabase with `emailRedirectTo: ${origin}/` when no option is passed; `signUp` passes `options.emailRedirectTo` through verbatim when provided.
- `web/src/components/auth/SignUpForm/SignUpForm.test.tsx` — drop redirect-threading assertions; assert `signUp` is called with `emailRedirectTo: ${origin}/`.
- `web/src/lib/route-guards.test.ts` — keep the `requireAuth` `getSession()` fallback test. Remove any references to `auth-callback` or `auth-destination`.
- `web/src/lib/supabase.test.ts` — update for the no-options `createClient`.

**Verification:**

1. `cd api/supabase && supabase stop && supabase start` and the e2e equivalent to pick up config changes.
2. `npm run web:test` + `npm run web:lint` + `npm run web:format:check` + `npm run web:build` green.
3. Manual: signup with a fresh email → `<CheckEmailNotice>` appears → Mailpit (`http://127.0.0.1:54324`) shows the email → clicking the magic link auto-establishes session and lands the user at `${origin}/` (visually: marketing content inside the authenticated app shell — fixed in commit 5). Typing the OTP code → `verifyOtp` succeeds → navigate to `${origin}/` (same visual state as the magic-link path; fixed in commit 5).
4. `npm run e2e` green (the admin-API fixture continues to bypass email via `email_confirm: true`).

---

### Commit 5 — Route authenticated users from `/` and pass redirect via `emailRedirectTo`

**Goal:** add `beforeLoad` to `indexRoute` so authenticated users hitting `/` bounce to their app home. Make `SignUpForm` pass `search.redirect` through `emailRedirectTo` so the magic-link path preserves the destination across the email round-trip (including cross-browser cases).

**Files modified:**

- `web/src/router.tsx` — add `beforeLoad` to `indexRoute` (currently has none at `router.tsx:201-206`):

  ```typescript
  beforeLoad: async ({ context }) => {
    if (context.auth.user) {
      throw redirect({
        to: context.teamContext.hasTeam ? '/leagues' : '/create-team',
        replace: true,
      });
    }
  },
  ```

  Also add `validateSearch: redirectSearchSchema` if not already present (verify against the existing schema usage on `/sign-in` and `/sign-up`).

- `web/src/components/auth/SignUpForm/SignUpForm.tsx` — at the top of the component, compute the destination once and reuse for `emailRedirectTo` and for the in-browser `onVerified` navigation:

  ```typescript
  const search = useSearch({ from: '/sign-up' });
  const destination = search.redirect ?? '/';
  const emailRedirectTo = `${window.location.origin}${destination}`;
  ```

  Pass `emailRedirectTo` into `signUp({ emailRedirectTo })`. Use `destination` for the typed-OTP `onVerified` navigate call.

  Default is `/` (not `/create-team`) so the auth-flow code carries no feature knowledge. `indexRoute.beforeLoad` is the single home for "where does a signed-in user land" — both the magic-link path (different browser possible) and the typed-OTP path (same browser) funnel through it.

**Tests:**

- `web/src/components/auth/SignUpForm/SignUpForm.test.tsx` — assert `signUp` called with `emailRedirectTo: ${origin}/` when no `search.redirect`; assert `emailRedirectTo: ${origin}/join/abc-123` when `search.redirect = '/join/abc-123'`. The typed-OTP `onVerified` destination assertion is already covered by the existing "navigates to redirect path when redirect search parameter is provided" test from commit 4.
- `web/src/tests/integration/root-routing.integration.test.tsx` — new file. Mount a per-test route tree with `indexRoute` (carrying the real `beforeLoad`) plus bare stub routes for `/create-team` and `/leagues` whose headings are the redirect-target assertion surface. The `/` component is a stub heading rather than the real `LandingPage` so landing-page text changes don't break the test. Destination routes are not parented under `_no-team` / `_authenticated/_team-required` layouts because those guards are already covered in `route-guards.integration.test.tsx`; isolating to `indexRoute.beforeLoad`'s `teamContext.hasTeam` ternary is what's new in commit 5. Assert: unauthed user stays at `/`; authed-no-team user lands at `/create-team`; authed-with-team user lands at `/leagues`.

**Verification:**

1. `npm run web:test` + lint/format/build green.
2. Manual: visit `/` signed out → `LandingPage`. Sign in via existing user → bounces to `/leagues` or `/create-team` based on team state. Click logo (sidebar) while authed → bounces. Sign up from `/sign-up?redirect=/join/<token>`, confirm via the email link in a different browser → land directly at `/join/<token>` signed in (`JoinInvite` renders for an authed user).

---

### Commit 6 — Route confirmation-link failures to `/sign-up` with an inline error

**Goal:** when Supabase's `/verify` redirects back with an error (expired token, consumed link, invalid token), redirect the user to `/sign-up` and surface a friendly message above the form. The recovery action ("sign up again to get a new link") lives next to where it can be taken.

**Why redirect instead of a layout-wide banner:** the default `emailRedirectTo` lands users on `/`. A banner over the marketing landing page is jarring, and the recovery action (sign up again) requires hunting for the Sign Up button. Routing to `/sign-up` colocates the message with the action.

**Why read the error via `supabase.auth.initialize()` instead of parsing the URL hash ourselves:** the SDK auto-runs `initialize()` in its constructor and caches the result. `getSession()` discards the URL-parse error, but `initialize()` itself returns it — that's the documented hook for reading auth-redirect failures. Avoids re-implementing the SDK's own URL parsing and means we work in terms of typed error codes (`error.details.code`), not pattern-matching on the human-readable description (which Supabase docs explicitly warn against).

**Why route context instead of AuthContext state:** the error isn't ongoing auth state — it's a one-shot routing concern (the user just landed from a failed redirect). Putting it in AuthContext required a cleanup `useEffect` on `SignUpForm` unmount, which coupled unrelated lifecycles. Route context, set in `signUpRoute.beforeLoad`, is recomputed on navigation and naturally clears when the user leaves `/sign-up`. AuthContext stays focused on session/user.

**Files added:**

- `web/src/lib/auth-redirect.ts` — `readConfirmationLinkError()` returns `'expired' | 'generic' | null`. Wraps `supabase.auth.initialize()`, type-guards on `isAuthImplicitGrantRedirectError`, maps `error.details?.code === 'otp_expired'` to `'expired'` and any other redirect error to `'generic'`. Non-redirect errors (network failures, etc.) return `null` — they're handled wherever the originating call surfaces.
- `web/src/lib/auth-redirect.test.ts` — one test per mapped case plus the null fallbacks (success, non-redirect error).

**Files modified:**

- `web/src/router.tsx`
  - `indexRoute.beforeLoad`: when the user isn't signed in, `await readConfirmationLinkError()` and `throw redirect({ to: '/sign-up', replace: true })` if it returns a code. The redirect with `replace: true` overwrites the failed-URL history entry, so back-button / refresh / share don't re-trigger.
  - `signUpRoute.beforeLoad`: after the existing auth check, `return { confirmationError: await readConfirmationLinkError() }`. The cached `initializePromise` means this is the same value indexRoute saw — free. TanStack Router merges the return into the route's context, accessible via `useRouteContext({ from: '/sign-up' })`.
- `web/src/components/auth/SignUpForm/SignUpForm.tsx` — reads `confirmationError` from `useRouteContext({ from: '/sign-up' })`. Maps the code to a user-facing message via a `CONFIRMATION_ERROR_MESSAGES` map at module scope. Renders `<InlineError>` above the form when set.

**Files NOT created (deliberate departures from the original plan):**

- No `auth-url-errors.ts` helper / `mapAuthUrlError` function. The lib is `auth-redirect.ts` with `readConfirmationLinkError`, and the code→message mapping is a small lookup in `SignUpForm`.
- No `<InlineError>` banner in `Layout.tsx`. The redirect approach makes the layout-wide banner unnecessary.
- No URL hash stripping. The redirect with `replace: true` moves the user off the URL containing the error fragment.
- No `confirmationLinkError` state in `AuthContext`. The error rides on the route's context, set by `signUpRoute.beforeLoad`.

**Decisions worth recording for future-me:**

- **Match on `error_code`, not the description string.** Verified directly from gotrue source (`internal/api/verify.go`): every email-confirmation failure (expired, already-used, invalid) returns `ErrorCodeOTPExpired = "otp_expired"`. The description text varies; the code is stable. Supabase's own docs say _"Always use `error.code` and `error.name` to identify errors, not string matching on error messages."_
- **Only `otp_expired` is worth a specific case today.** Cross-referenced every documented code in `authErrorCodes.toml` against (a) what can reach the `/verify` redirect path and (b) which apply to our config (email/password only, no OAuth/MFA/SAML/phone). Everything else is either out-of-scope, surfaces through a different API call, or generic enough that the fallback message suffices. Extend the matcher if Sentry shows specific codes accumulating.
- **`replace: true` on the redirect handles URL cleanup.** Replaces the failed-URL history entry instead of pushing a new one. Back button can't revisit the error; refreshes happen at `/sign-up` (no hash).
- **Route context, not React state.** The error is data tied to "this navigation," not to "this user session." TanStack Router's `beforeLoad` return becomes route match context. `useRouteContext({ from: '/sign-up' })` reads it from the form. No cleanup effect, no AuthContext state, no URL search-param pollution.
- **Known trade-off: in-session "stale reappear."** Because the SDK's `initialize()` result is cached for the page's lifetime, a user who navigates `/sign-up` → `/sign-in` → `/sign-up` in the same session would see the error message again. Acceptable: the realistic flow is "land → sign up again," not "land → wander → return." A hard refresh on `/sign-up` clears it (fresh SDK instance, no hash). If this becomes a real complaint, the fix is to track "consumed" state somewhere — but adding that complexity now would be premature.

**Tests:**

- `web/src/lib/auth-redirect.test.ts` — `readConfirmationLinkError` returns `'expired'` for `code: 'otp_expired'`; returns `'generic'` for other redirect errors; returns `null` for `{ error: null }` and for non-redirect errors.
- `web/src/components/auth/SignUpForm/SignUpForm.test.tsx` — three new tests: `confirmationError: 'expired'` renders the expired-link message; `'generic'` renders the generic message; `null` renders no alert. Existing tests get a `useRouteContext` mock returning `{ confirmationError: null }` by default.
- Mock updates in every test file that constructs an `AuthContextType` literal: `tests/test-utils/renderContexts.ts`, `InnerApp.test.tsx`, `contexts/TeamContext.test.tsx`, `lib/route-guards.test.ts`, `components/auth/SignInForm/SignInForm.test.tsx`, `components/auth/SignUpForm/SignUpForm.test.tsx` — the new context fields we added in a prior iteration are removed since AuthContext is back to its pre-commit-6 shape.

**Verification:**

1. `npm run web:test` + lint/format/build green.
2. Manual: reproduce a failure by clicking an expired link, or by manually constructing a URL like `http://localhost:5173/#error=access_denied&error_code=otp_expired&error_description=Email%20link%20is%20invalid%20or%20has%20expired` → load the app → user gets routed to `/sign-up` → `<InlineError>` renders above the form with the expired-link message → navigating to `/sign-in` and back to `/sign-up` does NOT clear it in the same page session (known trade-off; refresh on `/sign-up` clears).

---

### Commit 7 — Add resend confirmation email

**Goal:** "Resend" button on `<CheckEmailNotice>` re-sends the confirmation email and surfaces friendly UX for rate-limiting and unexpected failures.

**Files added:**

- `web/src/lib/auth-resend.ts` — `resendConfirmation(email, options?)` free function wrapping `supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo } })`. Throws on error. Lives outside `AuthContext` — see "Decisions worth recording" below.
- `web/src/lib/auth-resend.test.ts` — unit tests: default args (`emailRedirectTo: undefined`), forwards custom `emailRedirectTo`, throws on Supabase error.
- `web/src/tests/integration/signup-resend.integration.test.tsx` — mounts a real `/sign-up` route, submits the form to reach `<CheckEmailNotice>`, clicks Resend, asserts `supabase.auth.resend` was called with the expected payload. A second test mocks `supabase.auth.resend` to return `AuthApiError(..., 429, 'over_email_send_rate_limit')` and asserts the friendly rate-limit message renders. Mocks at the third-party seam (`@/lib/supabase`) so the real `resendConfirmation` runs.

**Files modified:**

- `web/src/components/auth/CheckEmailNotice/CheckEmailNotice.tsx`
  - Reintroduces `<CardFooter>` with a Resend `<LoadingButton>` gated on the `onResend` prop, plus `<LiveRegion>` for the success announcement ("New confirmation email sent.") and `<InlineError>` for failures.
  - Discriminates failures via `isAuthApiError(err) && err.code === 'over_email_send_rate_limit'` — Supabase's recommended pattern per [their error-codes guide](https://supabase.com/docs/guides/auth/debugging/error-codes) ("Always use `error.code` and `error.name` to identify errors"; "Use `isAuthApiError` instead of `instanceof` checks").
  - Rate-limit failure: "You've sent too many confirmation requests. Please try again later." (no Sentry).
  - Generic failure: "Couldn't send the email. Please try again." + `Sentry.captureException(err, { tags: { component: 'CheckEmailNotice', operation: 'resendConfirmation' } })`. Rate-limit is expected user behavior — capturing it would be noise; generic is the "unknown failure" bucket worth investigating.
  - Layout restructure: drop `w-full` from `<OtpInput>` so it sizes to its slot row, and group `OtpInput` + error + `Verify` in a shared `mx-auto flex w-fit flex-col` column. `Verify` is now `w-full` and naturally matches the OTP slot row's width at any breakpoint — no magic numbers tying button width to slot dimensions. Trade-off: clicking the dead space between the slots and the card edges no longer focuses the input (the slots themselves and the label `htmlFor` still do).
- `web/src/components/auth/SignUpForm/SignUpForm.tsx` — imports `resendConfirmation` from `@/lib/auth-resend` and passes `onResend={() => resendConfirmation(email, { emailRedirectTo })}` to `<CheckEmailNotice>`, reusing the same `emailRedirectTo` value computed for `signUp`.
- `web/src/components/auth/CheckEmailNotice/CheckEmailNotice.test.tsx` — new `Resend` describe block covers: hidden button when no handler, click fires `onResend`, loading label visible while in flight, success announced via `LiveRegion`, generic failure renders message and calls `Sentry.captureException` with the right tags, rate-limit renders the friendly message and does NOT call Sentry.

**Decisions worth recording:**

- **Free function in `lib/auth-resend.ts`, not an `AuthContext` method.** `signUp` / `signIn` / `signOut` on AuthContext are the gates for lifecycle transitions; even though they don't directly mutate React state (the `onAuthStateChange` listener does), they bracket those transitions. `resendConfirmation` is a pure side-effecting call — it sends an email and has no auth-state implication. Closer fit to the existing `lib/auth-redirect.ts` precedent (`readConfirmationLinkError`) than to AuthContext. Keeps AuthContext focused.
- **Sentry capture only on the unrecognized-failure branch.** Rate-limit hits are expected user behavior (clicking too fast, hitting Supabase's per-identity throttle); logging them would be noise. Generic failures are the "Supabase outage / network down / unknown new code" bucket where a Sentry alert is actually informative. Per `web/CLAUDE.md`: capture unexpected errors, not validation errors or user cancellations.
- **Mock at the third-party seam in the integration test.** Mocking `@/lib/supabase` and letting the real `resendConfirmation` run preserves the layer's promise — exercise real wiring, only stub what we don't own.
- **No redundant Resend wiring test in `SignUpForm.test.tsx`.** The integration test asserts the same args after the same user flow with strictly higher fidelity (real router, real `useSearch`). Per the overlap rule in `web/CLAUDE.md`, keep the faster integration test, drop the lower-fidelity duplicate.

**Verification:**

1. `npm run web:test` + lint/format/build green.
2. Manual: sign up → click Resend → second email arrives in Mailpit. Either email's link OR the latest OTP from either email completes verification. Rapid-fire Resend (more than the configured rate limit) → friendly rate-limit message renders.

---

### Commit 8 — E2E coverage for magic-link, OTP, and cross-browser signup paths

**Goal:** cross-system assertion that the wired-up flow works end-to-end through a real browser, against the local Supabase + Mailpit stack. Also promotes cross-browser invite preservation from manual verification (originally listed under "End-to-end verification" step 3) to automated coverage, and repairs two pre-existing UI-signup tests that commits 4-7 silently broke by routing UI signup into the email-confirmation gate.

**Files added:**

- `e2e/fixtures/mailpit.ts` — thin HTTP wrappers. `searchByRecipient(email)` → `GET /api/v1/search?query=to:<encoded>`. `getMessage(id)` → `GET /api/v1/message/{id}`. `clearAll()` → `DELETE /api/v1/messages`. Targets `http://127.0.0.1:54424` (e2e Mailpit, dev `54324` + 100 per the port-shift convention). No internal polling — callsites wrap `searchByRecipient` in Playwright's `expect.poll(async () => (await searchByRecipient(email)).count).toBe(1)` so waits are visible at the callsite and integrate with Playwright's timeout reporting.

**Files modified:**

- `e2e/tests/auth.spec.ts` — add three tests. `beforeEach` also clears Mailpit.
  - **Magic-link path:** fill signup form via UI → assert `<CheckEmailNotice>` heading and the typed email are visible → poll Mailpit until `count === 1` → fetch the message → regex `message.HTML` for `href="([^"]*\/auth\/v1\/verify[^"]*)"` (the only `{{ .ConfirmationURL }}` substitution in the template) → un-escape `&amp;` → `page.goto(confirmationUrl)` → assert the app shows `/create-team`. URL extraction goes against `HTML` rather than `Text` because the `href` attribute is more stable across template restructuring than the auto-generated text layout.
  - **OTP path:** fill signup form → assert `<CheckEmailNotice>` → poll Mailpit → fetch the message → regex `message.Text` for `\b(\d{6})\b` (the only 6-digit sequence in the email) → fill the `Confirmation code` input via `getByLabel`. The `<OtpInput>`'s `onComplete` fires `verifyOtp` automatically once 6 digits land, so no explicit Verify click. Assert the app shows `/create-team`.
  - **Cross-browser preservation:** seed owner + league + private invite → in `contextA`, sign up at `/sign-up?redirect=/join/<token>` → stop at `<CheckEmailNotice>`, close `contextA` → poll Mailpit, extract magic-link URL → in a fresh `contextB` with zero prior storage, `page.goto(magicLinkUrl)` → assert URL matches `/join/<token>#?$` (Supabase's SDK leaves a bare `#` after stripping the access_token fragment via `history.replaceState`) and the league name renders. Owns three failure modes nothing lower in the suite can see: dynamic `emailRedirectTo` clearing the `additional_redirect_urls` allowlist, implicit-flow auto-detect working against a client with zero prior state (the specific failure mode that killed PKCE), and `requireAuth` + the `JoinInvite` loader surviving the session-just-materialized timing window at a non-root destination.
- `e2e/tests/team.spec.ts` — `'new user signs up, creates a team, and lands on /my-team'` → `'new user creates a team and lands on /my-team'`: replace the UI signup steps with `createTestUser` + `signInAs`. The signup behavior the test used to incidentally exercise is now owned by the dedicated auth tests above.
- `e2e/tests/league.spec.ts` — `'unauthenticated visitor to /join/$token signs up, creates a team, and joins'` → `'authenticated visitor without a team visits /join/$token, creates a team, and joins'`: same migration. Retains the `?redirect=` preservation assertion through the `/create-team` round-trip; signup-side redirect preservation is now covered by the cross-browser auth test.

**Decisions worth recording:**

- **Email rate limit didn't need bumping.** `e2e/supabase/config.toml:149` keeps `email_sent = 2` per hour. Empirically the limit applies per-identity in gotrue rather than per-IP globally, so each test's unique email gets its own quota. Three confirmation-email sends per run all delivered cleanly. Plan's production note about raising the limit still stands for unrelated reasons (real signup volume).
- **OTP `Text`-body regex over a specific anchor string.** Earlier draft proposed matching `/Or enter this code in the app: \*(\d{6})\*/`, but that text isn't in the actual template. The shipped regex `\b(\d{6})\b` finds the only 6-digit sequence in the auto-generated text body — resilient to template wording changes while still deterministic for this template.
- **Trailing `#` in the cross-browser destination URL is a Supabase SDK behavior, not a bug.** `_initialize` calls `history.replaceState(null, '', cleanedUrl)` to scrub `access_token=...` after parsing, and the cleanup leaves a bare `#` behind. The URL match uses an optional `#?$` rather than working around the SDK.

**Verification:**

1. `npm run e2e` green (14 tests total: existing suite + three new auth tests, with two pre-existing tests migrated off UI signup).

---

### Commit 9 — E2E coverage for resend confirmation email path

**Goal:** promote the resend smoke from manual to automated. The unit/component tests cover the rate-limit UX path against a mocked Supabase; the integration test covers SignUpForm → CheckEmailNotice → resend wiring with a mocked seam. Neither proves `supabase.auth.resend({ type: 'signup', ... })` actually produces a second email against the real Supabase + Mailpit stack — that's the failure mode this commit owns.

**Files modified:**

- `e2e/tests/auth.spec.ts` — new test `resends the confirmation email and confirms via the resent link`. Signs up via the UI, polls Mailpit until the first email arrives, clicks "Resend the code", polls until count reaches 2, then completes signup via the resent email's `/auth/v1/verify` link. Mailpit returns messages newest-first so `messages[0]` is the resent one.
- `e2e/supabase/config.toml` — `email_sent = 30` (was 2). The dev value is intentionally tight; the e2e suite now performs signup + resend in a single run and needs headroom. `[auth.email] max_frequency = "1ms"` (was `"1s"`). gotrue treats `"0s"` as unset and falls back to a hardcoded ~60s floor on the `/resend` endpoint; any positive value bypasses that floor. `"1ms"` makes the per-recipient cool-down effectively zero without tripping the fallback.
- `e2e/tests/_infra/config-sync.spec.ts` — extend `IGNORED_KEY_RE` to ignore `email_sent` and `max_frequency`. Both must legitimately differ between dev and e2e.

**Decisions worth recording:**

- **gotrue's hidden `max_frequency` floor.** Setting `max_frequency = "0s"` does *not* disable the per-recipient resend throttle — gotrue rejects with "you can only request this after 59 seconds." Verified empirically against `gotrue:v2.188.1`. A positive value (any > 0) takes effect as configured; `0` falls through to a 60s default. The plan keeps `"1ms"` rather than something larger so test runtime isn't gated on a real-world throttle.
- **Rate-limit UX path is not tested here.** With `email_sent = 30` and `max_frequency = "1ms"`, the rate-limit branch in `CheckEmailNotice` (renders "You've sent too many confirmation requests.") is unreachable in this run. That branch is covered by `CheckEmailNotice.test.tsx`'s mocked `over_email_send_rate_limit` test — no E2E duplication needed.
- **Per-test config drift now covered by `IGNORED_KEY_RE`.** The pattern matches by line, so `max_frequency` is excluded across `[auth.email]`, `[auth.sms]`, and `[auth.mfa.phone]`. The suite doesn't exercise sms/mfa, so silent drift on those is an acceptable trade for the simpler regex.

**Verification:**

1. `cd e2e/supabase && supabase stop && supabase start` to pick up the config change.
2. `npm run e2e` green (15 tests total: previous 14 + the new resend test).

---

## Critical files

**Modified across commits 4-9:**

- `api/supabase/config.toml` (commit 4)
- `e2e/supabase/config.toml` (commits 4, 9 — commit 9 bumps `email_sent` and drops `max_frequency` for the resend test)
- `e2e/tests/_infra/config-sync.spec.ts` (commits 4, 9 — commit 9 adds `email_sent` and `max_frequency` to `IGNORED_KEY_RE`)
- `web/src/lib/supabase.ts` (commit 4)
- `web/src/router.tsx` (commits 4, 5, 6)
- `web/src/contexts/AuthContext.tsx` + `.ts` (commit 4)
- `web/src/components/auth/SignUpForm/SignUpForm.tsx` (commits 4, 5, 6, 7)
- `web/src/components/auth/CheckEmailNotice/CheckEmailNotice.tsx` (commit 7)
- `e2e/tests/auth.spec.ts` (commits 8, 9 — commit 8 adds magic-link, OTP, and cross-browser tests + `beforeEach` Mailpit clear; commit 9 adds the resend test)
- `e2e/tests/team.spec.ts` (commit 8 — migrates UI-signup test to `createTestUser` + `signInAs`)
- `e2e/tests/league.spec.ts` (commit 8 — same migration on the `/join/<token>` test)
- `web/src/lib/route-guards.ts` — _kept_, no modifications across the rework

**New across commits 4-9:**

- `web/src/lib/auth-redirect.ts` + `.test.ts` (commit 6)
- `web/src/lib/auth-resend.ts` + `.test.ts` (commit 7)
- `web/src/tests/integration/root-routing.integration.test.tsx` (commit 5)
- `web/src/tests/integration/signup-resend.integration.test.tsx` (commit 7)
- `e2e/fixtures/mailpit.ts` (commit 8)

**Deleted in commit 4:**

- `web/src/lib/auth-destination.ts` + `.test.ts`
- `web/src/tests/integration/auth-callback.integration.test.tsx`

**Reused (existing components, no changes):**

- `web/src/components/InlineError/InlineError.tsx`
- `web/src/components/LiveRegion/LiveRegion.tsx`
- `web/src/components/LoadingButton/LoadingButton.tsx`
- `web/src/components/OtpInput/OtpInput.tsx`
- `web/src/hooks/useAuth.ts`
- `web/src/hooks/useLiveRegion.ts`

---

## End-to-end verification (after all commits 4-9)

1. **Magic-link happy path:** Sign up with new email → `<CheckEmailNotice>` → check Mailpit → click link → land on `/create-team` logged in. _(Automated in commit 8.)_
2. **OTP happy path:** Sign up with new email → `<CheckEmailNotice>` → check Mailpit → type 6-digit code → land on `/create-team` logged in. _(Automated in commit 8.)_
3. **Cross-browser invite preservation:** Sign up from `/sign-up?redirect=/join/<token>` on Browser A → click link in Browser B → land directly at `/join/<token>` signed in. _(Automated in commit 8 via two Playwright `browser.newContext()` instances.)_
4. **Resend:** Sign up → click Resend → second email arrives → either email's link OR the latest OTP completes verification. _(Automated in commit 9.)_
5. **Link failure:** Click an expired/consumed link → user is routed to `/sign-up` with `<InlineError>` above the form with a friendly message; navigating away clears the message.
6. **Authed user at `/`:** Visit `/` signed in → bounce to `/leagues` (with team) or `/create-team` (without). Sign out → return to `/` → `LandingPage` renders normally.
7. **Existing e2e tests:** `npm run e2e` all green (admin fixture continues working via `email_confirm: true`).
8. **All tests + format + lint:** `npm run test:all` + `npm run web:lint` + `npm run web:format:check` + `npm run api:format:check` all green.

---

## Production deployment notes (post-merge, manual)

- Enable Confirm Email in Supabase dashboard: Authentication → Providers → Email.
- Add redirect URL allowlist entries (tightened from dev wildcards): `https://<prod-domain>/`, `https://<prod-domain>/join/**`, and any other surfaces that need preserved destinations. Wildcards are supported but should be narrowed for security in production.
- Configure SMTP for outbound email (currently commented out in `api/supabase/config.toml:186-194`; production must use a real provider).
- Upload the custom confirmation template (dashboard reads templates from the dashboard in production, not from the local config file).
- Raise email rate limit: `[auth.rate_limit] email_sent = 2` per hour at `api/supabase/config.toml:149` is sane for local dev but far too low for production. Set in the Supabase dashboard to a value appropriate for expected signup volume.

---

## Known preexisting concerns (out of scope)

- `on_auth_user_created` trigger in `api/supabase/migrations/20260108000000_create_user_profile_trigger.sql` fires on every `INSERT` into `auth.users` regardless of confirmation. With confirmations enabled, `Accounts` and `UserProfiles` rows are created at signup time even if the user never confirms. Result: orphan rows accumulate from abandoned signups. Cleanup (periodic job or moving the trigger to fire only after confirmation) is out of #164's scope but worth tracking as follow-up.
- Non-HTTP errors thrown from route loaders and `beforeLoad` guards are silently rendered via `errorComponent` and never reach Sentry — `apiClient` only captures HTTP failures, and the React error-boundary path doesn't see errors caught at the route layer. The codebase-wide gap is tracked separately in #180; #164 doesn't try to solve it.
- AuthContext's React state is a lagging mirror of Supabase's session state; the codebase has two coexisting workarounds (`requireAuth`'s `getSession()` fallback and the `isAuthTransitioning` overlay). Cleaning this up — likely by treating AuthContext as a tree-render-only mirror and having route guards consult Supabase directly — is preexisting and out of #164's scope.
- Sign-in unconfirmed handling (when a returning unconfirmed user attempts to sign in) is not part of the rework. The original commit 5 design (reuse `<CheckEmailNotice>` for the `email_not_confirmed` error) remains valid future work; the rework's design composes with it cleanly.
