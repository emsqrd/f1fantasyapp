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

| Decision | Choice | Rationale |
| --- | --- | --- |
| Auth flow | Implicit (Supabase `createClient` defaults: `flowType: 'implicit'`, `detectSessionInUrl: true`) | Documented SPA pattern. Verified at `GoTrueClient.ts:184-194`. The PKCE flow's `signUp` writes `code_challenge` (`GoTrueClient.ts:899-924`) but `resend` does not (`2535-2574`), which broke the resend path; implicit sidesteps the asymmetry. |
| Magic-link verification | SDK auto-detects `#access_token=...` from URL fragment during `_initialize` | No callback loader needed; `_initialize` saves the session and fires `SIGNED_IN`. On success the SDK strips the hash (`GoTrueClient.ts:3702-3703`); on failure it leaves `#error_description=...` for the app to read. |
| Typed-OTP verification | `supabase.auth.verifyOtp({ email, token, type: 'email' })` | No alternative for typed codes. `'email'` is the type for email-confirmation OTPs from the custom template's `{{ .Token }}`. |
| Confirmation method in email | Both magic link and OTP code | Resilient to corporate email scanners that pre-fetch links (Supabase auth issue [#1214](https://github.com/supabase/auth/issues/1214)). The custom template includes `{{ .ConfirmationURL }}` and `{{ .Token }}`. |
| Email link construction | `{{ .ConfirmationURL }}` only | Supabase owns the URL. No template-side concatenation, no `&token_hash=` append, no requirement that `buildEmailRedirectTo` always include a query string. |
| Callback route | None | The implicit flow's auto-detect runs against whatever URL the user lands on. No app-side loader required. |
| Post-confirm destination | Caller of `signUp`/`resendConfirmation` passes `emailRedirectTo` directly (full URL). Default: `${origin}/`. Dynamic: `${origin}${search.redirect}` when SignUpForm was reached via a redirect param (e.g., `/sign-up?redirect=/join/<token>`). | One source of truth for "where does this user land": the `emailRedirectTo` URL itself. No parallel `?redirect=` URL parameter, no `getPostSignupDestination` helper. Route guards continue to own routing for users landing at any given URL. |
| Cross-browser invite preservation | Encoded in `emailRedirectTo` | Supabase forwards `emailRedirectTo` verbatim through `/verify`. A user who signs up from `/join/<token>` on desktop and confirms via the email on mobile lands directly at `/join/<token>` on mobile, signed in. |
| `/` route handling | Add `beforeLoad` that bounces authenticated users to `/create-team` or `/leagues` based on team state | Mirrors the existing pattern on `/sign-in` (`router.tsx:218-228`) and `/sign-up` (`router.tsx:240-250`). Eliminates the "marketing content rendered inside authenticated app shell" weirdness when a signed-in user lands at `/`. Single home for post-auth routing: route guards. |
| Auth-URL error UX | `useEffect` in `AuthContext` reads `window.location.hash` on mount, parses `error` + `error_description`, sets `authUrlError` state via `mapAuthUrlError(code, description)`, strips the hash. `<Layout>` renders `<InlineError>` above `<Outlet>` when set. `clearAuthUrlError` on dismiss. | `getSession()` swallows `_initialize` errors (verified at `GoTrueClient.ts:2661-2671`); reading the URL fragment is the only way to surface them. `<InlineError>` matches `web/CLAUDE.md`'s convention for primary-flow errors (toasts are reserved for background operations). |
| Supabase redirect allowlist | Wildcards: `http://localhost:5173/**` (dev), `http://localhost:5273/**` (e2e). Production: tightened to specific patterns per surface (`https://<prod>/`, `https://<prod>/join/**`, etc.). | Required to allow dynamic `emailRedirectTo` paths. Wildcard support confirmed in Supabase docs; `**` matches any sequence including separators. |
| `requireAuth` `getSession()` fallback | Kept | Still load-bearing: AuthContext's React state lags Supabase's session state by one render after any auth state change. Without the fallback, freshly-confirmed users bounce back to `/` because `context.auth.user` is briefly null in `beforeLoad`. |
| Email passing into `<CheckEmailNotice>` | React state from parent (`SignUpForm`, later `SignInForm`) | Same as the original commit 2 design. Supabase identifies the user by token; email is only for display + the typed-OTP `verifyOtp` call. No URL params (OWASP: PII shouldn't appear in URLs). |
| Failure copy for typed-OTP | Static generic message: _"That code didn't match. Check your email for the latest one."_ | Same as the original commit 2 design. |
| Sign-in unconfirmed handling | Deferred | Commits 4-8 do not include the SignInForm wiring for `email_not_confirmed`. The original commit 5 plan is preserved as future work but is not part of this rework. The rework focuses on getting the signup path onto the correct foundation; the signin-unconfirmed UX reuses the same `<CheckEmailNotice>` and can be added afterward without affecting the rework's design. |

---

## Commits

### Commit 1 — PKCE flow + `/auth/callback` loader (`23ca5ec`)

Original design: switched the Supabase client to `flowType: 'pkce'` with `detectSessionInUrl: false`, added a `/auth/callback` route with a loader that called `exchangeCodeForSession`, and added `getPostSignupDestination` in `web/src/lib/auth-destination.ts`. Commit 4 reverts the client to defaults, deletes the route, and deletes the helper.

### Commit 2 — `<OtpInput>` primitive + `<CheckEmailNotice>` component (`d4a632b`)

The typed-OTP path UI. Unchanged by the rework. `verifyOtp` is called with `type: 'email'` (corrected from the original `'signup'` during the pivot; commit 4 keeps this corrected value).

### Commit 3 — Enable confirmations + SignUpForm wiring (`de592bc`)

- **Kept by commit 4:** `enable_confirmations = true` config flip in both `api/supabase/config.toml` and `e2e/supabase/config.toml`. The custom email template file (its content gets rewritten). `requireAuth`'s `getSession()` fallback.
- **Superseded by commit 4:** the `redirect: string` option threaded through `signUp`. The token_hash-style email template URL. The SignUpForm wiring that called `getPostSignupDestination`.

---

### Commit 4 — Replace PKCE callback with implicit-flow defaults (`93fa04a`)

**Goal:** undo the PKCE/callback infrastructure and the redirect plumbing. After this commit, the email-confirmation flow works end-to-end via either path. Users land at `${origin}/` post-confirm; the `/` route has no `beforeLoad` for authed users yet (commit 5 adds it), so a signed-in user briefly sees `LandingPage` rendered inside the authenticated app shell — functional but visually unpolished. Build/lint/test all pass.

**Files modified:**

- `api/supabase/templates/confirmation.html` — **no change in this commit**. The user customized this template (structure, copy, styling) and committed those customizations in `de592bc`. The only uncommitted edit was the token_hash URL surgery on the link `href`, which the prerequisite `git restore .` step reverts automatically. After `git restore .` the template is already in the correct state for the new design (link `href = {{ .ConfirmationURL }}`). Do not regenerate or replace the file.
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

- `web/src/components/auth/SignUpForm/SignUpForm.test.tsx` — assert `signUp` called with `emailRedirectTo: ${origin}/` when no `search.redirect`; assert `emailRedirectTo: ${origin}/leagues/123` when `search.redirect = '/leagues/123'`. Assert typed-OTP `onVerified` navigates to the same destination.
- `web/src/tests/integration/index-route.integration.test.tsx` — new file. Mount a per-test route tree with `indexRoute`, the authed/no-team and authed/with-team layout routes, and `LandingPage`. Assert: unauthed user sees `LandingPage` at `/`; authed-no-team user redirects to `/create-team`; authed-with-team user redirects to `/leagues`. Mirrors the pattern in `account.integration.test.tsx`.

**Verification:**

1. `npm run web:test` + lint/format/build green.
2. Manual: visit `/` signed out → `LandingPage`. Sign in via existing user → bounces to `/leagues` or `/create-team` based on team state. Click logo (sidebar) while authed → bounces. Sign up from `/sign-up?redirect=/join/<token>`, confirm via the email link in a different browser → land directly at `/join/<token>` signed in (`JoinInvite` renders for an authed user).

---

### Commit 6 — Surface auth-URL errors via `<InlineError>` in Layout

**Goal:** when Supabase's `/verify` redirects back with `#error_description=...` (expired token, consumed link, etc.), surface a friendly message instead of silently leaving the user on the destination as if not signed in.

**Files modified:**

- `web/src/contexts/AuthContext.tsx` — in the existing mount-time `useEffect` (or a sibling), read `window.location.hash` for `error` and `error_description`. If either is set, call `setAuthUrlError(mapAuthUrlError(code, description))` and strip the fragment via `window.history.replaceState(null, '', window.location.pathname + window.location.search)`.
- `web/src/contexts/AuthContext.ts` — add `authUrlError: string | null` and `clearAuthUrlError: () => void` to `AuthContextType`. Expose both from the provider.
- `web/src/components/Layout/Layout.tsx` — read `authUrlError` and `clearAuthUrlError` from `useAuth()`. Render `<InlineError>` above the `<Outlet>` (in both the authenticated and unauthenticated branches) when `authUrlError` is non-null. Provide a dismiss affordance that calls `clearAuthUrlError`.

**Files added:**

- `web/src/lib/auth-url-errors.ts` — `mapAuthUrlError(code: string | null, description: string | null): string`. Small lookup: known codes (e.g., `access_denied` with expired-description → "This confirmation link has expired or has already been used. Try signing in to get a new one.") map to friendly copy; generic fallback ("We couldn't confirm your email. Please try signing in again.") for unknowns.
- `web/src/lib/auth-url-errors.test.ts` — one test per mapped case plus the fallback.

**Tests:**

- `web/src/contexts/AuthContext.test.tsx` — test: `window.location.hash` containing `#error_description=...` on mount sets `authUrlError` and strips the hash. Test: `clearAuthUrlError` resets state to `null`. Test: no hash → no state set.

**Verification:**

1. `npm run web:test` + lint/format/build green.
2. Manual: reproduce a failure by clicking a link with an invalid/expired token, or by manually constructing a URL like `http://localhost:5173/#error_description=Email%20link%20is%20invalid` → load the app → see `<InlineError>` above the page content with friendly copy; dismiss → error clears; URL bar no longer contains the fragment.

---

### Commit 7 — Add resend confirmation email

**Goal:** "Resend" button on `<CheckEmailNotice>` re-sends the confirmation email. Same shape as the original commit 4 plan, simpler because no redirect plumbing.

**Files modified:**

- `web/src/contexts/AuthContext.tsx` + `.ts` — add `resendConfirmation(email: string, options?: { emailRedirectTo?: string }): Promise<void>` to interface and implementation. Calls `supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: options?.emailRedirectTo } })`. Throws on error.
- `web/src/components/auth/CheckEmailNotice/CheckEmailNotice.tsx` — reintroduce `<CardFooter>` with a Resend button gated on the existing `onResend` prop. Use `<LoadingButton>` for loading state. Use `<LiveRegion>` to announce success ("New confirmation email sent."). Use `<InlineError>` for failures, with friendly copy for `over_email_send_rate_limit` ("Please wait a moment before requesting another email.") and a generic message for other errors. Local `resendStatus: 'idle' | 'sending'` mirrors the original commit 4 design.
- `web/src/components/auth/SignUpForm/SignUpForm.tsx` — pass `onResend={() => resendConfirmation(email, { emailRedirectTo })}` to `<CheckEmailNotice>`, reusing the same `emailRedirectTo` value computed for the initial `signUp` call.

**Tests:**

- `web/src/contexts/AuthContext.test.tsx` — `resendConfirmation` calls `supabase.auth.resend` with `{ type: 'signup', email, options: { emailRedirectTo } }`. With no `emailRedirectTo`, the options object's `emailRedirectTo` is `undefined`. Throws on Supabase error.
- `web/src/components/auth/CheckEmailNotice/CheckEmailNotice.test.tsx` — clicking Resend fires `onResend`. Loading state visible during the await. Success announced via `LiveRegion`. Generic error renders via `<InlineError>`. Rate-limit error renders the friendly copy.
- `web/src/components/auth/SignUpForm/SignUpForm.test.tsx` — Resend passes the current `emailRedirectTo` (with `search.redirect` threading) to `resendConfirmation`.
- `web/src/tests/integration/signup-resend.integration.test.tsx` — new file. Mount sign-up flow at `/sign-up?redirect=/leagues/123`, submit, click Resend, assert `supabase.auth.resend` was called with the expected args. Same setup but with `supabase.auth.resend` mocked to return `{ error: { code: 'over_email_send_rate_limit' } }` → assert friendly rate-limit copy renders.

**Verification:**

1. `npm run web:test` + lint/format/build green.
2. Manual: sign up → click Resend → second email arrives in Mailpit. Either email's link OR the latest OTP from either email completes verification. Rapid-fire Resend (more than the configured rate limit) → friendly rate-limit message renders.

---

### Commit 8 — E2E coverage for magic-link and OTP signup paths

**Goal:** cross-system assertion that the wired-up flow works end-to-end through a real browser, against the local Supabase + Mailpit stack.

**Files added:**

- `e2e/fixtures/mailpit.ts` — thin HTTP wrappers. `searchByRecipient(email)` → `GET /api/v1/search?query=to:<encoded>`. `getMessage(id)` → `GET /api/v1/message/{id}`. `clearAll()` → `DELETE /api/v1/messages`. Targets `http://127.0.0.1:54424` (e2e Mailpit, dev `54324` + 100 per the port-shift convention). No internal polling — callsites wrap `searchByRecipient` in Playwright's `expect.poll(...).toHaveProperty('count', 1)` so waits are visible at the callsite and integrate with Playwright's timeout reporting.

**Files modified:**

- `e2e/tests/auth.spec.ts` — add two tests. `beforeEach` clears Mailpit.
  - **Magic-link path:** fill signup form via UI → assert `<CheckEmailNotice>` appears → `expect.poll(() => mailpit.searchByRecipient(email)).toHaveProperty('count', 1)` → GET the message → regex `Text` for the verify URL → `page.goto(verifyUrl)` → assert the app shows `/create-team`.
  - **OTP path:** fill signup form → assert `<CheckEmailNotice>` → poll Mailpit → GET → regex `Text` for `/Or enter this code in the app: \*(\d{6})\*/` → type the 6 digits into the underlying OTP input (queryable via its `aria-label`; the slot `<div>`s are `aria-hidden`) → assert the app shows `/create-team`.

**Verification:**

1. `npm run e2e` green (existing suite + the two new tests).

---

## Critical files

**Modified across commits 4-8:**

- `api/supabase/config.toml` (commit 4)
- `e2e/supabase/config.toml` (commit 4)
- `e2e/tests/_infra/config-sync.spec.ts` (commit 4)
- `web/src/lib/supabase.ts` (commit 4)
- `web/src/router.tsx` (commits 4, 5)
- `web/src/contexts/AuthContext.tsx` + `.ts` (commits 4, 6, 7)
- `web/src/components/auth/SignUpForm/SignUpForm.tsx` (commits 4, 5, 7)
- `web/src/components/auth/CheckEmailNotice/CheckEmailNotice.tsx` (commit 7)
- `web/src/components/Layout/Layout.tsx` (commit 6)
- `web/src/lib/route-guards.ts` — *kept*, no modifications across the rework

**New across commits 4-8:**

- `web/src/lib/auth-url-errors.ts` + `.test.ts` (commit 6)
- `web/src/tests/integration/index-route.integration.test.tsx` (commit 5)
- `web/src/tests/integration/signup-resend.integration.test.tsx` (commit 7)
- `e2e/fixtures/mailpit.ts` (commit 8)
- New tests in `e2e/tests/auth.spec.ts` (commit 8)

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

## End-to-end verification (after all commits 4-8)

1. **Magic-link happy path:** Sign up with new email → `<CheckEmailNotice>` → check Mailpit → click link → land on `/create-team` logged in.
2. **OTP happy path:** Sign up with new email → `<CheckEmailNotice>` → check Mailpit → type 6-digit code → land on `/create-team` logged in.
3. **Cross-browser invite preservation:** Sign up from `/sign-up?redirect=/join/<token>` on Browser A → click link in Browser B → land directly at `/join/<token>` signed in.
4. **Resend:** Sign up → click Resend → second email arrives → either email's link OR the latest OTP completes verification.
5. **Link failure:** Click an expired/consumed link → land at `/` (or destination) with `<InlineError>` above the content carrying friendly copy; dismiss → clears.
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
