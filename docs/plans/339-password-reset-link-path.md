# Password reset — link path (#339)

## Context

A user who forgets their password currently has no way back into their account. Issue #339 builds the link path: request a reset email from `/forgot-password`, land on `/auth/recover` from the emailed link, verify the token on a Continue click, set a new password on `/reset-password`, end signed in at `/`. OTP entry, resend, and the password-changed notification are sibling sub-issues of #166 and stay out of scope.

The codebase has strong precedent from the email-confirmation work (#164/#189): a root-level `/auth/confirm` route with deferred verify (`ConfirmEmailNotice`), a branded `confirmation.html` template with a manually built `token_hash` link, Mailpit e2e fixtures, and the `config-sync` drift spec between dev and e2e Supabase configs.

## Design decisions

- **`/forgot-password` sits under `_unauthenticated` with no authed bounce.** The layout is a bare `<Outlet/>` (bounce lives per-child on sign-in/sign-up), and a signed-in user redirected off an expired link must see the `?error=expired` banner.
- **`/auth/recover` and `/reset-password` are root-level routes**, same placement reasoning as `/auth/confirm` (reachable with an active session).
- **RecoverNotice always verifies — no `!user` skip.** The token, not the ambient session, authorizes the reset (deliberate contrast with `ConfirmEmailNotice`). Any `verifyOtp` failure → `/forgot-password?error=expired` (single code per AC; gotrue emits `otp_expired` for expired/invalid/used alike). Success → `/reset-password`. No `next` param — destination is fixed.
- **New guard `requireRecoverySession`** in `route-guards.ts`: session-less `/reset-password` visit → redirect `/forgot-password` (not `/sign-in` — the recovery surface is the right remedy for a lapsed recovery session).
- **Enumeration safety:** the forgot-password form shows the identical check-email state on success *and* error. A surfaced rate-limit error would leak account existence (unknown addresses never send, so never hit the send limit). Rate-limit code → silent; unexpected errors → `Sentry.captureException`, still show check-email.
- **Supabase wrappers follow the `lib/auth-resend.ts` thin-module convention:** new `lib/auth-password.ts` with `sendPasswordResetEmail(email)` → `resetPasswordForEmail` (no `redirectTo`; template builds the link) and `updatePassword(password)` → `updateUser({ password })`.
- **Recovery email omits the OTP code entirely** (link only — code entry is the sibling issue), including the preheader and the "paste the code" aside.
- **Commit order:** `/reset-password` lands before `/auth/recover` so the recover component's typed `navigate({ to: '/reset-password' })` compiles.

## Commits

### Commit 1 — `feat(auth): add password recovery email template`

Everything outside the SPA.

- **Add `api/supabase/templates/password-reset.html`** — clone `confirmation.html` branding (zinc palette, dark-mode blocks, trophy mark). Link: `{{ .SiteURL }}/auth/recover?token_hash={{ .TokenHash }}&type=recovery` with the type-convention HTML comment. "The link expires in 60 minutes" copy (matches `otp_expiry = 3600`). Omit `{{ .Token }}` everywhere (preheader, code row, aside). P.S.: "Didn't request a password reset? You can safely ignore this email. Your password won't change." (e2e sees the file via the `e2e/supabase/templates` symlink.)
- **Modify `api/supabase/config.toml` + `e2e/supabase/config.toml`** — identical block directly after `[auth.email.template.confirmation]` in both (config-sync spec compares ordered lines):
  ```toml
  [auth.email.template.recovery]
  subject = "Reset your password"
  content_path = "./supabase/templates/password-reset.html"
  ```

**Tests:** none new; `e2e/tests/_infra/config-sync.spec.ts` is the drift guard (identical blocks pass without `IGNORED_KEY_RE` changes).
**Verify:** restart dev Supabase; `curl -X POST .../auth/v1/recover` for a seeded user; inspect Mailpit (54324): branding, `/auth/recover?token_hash=...&type=recovery` link, no 6-digit code, 60-minute copy. Confirm 200 for a nonexistent email. Run the config-sync spec.

### Commit 2 — `feat(auth): add forgot-password request flow`

- **Add `web/src/lib/auth-password.ts`** (`sendPasswordResetEmail` only for now). No standalone test file: the integration scenarios below run the real wrapper against the mocked supabase client, covering both its branches (forward the call, error → throw) through a real consumer — a separate unit test would fail in lockstep with them.
- **Add `web/src/components/auth/ForgotPasswordForm/ForgotPasswordForm.tsx`** — Card matching `SignInForm`; email input; submit → `sendPasswordResetEmail` in try/catch (rate-limit code `over_email_send_rate_limit` → no Sentry; other errors → `Sentry.captureException`); **always** flips to the check-email state: "If an account exists for **{email}**, we sent a password reset email." + spam-folder hint (simple card, no OTP input). `?error=expired` → `<InlineError>` banner above the form ("That reset link is no longer valid. Enter your email to request a new one."). Footer link back to `/sign-in`.
- **Modify `web/src/router.tsx`** — `forgotPasswordRoute` under `unauthenticatedLayoutRoute`, `validateSearch: z.object({ error: z.enum(['expired']).optional().catch(undefined) })`, **no `beforeLoad`** (comment: expired-link redirects must reach signed-in users); add to `addChildren`.
- **Modify `web/src/components/auth/SignInForm/SignInForm.tsx`** — password label row becomes `flex items-center justify-between`: Label + `<Button variant="link" asChild className="h-auto p-0 text-sm"><Link to="/forgot-password">Forgot password?</Link></Button>`.

**Tests:** new integration file `web/src/tests/integration/password-reset.integration.test.tsx` (mock `@/lib/supabase` with `resetPasswordForEmail`/`verifyOtp`/`updateUser` fns up front): submit → called with typed email + check-email echoes it; rate-limit error → identical check-email state, nothing surfaced (the enumeration-safety test); unexpected error → still check-email + Sentry captured (the capture is the only observable of a silent send failure — the UI deliberately looks like success); `/forgot-password?error=expired` → `role="alert"` banner; **same banner entry with `createAuthedAuth()` → banner renders, no bounce to `/`** (pins the no-authed-bounce design — a signed-in user redirected off an expired link must see it). No test for the static sign-in link (e2e clicks it).
**Verify:** `npm run web:test`, `web:lint`, `web:format:check`, `web:build`. Manual: link on sign-in; real email produces a Mailpit message; unknown email shows the identical state. (Dev rate limit is `email_sent = 2`/hour — a third submit silently sends nothing; correct, but confusing if forgotten.)

### Commit 3 — `feat(auth): add reset-password form behind recovery-session guard`

- **Modify `web/src/lib/auth-password.ts`** — add `updatePassword`.
- **Modify `web/src/lib/route-guards.ts`** — add `requireRecoverySession(context)`: user present → return; else `redirect({ to: '/forgot-password', replace: true })`.
- **Add `web/src/components/auth/ResetPasswordForm/ResetPasswordForm.tsx`** — password + confirm with `SignUpForm`'s exact password rules (mismatch → "Passwords do not match"; `< 6` → "Password must be at least 6 characters"), `noValidate`, `minLength={6}`, `autoComplete="new-password"`, LiveRegion + InlineError; submit → `updatePassword` → `navigate({ to: '/', replace: true })` (session persists through `updateUser`); failure → inline `error.message`.
- **Modify `web/src/router.tsx`** — root-level `resetPasswordRoute`, `beforeLoad: ({ context }) => requireRecoverySession(context)`, placement comment; add to `addChildren`.

**Tests:** unit — `route-guards.test.ts` (sessionless → redirect to `/forgot-password`; authed → no throw; the AC's guard coverage) and `ResetPasswordForm.test.tsx` (mock `@/lib/supabase` so the real wrapper runs, and `@tanstack/react-router` per `SignUpForm.test.tsx`): mismatch shown + `updateUser` not called; short password; `updateUser` error → inline error (covers the wrapper's throw branch). The AC's validation coverage — success→navigate wiring is owned by integration, not re-asserted here. Integration — sessionless `/reset-password` with the real guard lands on the forgot-password form; authed visit renders the form; authed submit calls `updateUser` and lands on the Home stub.
**Verify:** full web suite + build. Manual: signed-out `/reset-password` → `/forgot-password`; signed-in submit changes the password. **Run the revocation refresh-grant check** (procedure below) — the behavior is already source-verified for the running gotrue version; this confirms it empirically.

### Commit 4 — `feat(auth): verify recovery links on /auth/recover`

- **Add `web/src/components/auth/RecoverNotice/RecoverNotice.tsx`** — modeled on `ConfirmEmailNotice` (Card + Continue LoadingButton). `handleContinue`: always `verifyOtp({ token_hash, type })` — no signed-in skip (comment: deferred to the click so scanner prefetch can't burn the one-time token; always runs because the token, not the ambient session, authorizes the reset). Error → `/forgot-password?error=expired` (replace); success → `/reset-password` (replace).
- **Modify `web/src/router.tsx`** — root-level `authRecoverRoute` at `/auth/recover`, schema `{ token_hash: z.string().optional(), type: z.literal('recovery').optional() }`, `beforeLoad`: missing params → `/forgot-password` (replace); placement comment mirroring `authConfirmRoute`; add to `addChildren`.

**Tests (same integration file; `auth-confirm.integration.test.tsx` is the template):** not called on page load (200ms waitFor-reject pattern); Continue → called with `{ token_hash, type: 'recovery' }`; **called even when signed in** (`createAuthedAuth()` — name the test as the contrast with ConfirmEmailNotice); success handoff — `verifyOtp` mock calls `seedAuthStore({ user, session })` before resolving (supabase-js fires listeners before `verifyOtp` resolves; `renderWithRouter` wires the live store so the real `/reset-password` guard then passes) → reset form renders; error → forgot-password with the expired banner; missing params → forgot-password, `verifyOtp` never called.
**Verify:** full web suite + build. Manual dev loop: request → Mailpit link → Continue → set password → `/` signed in; re-click the used link → expired banner; click a link while signed in → verification still runs.

### Commit 5 — `test(e2e): cover password reset happy path and expired link`

- **Modify `e2e/fixtures/mailpit.ts`** — add `getRecoveryUrl(email)` (clone of `getConfirmationUrl`, regex `/https?:\/\/\S*\/auth\/recover\S*/`).
- **Add `e2e/tests/password-reset.spec.ts`** (`beforeEach`: `resetDb()` + `clearAll()`):
  - **Happy path:** `createTestUser()` → `/sign-in` → click "Forgot password?" → submit email → check-email copy echoes address → `expect.poll(searchByRecipient)` → `getRecoveryUrl` → goto → Continue → `/reset-password` → new password + confirm → `/` + authed welcome heading → sign out (Account menu → Sign Out, `/race to glory/i` hero) → `signInAs(page, { ...user, password: newPassword })` → authed `/`.
  - **Expired path:** `createTestUser()` → `/forgot-password` → submit → poll email → `getRecoveryUrl` → corrupt via `.replace(/token_hash=[^&]+/, 'token_hash=pkce_invalidinvalidinvalidinvalid')` (same technique as `auth.spec.ts`) → goto → Continue → URL `/forgot-password?error=expired` + `role="alert"` banner.
- No e2e config changes needed (`email_sent = 30`, `max_frequency = "1ms"` already give headroom).

**Verify:** `npm run e2e` fully green.

## Other-sessions revocation (resolved during planning, 2026-07-10)

Verified from the gotrue source: `UpdatePassword` revokes sessions unconditionally — `LogoutAllExceptMe` when called with an active session (our reset flow: the caller's session survives, every other session is revoked), `Logout` (everything) when session-less. No config flag gates it; `secure_password_change` and `[auth.sessions]` are unrelated. Introduced in gotrue v2.79.0 (released 2023-07-03). The dev and e2e stacks both run v2.188.1, whose tagged source contains the code.

Remaining empirical confirmation:

**During commit 3** (quick, against the e2e stack with a `createTestUser` user):

1. Mint session A: `POST http://127.0.0.1:54421/auth/v1/token?grant_type=password` — save `refresh_token`.
2. In the browser (session B), run the recovery flow and set a new password.
3. Replay A: `POST .../token?grant_type=refresh_token` with A's token — **expect 400** (revoked). A's *access* token staying valid until JWT expiry is JWT statelessness, not a failure; the refresh grant is the observable.
4. Confirm session B survived (protected route without re-auth).

**Post-merge**: repeat against the hosted project, or just confirm its version — `GET https://cfuccajsckqzecbfyqrv.supabase.co/auth/v1/health` with the anon key reports it; any gotrue ≥ v2.79.0 has the behavior.

## Risks

- **verifyOtp → navigate → guard race:** design leans on supabase-js awaiting `onAuthStateChange` listeners before `verifyOtp` resolves (documented in `authStore.ts`; `/auth/confirm` already relies on it). Encoded in the integration success-handoff test; proven for real by the e2e happy path.
- **`authReactions` cache reset on session appearance** while on `/auth/recover`: `router.invalidate()` re-runs its `beforeLoad`, a no-op with params present. No code change; e2e is the canary.
- **A signed-in user clicking a valid recovery link burns the token.** Intended per the AC — don't "fix" it later.
- **Config-sync ordering:** the recovery block must sit at the same relative position in both tomls.

## Critical files

- `web/src/router.tsx`, `web/src/lib/route-guards.ts` — routes + guard
- `web/src/components/auth/ConfirmEmailNotice/ConfirmEmailNotice.tsx` — template for RecoverNotice
- `web/src/tests/integration/auth-confirm.integration.test.tsx` — template for the integration suite
- `web/src/lib/auth-resend.ts` — wrapper convention for `auth-password.ts`
- `api/supabase/templates/confirmation.html`, `api/supabase/config.toml`, `e2e/supabase/config.toml`
- `e2e/tests/auth.spec.ts`, `e2e/fixtures/mailpit.ts` — e2e templates

## End-to-end verification (after commit 5)

1. `npm run test:all` and `npm run e2e` green; `web:lint` + both format checks clean.
2. Manual dev-stack loop: forgot → email → recover → reset → signed in at `/`; used link → expired banner; signed-in click → verification runs.
3. Other-sessions revocation confirmed via the refresh-grant check.
4. Production deployment (post-merge, manual — per #164's notes, production reads templates from the dashboard, not the repo): paste `password-reset.html` + the "Reset your password" subject into the Supabase dashboard's Reset Password template, and confirm the hosted gotrue is ≥ v2.79.0 (auth health endpoint) or re-run the refresh-grant check there.
