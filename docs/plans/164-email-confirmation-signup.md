# Plan — Issue #164: Require email confirmation on signup

## Context

Email confirmations are currently disabled in Supabase (`enable_confirmations = false` in `api/supabase/config.toml:176`). Anyone can sign up with any email and immediately be logged in — there's no proof of address ownership. The issue asks us to:

1. Enable email confirmations
2. Show a "pending confirmation" state after signup (since `signUp()` will no longer return a session)
3. Allow the confirmation email to be resent
4. Complete verification when the user clicks the email link
5. Handle the case where an unconfirmed user later tries to sign in

**Cross-issue ordering** — this issue should ship before #167 (change-email re-verification, which reuses the same `/auth/callback` route and OTP entry UI) and before #165 (sign-in/redirect audit, which standardizes destinations across all auth flows). 164 preserves today's destination logic; 165 will standardize it later.

**Out of scope:**
- Branded email template content (deferred to #22)
- Standardizing post-auth redirect destinations (deferred to #165)
- Production Supabase dashboard configuration (must be done manually after deploy: enable Confirm Email in Authentication → Providers → Email, add `https://<prod>/auth/callback` to redirect allowlist, upload custom template)

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Confirmation method | **Both magic link AND OTP code** in the email; user can use whichever | Resilient to corporate email scanners (Defender, Barracuda, Mimecast) that pre-fetch links and consume the token before users click. Supabase auth issue [#1214](https://github.com/supabase/auth/issues/1214) is open and unfixed; no clean recovery for affected users without an OTP fallback. Default Supabase template already emits both, so the email-side cost is near zero. |
| OTP input component | shadcn/ui `<InputOTP>` (uses `input-otp` library) | Renders single invisible `<input autocomplete="one-time-code">` behind visual digit boxes — combines accessible single input (WCAG 1.3.5) with visual digit-box UX. Consistent with project's existing shadcn/ui usage. |
| Pending-UI surface | Inline state + shared `<CheckEmailNotice>` component | No URL params (OWASP: PII like email shouldn't appear in URLs — leaks via browser history, server logs, Referer to Sentry). Refresh degrades benignly: link in inbox still works, resend reachable via signin path. |
| Email passing | React state within form components | User never retypes — Supabase's confirmation token uniquely identifies the user. Email passed as prop from parent (`SignUpForm`, `SignInForm`) into `<CheckEmailNotice>`. |
| Sign-in unconfirmed handling | In scope, same issue (commit 6) | Completes the verification story: signup → pending → resend → confirm AND signin → unconfirmed → resend. |
| Post-confirmation destination | Preserve current logic per parent (`SignUpForm` → redirect-or-`/create-team`; `SignInForm` → redirect-or-`/leagues`; magic link callback uses URL `redirect` search param, else `/create-team`) | Standardization deferred to #165. |
| Resend with redirect override | `AuthContext.resendConfirmation(email, { redirect? })` accepts the current redirect param so the resent email's link encodes the *current* destination (e.g., signin's `/leagues/123`) rather than whatever was baked in at signup time | Helps a user who hits the unconfirmed-signin path with a deep link, triggers Resend, and uses the new email's link. The original signup email's link still routes to `/create-team` (can't fix retroactively); the OTP path always routes correctly via the callsite. |
| E2E approach | Existing admin-API fixture keeps `email_confirm: true` (auto-confirms); add two new tests in commit 4 (magic-link path + OTP path) | Existing tests stay fast; targeted e2e covers the new wiring |
| Email template | Custom template at `api/supabase/templates/confirmation.html` includes both `{{ .ConfirmationURL }}` and `{{ .Token }}`, lands in commit 3 alongside the config flip | Default Supabase template already has both; we're shipping our own to control wording and prep for #22's branding |
| Cross-issue ordering | 164 → 167 → 165 (locked) | 164 builds verification primitives; 167 reuses callback route + OTP entry pattern for change-email re-verification; 165 audits all destinations after both new flows exist. |

---

## Commits

Each commit is a gate. Each must independently build, lint, test, and format. Wait for approval before moving on. Note: these commits are sized for review/approval — they don't necessarily map 1:1 to production deploys. Recommendation is to land all six before flipping production confirmations on, so users always have the OTP fallback path. The local-dev confirmation flip happens in commit 3; commits 1–2 are preparatory and safe under `enable_confirmations = false`.

### Commit 1 — PKCE flow + `/auth/callback` route + AuthCallback handler

**Goal:** Stand up the magic-link landing page and switch the Supabase client to PKCE so the link returns `?code=` instead of an implicit hash. Safe to land while `enable_confirmations` is still `false`: the route exists but nothing emits a magic link yet, and PKCE is fully compatible with the existing implicit-flow happy path.

**Supabase client flow change** (`web/src/lib/supabase.ts`):
- Today: `createClient(url, key)` with no options → defaults to `flowType: 'implicit'` (verified in `auth-js` source — `DEFAULT_OPTIONS.flowType: 'implicit'`)
- Required: pass `{ auth: { flowType: 'pkce' } }` so the magic link returns `?code=` (which `exchangeCodeForSession` consumes) instead of `#access_token=` (implicit hash flow)
- This is a small but app-wide auth behavior change — covered by existing AuthContext tests

**New components:**
- `web/src/components/auth/AuthCallback/AuthCallback.tsx` — handles the magic-link return: on mount, reads `code` and optional `redirect` from URL search params, calls `supabase.auth.exchangeCodeForSession(code)`, on success navigates to `redirect` if present else `/create-team`, on error renders `<InlineError>` with link back to `/sign-in`. Reuses the existing `redirectSearchSchema` Zod validator at `web/src/router.tsx:87-93` (validates `redirect` starts with `/` to prevent open redirects).
- `web/src/components/auth/AuthCallback/AuthCallback.test.tsx`

**New helper** (`web/src/lib/auth-destination.ts`):
- `getPostSignupDestination(redirectParam?: string): string` — returns `redirectParam` if present, else `/create-team`. Search-param validation is already enforced upstream by `redirectSearchSchema` (router.tsx:87-93) when the route validates its search params, so this helper just chooses between two valid values. Used by `AuthCallback` here, and later by `SignUpForm` and `<CheckEmailNotice>`'s `onVerified` from the signup callsite (commit 3). Lands here because AuthCallback is its first caller.

**Wiring:**
- `web/src/router.tsx` — add `/auth/callback` as a public child of root (sibling to `/sign-up`, `/sign-in`). Accepts `code` and optional `redirect` search params validated via Zod.

**Tests:**
- `AuthCallback.test.tsx`:
  - On mount with `code` param, calls `exchangeCodeForSession` and navigates to `redirect` or default
  - On exchange error, renders `<InlineError>` with `/sign-in` link
  - With no `code` param, renders error state
- `auth-destination.test.ts`:
  - Returns the redirect param when provided
  - Falls back to `/create-team` when redirect is missing/empty
- Existing `AuthContext.test.tsx` keeps passing under PKCE (no behavioral change to the public API).

**Verification:**
1. `npm run web:test` green
2. `npm run web:lint` + `npm run web:format:check` green
3. Manual: existing signup/signin flow still works (auto-confirm path, no email sent because `enable_confirmations` is still `false`)

---

### Commit 2 — `<CheckEmailNotice>` component + `input-otp` vendoring

**Goal:** Add the pending-state UI as a self-contained, tested component. Not yet wired into any form — that happens in commit 3.

**New dependency:**
- `input-otp` package via shadcn CLI: `npx shadcn@latest add input-otp` — installs to `web/src/components/ui/input-otp.tsx`, matching the project's existing shadcn vendoring per `web/components.json` aliases. Per `web/CLAUDE.md`, shadcn primitives are vendored — do not modify after install. Adds `input-otp` to `web/package.json`.

**New components:**
- `web/src/components/auth/CheckEmailNotice/CheckEmailNotice.tsx` — shared pending UI. Props:
  - `email: string` — displayed in message
  - `onVerified: () => void` — called after `verifyOtp` resolves successfully so parent can navigate
  - `onResend?: () => Promise<void>` — wired in commit 5 (placeholder/no-op for commits 2–4)
  - Renders: instructional copy ("We sent a link to <email>. Click the link in the email, or enter the 6-digit code below."), a shadcn/ui `<InputOTP maxLength={6}>` component (renders 6 visual digit slots with a single accessible input + `autocomplete="one-time-code"` underneath), a `<LoadingButton>` that calls `supabase.auth.verifyOtp({ email, token: code, type: 'signup' })` on submit. On error, render `<InlineError>`. On success, call `onVerified`. (`type: 'signup'` is the verified value from `auth-js` `EmailOtpType` for initial-signup confirmation.)
- `web/src/components/auth/CheckEmailNotice/CheckEmailNotice.test.tsx`

**Tests:**
- `CheckEmailNotice.test.tsx`:
  - Renders email and code input
  - Submitting valid code calls `supabase.auth.verifyOtp` with expected args
  - On verify success, calls `onVerified` prop
  - On verify error, renders `<InlineError>`
  - Code input enforces 6 digits / numeric only (via `inputMode` and `pattern` — server is the source of truth)

**Verification:**
1. `npm run web:test` + `npm run web:lint` + `npm run web:format:check` green
2. Manual: nothing to verify in-app yet (component unwired); spot-check Storybook-style by importing into a scratch page if desired

---

### Commit 3 — Enable confirmations + wire SignUpForm into the pending UI

**Goal:** Flip the feature on. Signup goes end-to-end via either path: submit → "check your email, click link or enter code" UI → user clicks link OR types code → land back in app, logged in. (Resend deferred to commit 5; signin-unconfirmed deferred to commit 6.) This is the load-bearing commit; commits 1–2 are preparatory.

**Supabase config** (`api/supabase/config.toml` and `e2e/supabase/config.toml`):
- `[auth] site_url` → set to local web URL (`http://localhost:5173` for dev, `http://localhost:5273` for e2e). Existing `http://127.0.0.1:3000` is dead config; nothing in the codebase references it.
- `[auth] additional_redirect_urls` → `["http://localhost:5173/auth/callback"]` for dev (and `5273` for e2e). Existing `https://127.0.0.1:3000` is HTTPS on a non-running port — wrong on multiple counts.
- `[auth.email] enable_confirmations = true` (currently `false` at line 176)
- `[auth.email.template.confirmation]` block pointing at `./templates/confirmation.html`. Both configs can reference the same file via relative path; mirrors how `e2e/supabase/migrations/` is symlinked to `api/supabase/migrations/`.

**New email template** (`api/supabase/templates/confirmation.html`):
- Includes both the magic link (`{{ .ConfirmationURL }}`) AND the 6-digit OTP code (`{{ .Token }}`)
- Wording explicitly mentions "Click the link OR enter the 6-digit code in the app"
- Plain HTML; references app name placeholder; #22 will brand it

**Wiring:**
- `web/src/contexts/AuthContext.tsx`:
  - Update `signUp()` to pass `options: { data: { displayName }, emailRedirectTo: ${window.location.origin}/auth/callback?redirect=<encoded redirect> }`. The `redirect` is read from the current location and forwarded so deep-links survive the email gap on the magic-link path.
  - No new context method this commit (resend in commit 5).
- `web/src/components/auth/SignUpForm/SignUpForm.tsx`:
  - After successful `signUp()`, branch on `data.session`:
    - If `session` is non-null (auto-confirm fallback if confirmations are ever disabled): existing navigate-to-destination logic at lines 68-72.
    - If `session` is null: set local `pending` state, render `<CheckEmailNotice email={email} onVerified={handleVerified} />` instead of the form. `handleVerified` runs the same destination logic via `getPostSignupDestination`.

**Tests:**
- `SignUpForm.test.tsx`:
  - When mocked `signUp` returns no session, `<CheckEmailNotice>` is rendered and no navigation occurs
  - When mocked `signUp` returns a session (auto-confirm fallback), existing navigation behavior preserved
- `AuthContext.test.tsx`:
  - `signUp` calls Supabase with the expected `emailRedirectTo` (including the forwarded `redirect` query)

**Verification:**
1. `cd e2e/supabase && supabase stop && supabase start` to pick up config changes (also `cd api/supabase && supabase stop && supabase start`)
2. `npm run web:dev` + `npm run api:watch`; sign up with a fresh email; confirm `<CheckEmailNotice>` appears; open the Mailpit UI at `http://127.0.0.1:54324` (served by the container Supabase still names `supabase_inbucket_*`); both pathways work — clicking the link AND typing the code each result in landing on `/create-team`
3. `npm run web:test` + `npm run api:test` green
4. `npm run e2e` green — existing tests continue working via the admin-API fixture's `email_confirm: true` (auto-confirms, bypassing the email step)

---

### Commit 4 — E2E coverage for magic-link and OTP signup paths

**Goal:** Cross-system assertion that the wired-up flow from commit 3 actually works end-to-end through a real browser, against the local Supabase + Mailpit stack.

**New fixture** (`e2e/fixtures/mailpit.ts`):
- Helper functions: `searchByRecipient(email)`, `getMessage(id)`, `clearAll()`. Targets `http://127.0.0.1:54424` (e2e Mailpit).
- **Note on naming:** Supabase CLI replaced Inbucket with Mailpit but kept the `[inbucket]` config block and the container name `supabase_inbucket_*` for backward compatibility. The actual image is `public.ecr.aws/supabase/mailpit` (verified via `docker inspect`), and the API surface is Mailpit's, not Inbucket's.
- **Search by recipient:** `GET /api/v1/search?query=to:<urlencoded email>` — returns newest-first. Verified shape:
  ```json
  { "total": 15, "count": 1, "messages_count": 1,
    "messages": [ { "ID": "Vqp696v5jB9384dNn4y8Pr",
      "From": { "Name": "Admin", "Address": "admin@email.com" },
      "To": [ { "Name": "", "Address": "bob2@test.com" } ],
      "Subject": "Confirm your F1 Fantasy email",
      "Created": "2026-05-10T04:29:00.864Z",
      "Snippet": "Confirm your email Welcome to F1 Fantasy!..." } ] }
  ```
- **Fetch message body:** `GET /api/v1/message/{ID}` — note singular `message`. Returns `{ ID, Text, HTML, ... }`. The `Text` body of a Supabase signup email contains both the magic link and the OTP. Verified excerpt:
  ```
  Confirm your email ( http://127.0.0.1:54421/auth/v1/verify?token=pkce_49af69736d98ab8581cfb35402e76a84b69db32b81ec70fd4f78af8b&type=signup&redirect_to=http://localhost:5273/auth/callback )

  Or enter this code in the app: *765877*
  ```
  The verify URL is *Supabase's* endpoint (port 54421 in e2e); hitting it 302s to the app callback (`http://localhost:5273/auth/callback?code=...`) which `<AuthCallback>` then exchanges for a session. The OTP is wrapped in `*…*` (markdown bold).
- **Per-test isolation:** `DELETE /api/v1/messages` (no body) clears all mailboxes — call from a per-test `beforeEach` so prior tests' emails don't bleed in.
- **Port arithmetic:** 54424 = Mailpit dev port 54324 (`api/supabase/config.toml:96`, under the still-named `[inbucket]` block) + 100 per the e2e port-shift rule.

**New e2e tests** (`e2e/tests/auth.spec.ts`):
- **Magic-link path:** fill signup form via UI → assert `<CheckEmailNotice>` appears → search Mailpit for the address → GET the message → regex `Text` for the verify URL → `page.goto(verifyUrl)` → assert the app shows `/create-team`.
- **OTP path:** fill signup form → assert `<CheckEmailNotice>` appears → search Mailpit → GET the same message → regex `Text` for `/Or enter this code in the app: \*(\d{6})\*/` → type the 6 digits into the OTP input → assert the app shows `/create-team`.

**Verification:**
- `npm run e2e` green (existing suite + the two new tests)

---

### Commit 5 — Resend confirmation email

**Goal:** "Resend" button on the pending UI re-sends the confirmation email (which contains both link and OTP).

**Wiring:**
- `web/src/contexts/AuthContext.ts` — add `resendConfirmation(email: string, options?: { redirect?: string }): Promise<void>` to interface
- `web/src/contexts/AuthContext.tsx` — implement: calls `supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: ${origin}/auth/callback${redirect ? '?redirect=' + encodeURIComponent(redirect) : ''} } })`; throws on error
- `web/src/components/auth/CheckEmailNotice/CheckEmailNotice.tsx` — add Resend button below the OTP form. On click, call `onResend()` (parent passes `auth.resendConfirmation(email, { redirect })`). Use existing `<LoadingButton>` for loading state. Use existing `LiveRegion` to announce success ("New confirmation email sent"). Use `<InlineError>` for errors, with friendly handling for Supabase's rate-limit error code (`over_email_send_rate_limit` → "Please wait a moment before requesting another email").
- `SignUpForm.tsx` — pass `onResend={() => auth.resendConfirmation(email, { redirect })}` to `<CheckEmailNotice>`, where `redirect` is read from the current route's search params (same source as the existing `redirect` handling at `SignUpForm.tsx:68-72`)

**Tests:**
- `AuthContext.test.tsx`: `resendConfirmation` calls `supabase.auth.resend` with the correct args (type, email, emailRedirectTo); also tests the `redirect` option is encoded into emailRedirectTo correctly
- `CheckEmailNotice.test.tsx`:
  - Clicking Resend calls `onResend`
  - Loading state visible during await
  - Success message announced via `LiveRegion`
  - Generic error rendered via `InlineError`
  - Rate-limit error renders friendly text
- `SignUpForm.test.tsx`: Resend button passes the current `redirect` param to `resendConfirmation`

**Verification:**
- Manual: sign up, click Resend, verify a second email appears in Mailpit; either email's link OR either email's most-recent OTP completes verification
- Manual: rapid-fire Resend → rate-limit message
- All test commands green

---

### Commit 6 — Friendly handling of unconfirmed-email sign-in

**Goal:** If a user signs up but never confirms, then later tries to sign in, they see the same `<CheckEmailNotice>` (with OTP entry + Resend) instead of a generic auth error.

**Wiring:**
- `web/src/components/auth/SignInForm/SignInForm.tsx` — after `signIn()` throws, inspect the error: if it's Supabase's `email_not_confirmed` (check `error.code === 'email_not_confirmed'` — verified against `auth-js/src/lib/error-codes.ts`; `AuthApiError` has a string `code` property per `auth-js/src/lib/errors.ts`), set local `pending` state and render `<CheckEmailNotice email={email} onVerified={handleVerified} onResend={() => auth.resendConfirmation(email, { redirect })} />`, where `redirect` is the current route's `redirect` search param (same source as today's signin redirect handling at `SignInForm.tsx:33-37`). `handleVerified` here navigates to redirect-or-`/leagues`. For any other error, fall through to the existing `<InlineError>` at `SignInForm.tsx:39-43`. The Resend's `redirect` override means the resent email's magic link will encode the signin-time destination rather than the (potentially different) signup-time one.

**Tests:**
- `SignInForm.test.tsx`:
  - Mocked `signIn` rejects with `email_not_confirmed` → `<CheckEmailNotice>` rendered, no navigation
  - Mocked `signIn` rejects with any other error → existing `<InlineError>` behavior preserved
  - On `<CheckEmailNotice>` `onVerified`, navigation runs with signin destination logic
  - Resend from this context passes the signin-time `redirect` param to `resendConfirmation`

**Verification:**
- Manual: sign up, do NOT click the email link / enter the OTP, navigate to `/sign-in`, attempt sign-in with the unconfirmed credentials, verify pending UI appears with working OTP entry + Resend
- All test commands green

---

## Critical files

**Modified:**
- `web/src/lib/supabase.ts` (commit 1 — add `flowType: 'pkce'`)
- `web/src/router.tsx` (commit 1 — add `/auth/callback` route)
- `api/supabase/config.toml` (commit 3)
- `e2e/supabase/config.toml` (commit 3)
- `web/src/contexts/AuthContext.tsx` (commits 3, 5)
- `web/src/contexts/AuthContext.ts` (commit 5)
- `web/src/components/auth/SignUpForm/SignUpForm.tsx` (commit 3, minor in commit 5)
- `web/src/components/auth/SignInForm/SignInForm.tsx` (commit 6)

**New:**
- `web/src/components/auth/AuthCallback/AuthCallback.tsx` + `.test.tsx` (commit 1)
- `web/src/lib/auth-destination.ts` + `auth-destination.test.ts` (commit 1)
- `web/src/components/auth/CheckEmailNotice/CheckEmailNotice.tsx` + `.test.tsx` (commit 2; expanded in commit 5)
- `web/src/components/ui/input-otp.tsx` (commit 2; added via shadcn workflow — exact path matches existing shadcn components in the project)
- `web/package.json` — adds `input-otp` dependency (commit 2)
- `api/supabase/templates/confirmation.html` (commit 3; includes both link and OTP from the start)
- `e2e/fixtures/mailpit.ts` (commit 4)
- New tests in `e2e/tests/auth.spec.ts` (commit 4)

**Reused (existing components, no changes):**
- `web/src/components/InlineError/InlineError.tsx` — error display in `<AuthCallback>`, `<CheckEmailNotice>`, existing forms
- `web/src/components/LiveRegion/LiveRegion.tsx` — screen-reader announcements
- `web/src/components/LoadingButton/LoadingButton.tsx` — Verify and Resend button loading states
- `web/src/hooks/useAuth.ts` — auth hook (gains `resendConfirmation` in commit 5)

---

## End-to-end verification (after all 6 commits)

1. **Magic-link happy path:** Sign up with new email → see `<CheckEmailNotice>` → check Mailpit → click link → land on `/create-team` logged in
2. **OTP happy path:** Sign up with new email → see `<CheckEmailNotice>` → check Mailpit → type 6-digit code into OTP field → land on `/create-team` logged in
3. **Resend:** Sign up → click Resend → second email arrives in Mailpit → either email's link OR the latest OTP completes verification (older OTP is invalidated by the new send per Supabase's behavior)
4. **Unconfirmed sign-in:** Sign up → DON'T confirm → go to `/sign-in` → submit credentials → see `<CheckEmailNotice>` → resend or OTP entry both work → land on `/leagues` (or wherever `redirect` param pointed)
5. **Existing e2e tests:** `npm run e2e` all green (admin fixture continues working via `email_confirm: true`)
6. **All tests + format + lint:** `npm run test:all` + `npm run web:lint` + `npm run web:format:check` + `npm run api:format:check` all green

---

## Production deployment notes (post-merge, manual)

- Enable Confirm Email in Supabase dashboard: Authentication → Providers → Email
- Add `https://<prod-domain>/auth/callback` to the redirect URL allowlist
- Configure SMTP for outbound email (currently commented out in `api/supabase/config.toml:186-194`; production must use a real provider)
- Upload the custom confirmation template (Supabase dashboard reads templates from the dashboard in production, not from the local config file)
- **Raise email rate limit**: `[auth.rate_limit] email_sent = 2` (per hour) at `api/supabase/config.toml:149` is sane for local dev but far too low for production. Set in the Supabase dashboard to a value appropriate for expected signup volume.

## Known preexisting concern (out of scope)

- `on_auth_user_created` trigger in `api/supabase/migrations/20260108000000_create_user_profile_trigger.sql` fires on every `INSERT` into `auth.users`, regardless of whether the user has confirmed their email. With confirmations enabled, this means `Accounts` and `UserProfiles` rows are created at signup time even if the user never confirms. Result: orphan rows accumulate from abandoned signups. Cleanup (e.g., a periodic job to remove unconfirmed users older than N days, or moving the trigger to fire only after confirmation) is out of 164's scope but should be tracked as follow-up.
