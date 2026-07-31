# Password reset — link path (#339)

## Context

A user who forgets their password has no way back into their account. Issue #339 builds the link path: request a reset email from `/forgot-password`, land on `/reset-password` from the emailed link, and set a new password — the token is verified on submit, not on page load:

```
email link → /reset-password?token_hash=…&type=recovery   (no session; form renders; token untouched)
  submit   → verifyOtp(token_hash) → updateUser(password) → /
```

OTP entry, resend, and the password-changed notification are sibling sub-issues of #166 and stay out of scope.

The codebase has precedent from the email-confirmation work (#164/#189): a `/auth/confirm` route with deferred verify (`ConfirmEmailNotice`), a branded `confirmation.html` template with a manually built `token_hash` link, Mailpit e2e fixtures, and the `config-sync` drift spec between dev and e2e Supabase configs.

## Design decisions

- **The emailed token authorizes the reset, not the session.** gotrue clears the recovery token _inside_ the verify call — `recoverVerify` → `user.Recover(tx)` sets `recovery_token = ""` and calls `ClearAllOneTimeTokensForUser` (`internal/api/verify.go`, `internal/models/user.go`). `POST /auth/v1/verify` — what `verifyOtp({ token_hash, type })` calls — _is_ that redemption, and nothing constrains when a page makes it. The link-click-burns-the-token behavior comes from `{{ .ConfirmationURL }}` pointing at gotrue's own `GET /verify`; our template hand-builds the link with `{{ .TokenHash }}`, so the token survives until the form spends it. No interstitial, and no route guard of any kind — see the next two bullets.
- **`verifyOtp` runs once per mount, even across retries.** It burns the token, and `updateUser` can still fail afterward (`weak_password`; gotrue also rejects reusing the old password with `same_password`). Re-verifying on a second submit would hit a spent token and dead-end the user, so the form tracks that it has verified and retries `updateUser` alone against the session it already holds.
- **`/reset-password` keeps the signed-out header even once it has a session.** `Layout` picks the navigation from `user`, and verifying the token mid-submit flips that from null to a user. Left alone, the sidebar grows in around the card and the form remounts: because `Layout`'s two branches place `<Outlet/>` at different depths, React tears down the reset form and mounts a fresh one, losing the typed passwords, any inline `updateUser` error, and the has-verified flag. A `staticData: { publicShell: true }` flag on the route holds `Layout` on the signed-out branch, so the subtree never changes and the form keeps its state. The general fix — navigation chosen by route position rather than at render time — is [#347](https://github.com/emsqrd/f1fantasyapp/issues/347), which also covers `/auth/confirm` rendering inside the sidebar for a signed-in visitor (it deliberately doesn't bounce them, since a re-clicked confirmation link lands there authed). Out of scope here.
- **Enumeration safety:** the forgot-password form shows the identical check-email state on success _and_ error. A surfaced rate-limit error would leak account existence (unknown addresses never send, so never hit the send limit). Rate-limit code → silent; unexpected errors → `Sentry.captureException`, still show check-email.
- **Supabase wrappers follow the `lib/auth-resend.ts` thin-module convention:** `lib/auth-password.ts` holds `sendPasswordResetEmail`, `verifyRecoveryToken`, and `updatePassword`, each unwrapping the error and throwing.
- **The expiry window spans typing.** gotrue measures expiry from `recovery_sent_at` (`isOtpExpired(user.RecoverySentAt, config.Mailer.OtpExp)`), so the 60 minutes must cover reading the email _and_ setting the password. `otp_expired` surfaces on submit, as an expired-link notice on the reset form itself.
- **An unusable link renders where it happens; `/forgot-password` is anonymous-only** (revised 2026-07-13; commits 2–3 shipped the earlier shape). The first design bounced verify failures to `/forgot-password?error=expired` — a leftover from the deleted `/auth/recover` interstitial, which had no page worth leaving the user on. "This link isn't usable" is **one state with one remedy** (get a fresh link) no matter which way the link is broken — token missing, `type` malformed, token expired, token already spent — so all four render the same in-place notice on `/reset-password` itself, with a "Request a new link" CTA. Only the last two are knowable at submit time (gotrue decides); the first two are knowable at mount. Same surface either way. No route feeds error state into `/forgot-password` anymore, so it drops the `error` search param and takes the same unconditional `redirectIfAuthenticated` bounce as sign-in/sign-up. That closes the stale-tab hole that prompted the revision: a tab sitting on `/forgot-password` when the reset completes in the emailed tab picks up the session (supabase-js cross-tab sync → `onUserChange` → `router.invalidate()`) and bounces home, instead of drawing the app sidebar around an anonymous form. Accepted cost: a signed-in user can't reach the request form — the notice's CTA bounces them to `/`. Recovery exists to regain access when signed out; rotating a known password is the future Account change-password (out of scope in #339, unfiled).
- **`/reset-password` has no `beforeLoad`, and the absence is load-bearing.** A guard's only vocabulary is `redirect`/`notFound` — it runs before the component exists, so it can relocate a visitor but never explain anything to them. An unusable link always has something to say, so the decision belongs in the component, beside the failed-verify branch that already handles the same event. Deleting the guard also disarms a redirect primitive that fires _mid-submit_: `executeBeforeLoad` runs unconditionally on every `router.load()` pass (`load-matches.js` — only _loaders_ get the valid/invalid short-circuit via `shouldSkipLoader`), and verifying the token flips the auth store, which fans out `onUserChange` → `authReactions` → `router.invalidate()` → `load()`. A guard checking "is `token_hash` present?" survives that pass only because the now-_spent_ param happens to still sit in the URL: correct by accident. Any later change that touches the search params on this route (e.g. clearing the spent token) would redirect the user off a dirty form after the token is burned but before `updateUser` runs, leaving them with a dead link and an unchanged password. The component owns the state instead, so an auth event can't reach it.
- **The token is read once, at mount, not on every render.** `const [recoveryToken] = useState(() => …)` makes it a fact about _this reset attempt_ rather than a value the router keeps re-reading. This is what makes the point above hold: no invalidation, auth flip, or future `navigate()` can change what the mounted form believes it holds.
- **`token_hash` in the URL is not a telemetry leak.** Checked against the live Sentry project with a fake token: the error event's URL is stored without its query string, and the navigation breadcrumb carrying it comes back `[Filtered]`. Sentry's default scrubbing handles it; no `beforeSend` scrubber needed. Nor is it stripped from the URL after verify: the one real exposure is the hosting access log, which records the query string on the initial document GET — before any client code runs — so a post-verify strip is too late to prevent the thing it looks like it prevents. Referrer leakage is already covered by the browser's `strict-origin-when-cross-origin` default (and the page loads nothing third-party), and a _spent_ token sitting in history is inert. If the access-log exposure ever matters, the answer is the URL fragment (never sent to the server), not stripping.
- **Recovery email omits the OTP code entirely** (link only — code entry is the sibling issue), including the preheader and the "paste the code" aside.

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

**Revised 2026-07-13, after this commit landed:** commit 4 moves the expired state onto `/reset-password` and removes what this commit added for it — the `?error=expired` banner, the `error` search param, the no-`beforeLoad` decision, and the pinned no-bounce test (the route now bounces authed visitors). See the design-decisions bullet. The sections above stay as the record of what this commit did.

### Commit 3 — `feat(auth): add reset-password form behind recovery-session guard`

- **Modify `web/src/lib/auth-password.ts`** — add `updatePassword`.
- **Modify `web/src/lib/route-guards.ts`** — add `requireRecoverySession(context)`: user present → return; else `redirect({ to: '/forgot-password', replace: true })`.
- **Add `web/src/components/auth/ResetPasswordForm/ResetPasswordForm.tsx`** — password + confirm with `SignUpForm`'s exact password rules (mismatch → "Passwords do not match"; `< 6` → "Password must be at least 6 characters"), `noValidate`, `minLength={6}`, `autoComplete="new-password"`, LiveRegion + InlineError; submit → `updatePassword` → `navigate({ to: '/', replace: true })` (session persists through `updateUser`); failure → inline `error.message`.
- **Modify `web/src/router.tsx`** — root-level `resetPasswordRoute`, `beforeLoad: ({ context }) => requireRecoverySession(context)`, placement comment; add to `addChildren`.

**Tests:** unit — `route-guards.test.ts` (sessionless → redirect to `/forgot-password`; authed → no throw; the AC's guard coverage) and `ResetPasswordForm.test.tsx` (mock `@/lib/supabase` so the real wrapper runs, and `@tanstack/react-router` per `SignUpForm.test.tsx`): mismatch shown + `updateUser` not called; short password; `updateUser` error → inline error (covers the wrapper's throw branch). The AC's validation coverage — success→navigate wiring is owned by integration, not re-asserted here. Integration — sessionless `/reset-password` with the real guard lands on the forgot-password form; authed visit renders the form; authed submit calls `updateUser` and lands on the Home stub.
**Verify:** full web suite + build. Manual: signed-out `/reset-password` → `/forgot-password`; signed-in submit changes the password. **Run the revocation refresh-grant check** (procedure below) — the behavior is already source-verified for the running gotrue version; this confirms it empirically.

### Commit 4 — `feat(auth): verify recovery token on password submit`

- **Modify `api/supabase/templates/password-reset.html`** — link target becomes `{{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}&type=recovery`; retarget the `type`-convention comment above it. (Templates load at container start: restart the dev Supabase stack or the old link keeps arriving.)
- **Modify `web/src/lib/auth-password.ts`** — add `verifyRecoveryToken(tokenHash)` → `verifyOtp({ token_hash, type: 'recovery' })`, throwing on error like its siblings.
- **Modify `web/src/lib/route-guards.ts`** — delete `requireRecoverySession`.
- **Modify `web/src/router.tsx`** — `resetPasswordRoute` gains `staticData: { publicShell: true }` and `validateSearch: z.object({ token_hash: z.string().optional().catch(undefined), type: z.literal('recovery').optional().catch(undefined) })`. **No `beforeLoad`** (see the design bullet). The `.catch(undefined)` on both fields is what keeps the schema _total_: without it, a malformed `type` (`?type=signup`, a mangled forward, a link scanner's rewrite) throws a `SearchParamError`, which TanStack raises at `load-matches.js:199` _before_ `beforeLoad` and routes to `errorComponent` — a generic "something went wrong" page for what is only a broken reset link. With it, every URL shape lands on the route and the component decides. Matches the existing `redirectSearchSchema` convention. Drop the `requireRecoverySession` import. `forgotPasswordRoute` loses `validateSearch` (the `error` param has no writer left) and gains `beforeLoad: ({ context }) => redirectIfAuthenticated(context)` — the bounce is also what sends a stale forgot-password tab home when the reset completes in another tab: cross-tab session sync fires `onUserChange` → `router.invalidate()`, which re-runs the guard.
- **Modify `web/src/components/Layout/Layout.tsx`** — take the signed-out branch when `!user` **or** any match carries `staticData.publicShell`. The `pageTitle` lookup already reads `useMatches()`, so this is one more read of the same source.
- **Modify `web/src/components/auth/ResetPasswordForm/ResetPasswordForm.tsx`** — capture the token once at mount: `const [recoveryToken] = useState(() => (search.type === 'recovery' ? (search.token_hash ?? null) : null))`. A `null` here means the link carried nothing spendable; that plus a failed verify are the same state, so both render the invalid-link notice (`role="alert"`, CTA to `/forgot-password`) and the form only mounts when there is a token to spend. Copy has to cover a link that never carried a token, not just a lapsed one: "We couldn't use that reset link. Reset links can only be used once, and they expire 60 minutes after they're sent. Request a new one to finish resetting your password." Submit: password rules first, then `verifyRecoveryToken(recoveryToken)` unless already verified this mount (comment: the token is one-time and spent by the first verify), then `updatePassword` → `/`. Update failure → inline `error.message`, form stays, session retained for the retry.
- **Modify `web/src/components/auth/ForgotPasswordForm/ForgotPasswordForm.tsx`** — delete the `?error=expired` banner branch; nothing navigates to it anymore.

**Tests:** unit — drop the `requireRecoverySession` block from `route-guards.test.ts`; add a `Layout.test.tsx` case for a route whose `staticData.publicShell` is set with a user present (signed-out header renders, sidebar does not). Integration (`password-reset.integration.test.tsx`): token is not verified on page load (200ms waitFor-reject pattern); submit verifies with `{ token_hash, type: 'recovery' }` **then** updates; `verifyOtp` error → the invalid-link notice replaces the form (`role="alert"`), no `updateUser` call, no navigation, and its "Request a new link" lands on `/forgot-password`; `updateUser` error after a successful verify → inline error, and a second submit calls `updateUser` again while `verifyOtp` stays at one call (the spent-token retry rule); **missing `token_hash` → the same notice on `/reset-password` (no redirect), `verifyOtp` never called; malformed `type` (`?type=signup`) → the same notice, not the error boundary** (pins the `.catch(undefined)`; without it this renders `RouteErrorComponent`); success → lands on the Home stub; authed entry to `/forgot-password` → bounced to `/` (replaces commit 2's pinned no-bounce test — delete it and the banner-rendering test along with the banner). The mismatch / too-short cases keep asserting `verifyOtp` is never reached. **Plus the mount regression:** mount the route under the real `Layout` with `publicShell` set and have the `verifyOtp` mock flip the auth store to a signed-in user as it resolves (what `onAuthStateChange` does in production) — the form must keep its mount and its typed values, and the retry-after-`weak_password` case must still call `verifyOtp` exactly once. Without the flag this fails.
**Verify:** full web suite + build. Manual dev loop: request → Mailpit link → land on the reset form with the signed-out header and no session → set password → `/` signed in; re-click the used link → submit → invalid-link notice in place; click a fresh link while signed in → signed-out header holds, submit still resets. Visit `/reset-password` bare **and** `/reset-password?token_hash=x&type=signup` → the invalid-link notice both times, no redirect and no error page. **Two-tab check (the bug that prompted the revision):** leave one tab on `/forgot-password` after requesting, complete the reset from the emailed link in a second tab → the first tab bounces to `/` with the app sidebar. Throttle the network and watch the submit: fields stay filled, no sidebar appears. **Run the revocation refresh-grant check** (below).

### Commit 5 — `test(e2e): cover the password reset happy path`

- **Modify `e2e/fixtures/mailpit.ts`** — add `getRecoveryUrl(email)` (clone of `getConfirmationUrl`, regex `/https?:\/\/\S*\/reset-password\S*/`).
- **Add `e2e/tests/password-reset.spec.ts`** (`beforeEach`: `resetDb()` + `clearAll()`):
  - **Happy path:** `createTestUser()` → `/sign-in` → click "Forgot password?" → submit email → check-email copy echoes address → `expect.poll(searchByRecipient)` → `getRecoveryUrl` → goto → assert the anonymous shell (no app sidebar; the token is unspent, so there is no session yet) → new password + confirm → submit → `/` + authed welcome heading → sign out (Account menu → Sign Out, `/race to glory/i` hero) → `signInAs(page, { ...user, password: newPassword })` → authed `/`. The closing re-sign-in is the point of the test: only a real gotrue round trip can show the password actually changed.
  - **Two tabs:** request the reset in one page, complete it from the emailed link in a second page of the same context, assert the first lands on `/` with the app shell. The session reaches the idle tab through supabase-js's cross-tab sync, which re-runs `redirectIfAuthenticated`. jsdom has one document, so the integration suite can cover the guard but not the propagation that fires it. This is the stale-tab hole the 2026-07-13 revision closed, and it moves here from the manual checklist.
- No e2e config changes needed (`email_sent = 30`, `max_frequency = "1ms"` already give headroom).

**No expired-link e2e** (revised 2026-07-14, during this commit). It was planned, written, and cut: its assertions duplicated commit 4's integration coverage of the same notice (alert replaces form, no `updateUser`, CTA to `/forgot-password`), and the only thing it left unmocked — gotrue rejecting a corrupted `token_hash` — is not a failure mode the component can regress into, since it treats _any_ throw from `verifyRecoveryToken` as a dead link. Per the overlap rule, the faster layer keeps it. The load-bearing failure of this flow, a spent token on a retried submit, is the integration suite's already.

The `publicShell` mid-submit behavior is likewise not e2e's: observing it means racing the submit, and the commit 4 mount-regression test already flips the auth store as `verifyOtp` resolves and asserts the form survives.

**Verify:** `npm run e2e` fully green.

## Other-sessions revocation (resolved during planning, 2026-07-10)

Verified from the gotrue source: `UpdatePassword` revokes sessions unconditionally — `LogoutAllExceptMe` when called with an active session (our reset flow: the caller's session survives, every other session is revoked), `Logout` (everything) when session-less. No config flag gates it; `secure_password_change` and `[auth.sessions]` are unrelated. Introduced in gotrue v2.79.0 (2023-07-03). The dev and e2e stacks both run v2.188.1.

Empirical confirmation, during commit 4 (against the e2e stack with a `createTestUser` user):

1. Mint session A: `POST http://127.0.0.1:54421/auth/v1/token?grant_type=password` — save `refresh_token`.
2. In the browser (session B), run the recovery flow and set a new password.
3. Replay A: `POST .../token?grant_type=refresh_token` with A's token — **expect 400** (revoked). A's _access_ token staying valid until JWT expiry is JWT statelessness, not a failure; the refresh grant is the observable.
4. Confirm session B survived (protected route without re-auth).

**Post-merge:** repeat against the hosted project, or confirm its version — `GET https://cfuccajsckqzecbfyqrv.supabase.co/auth/v1/health` with the anon key reports it; any gotrue ≥ v2.79.0 has the behavior.

## Risks

- **The reset form's survival mid-submit rests on a single flag.** Verifying the token makes a session appear while the form is still working, firing `authReactions`: `queryClient.clear()` + `router.clearCache()` + `router.invalidate()`. `Layout` reads `user` at render time and its two branches place `<Outlet/>` at different depths, so the anonymous → signed-in flip tears the reset form down and mounts a fresh one. `staticData: { publicShell: true }` is the only thing holding `Layout` on the signed-out branch. Without it the form loses its typed passwords, its captured `recoveryToken`, and its has-verified ref; the remount re-reads the now-spent token from the URL and dead-ends the user on the invalid-link notice — token burned, password unchanged, no way to finish without a new link. The commit 4 mount regression test is what stands between that and any refactor of `Layout` or the route's `staticData`. Structural fix: [#347](https://github.com/emsqrd/f1fantasyapp/issues/347), navigation chosen by route position rather than at render time; this plan does not wait on it. The re-run loaders are harmless (the root loader refetches the profile for the new session).

## Critical files

- `web/src/router.tsx` — route tree; `web/src/lib/route-guards.ts` — guards
- `web/src/components/Layout/Layout.tsx` — reads `staticData.publicShell` alongside `user`
- `web/src/tests/test-utils/routeTreeBuilders.tsx` — layout builders the integration trees share
- `web/src/tests/integration/password-reset.integration.test.tsx` — the suite commit 4 extends
- `api/supabase/templates/confirmation.html`, `api/supabase/config.toml`, `e2e/supabase/config.toml`
- `e2e/tests/auth.spec.ts`, `e2e/fixtures/mailpit.ts` — e2e templates

## Dev-stack notes

- Supabase loads email templates at container start — restart the stack after editing one, or the old link keeps arriving.
- Dev rate limit is `email_sent = 2`/hour. For fresh recovery links without spending it: `POST /auth/v1/admin/generate_link` with `{"type":"recovery","email":…}` and the service-role key.

## End-to-end verification (after commit 5)

1. `npm run test:all` and `npm run e2e` green; `web:lint` + both format checks clean.
2. Manual dev-stack loop: forgot → email → reset form (signed-out header, no session) → set password → signed in at `/`; used link → invalid-link notice on submit; a bare or malformed-`type` `/reset-password` → the same notice, not a redirect and not an error page; signed-in visitor keeps the signed-out header; a tab left on `/forgot-password` bounces home when the reset completes in another tab; throttled submit keeps its fields and grows no sidebar.
3. Other-sessions revocation confirmed via the refresh-grant check.
4. Production deployment (post-merge, manual — per #164's notes, production reads templates from the dashboard, not the repo): paste `password-reset.html` + the "Reset your password" subject into the Supabase dashboard's Reset Password template, and confirm the hosted gotrue is ≥ v2.79.0 (auth health endpoint) or re-run the refresh-grant check there.

## Code review findings (2026-07-14)

Multi-agent review of `git diff origin/main...HEAD` at xhigh effort: 6 finders, 46 candidates, 29 verifier agents, 9 refuted, 14 reported below in the order they were ranked. `CONFIRMED` = a verifier traced the failure through the source. `PLAUSIBLE` = the mechanism checks out but the trigger or impact was not fully pinned. Unreviewed and unfixed; reproduce before acting.

Session: https://claude.ai/code/session_016WQhinTVTphakrAZHyYAT5

### 1. `ResetPasswordForm.tsx:73` — correctness — CONFIRMED — Fixed in `c5e6f69`

The `hasSpentToken` guard is set only after `await verifyRecoveryToken(...)`, and `LoadingButton` renders `aria-busy` without `disabled`, so a double-submit fires two concurrent `verifyOtp` calls on the same single-use token.

User fills in both password fields and double-clicks "Update password" (or presses Enter while the click is in flight). `handleSubmit` runs twice; on the second entry `hasSpentToken.current` is still `false` because the first call is suspended at its `await`, so `verifyRecoveryToken(recoveryToken)` is issued a second time with the same `token_hash`. GoTrue consumes recovery tokens on first `/verify`, so the second call returns 403 `otp_expired`, the bare `catch` at line 76 runs `setTokenRejected(true)`, and the form is replaced by the "We couldn't use that reset link — Request a new link" card. Meanwhile the first invocation proceeds and may have already changed the password. The user is told their link is dead and is sent to request a fresh one, with no idea whether the reset actually took.

### 2. `authStore.ts:156` — correctness — CONFIRMED — Fixed in `29a20e7`

Skipping the `PASSWORD_RECOVERY` event does not stop supabase-js from persisting the recovery session, which a reload restores as an ordinary `INITIAL_SESSION` sign-in.

`GoTrueClient.verifyOtp` calls `await this._saveSession(session)` _before_ it emits `PASSWORD_RECOVERY`, so the recovery session is already in localStorage by the time this early-return runs. The invariant the guard establishes ("stay signed out until USER_UPDATED confirms the reset") therefore only survives until the next page load. Concretely: user opens the reset link and submits a password GoTrue rejects — e.g. retyping their existing password, which returns "New password should be different from the old password" — so `updatePassword` throws and only an inline error shows. The token is spent and the session is on disk. The user gives up, closes the tab, and reopens the app: `initAuthStore`'s `getSession()` on line 146 (and the `INITIAL_SESSION` event) returns that recovery session, `applySession` runs, and they are fully signed in having never set a password. Anyone who reads the reset email can obtain a working session this way while leaving the victim's password unchanged, so the account owner sees no password-change signal.

### 3. `api.ts:35` — correctness — CONFIRMED — Not fixing (accepted risk)

The new auth-store fallback in `getHeaders` makes `apiClient` send a bearer token in exactly the case that previously meant "no session" — after a sign-out that cleared Supabase storage but whose `SIGNED_OUT` event has not yet reached this tab's store.

User is signed in with the app open in two tabs. In tab B they sign out: `supabase.auth.signOut()` clears the session from localStorage immediately, and the `SIGNED_OUT` event reaches tab A only asynchronously over BroadcastChannel. During that window tab A refetches (e.g. react-query window-focus refetch on `/account`). `supabase.auth.getSession()` in tab A now returns `{ session: null }`, but `getAuthSnapshot().session?.access_token` still holds the pre-signout JWT (the store is only cleared by `applySession(null)` when the event lands). Before this change the request went out with no `Authorization` header and the API answered 401, failing closed. Now it goes out with a still-valid JWT and the API returns the signed-out user's data, which tab A renders. Worse, `GoTrueClient` only constructs a BroadcastChannel when `globalThis.BroadcastChannel` exists (`GoTrueClient.js:225`); where it doesn't, no cross-tab event ever arrives, so tab A's store keeps that token — and now authenticates every request with it — for the full lifetime of the JWT after the user believes they signed out.

**Not fixing.** The fallback is load-bearing in the other direction: a tab signed in by another tab — completing the reset in the emailed tab, which bounces this one home — fires its first authenticated requests before this tab's `getSession()` reflects the new sign-in, and the store supplies the token in that gap. Removing the fallback reintroduces those 401s; `api.test.ts:148` goes red on removal and the post-reset home load reproduces them. The sign-out fail-open above is the accepted cost: it exposes only the signed-out user's own data, for the BroadcastChannel propagation delay in a modern browser or until the JWT expires where no BroadcastChannel exists. The reason lives in a comment at the call site; no ADR, since the decision did not clear the significance gate and `api.test.ts:148` already guards removal.

### 4. `ResetPasswordForm.tsx:76` — correctness — CONFIRMED — Fixed

The bare `catch` around `verifyRecoveryToken` treats every failure — network blip, DNS failure, 500, CORS — as a spent/expired token and renders the terminal "link is dead" card.

User's phone drops off Wi-Fi for a second, or the Supabase auth endpoint returns a transient 502, at the moment they submit. `verifyOtp` rejects with a `TypeError: Failed to fetch` / `AuthRetryableFetchError`, the catch swallows it and sets `tokenRejected`, and the page renders "We couldn't use that reset link. Reset links can only be used once, and they expire 60 minutes after they're sent." The token was never actually spent and the link is still perfectly valid, but the UI gives the user no retry — only "Request a new link" — so they abandon a working link and start over on a false diagnosis. Nothing is reported to Sentry either, so a real auth-service outage looks like a wave of expired links.

### 5. `ResetPasswordForm.tsx:25` — correctness — CONFIRMED — Not fixing (superseded by ADR 010)

`hasSpentToken` is a per-mount `useRef`, so the record that the token was already spent does not survive a reload, and the component re-verifies a spent token instead of using the session that verification already minted.

User submits, `verifyOtp` succeeds (token spent, recovery session persisted by supabase), then `updateUser` fails (e.g. gotrue `weak_password` / `same_password`). The user reloads the page — the natural reaction to an error — which resets `hasSpentToken` to `false` while the search params still carry the same `token_hash`. The next submit calls `verifyRecoveryToken` again on the now-spent token, gotrue returns `otp_expired`, and the user gets the "We couldn't use that reset link" dead end and must request a new email — even though supabase still holds a valid recovery session for them and `updateUser` alone would have completed the reset.

**Not fixing — superseded.** The dead end still reproduces (verified in code and in the browser: same-password submit → verify succeeds, `updateUser` fails → reload → submit → the terminal card, with `POST /auth/v1/verify` returning 403 on the re-verify). But the remedy this finding assumes — reuse the session verification already minted — has no session to reuse. This review predates ADR 010 (commit `29a20e7`), which moved the recovery exchange onto `supabaseRecovery` with `persistSession: false`; the recovery session lives only in that throwaway client's memory and the reload discards it. localStorage was empty at every step of the repro — no persisted session survives the reload, by design. Reusing a persisted recovery session is exactly the account-takeover hole finding #2 closed, so the assumed fix would reopen it. After a reload the client cannot tell a spent token from a live one without asking gotrue, and has no session to fall back on, so re-verify → dead end is the only knowable path; the card already gives the sole correct remedy ("Request a new one"). The behavior is accepted as the cost of the ADR 010 invariant.

### 6. `ForgotPasswordForm.tsx:37` — correctness — CONFIRMED — Fixed

`setSubmitted(true)` in the `finally` block fires for every failure, not just the account-enumeration-sensitive ones, so transport and server errors are presented to the user as a successful send.

User is offline, behind a captive portal, or Supabase auth returns a 500. `sendPasswordResetEmail` rejects, the catch reports to Sentry, and the `finally` still flips `submitted` — the user sees "If an account exists for you@example.com, we sent a password reset link" and "Don't see it? Check your spam folder." No email will ever arrive. They wait, check spam, and are stuck, when a "Couldn't send right now, try again" message would have cost nothing: a transport failure leaks no account-existence information, unlike the rate-limit case the comment on line 25 is actually reasoning about.

**Fixed, with a narrower remedy than the finding assumed.** The finding lumps a server 500 in with transport failures as safe to surface; it isn't. GoTrue returns 200 for an unknown address but 500 (or a rate limit) for a real one whose send fails, so _any_ HTTP status is an enumeration oracle (verified against `internal/api/recover.go` + `mail.go`: the missing-user branch short-circuits to 200 before the send, so non-200 responses fire only for real accounts). The success transition moved out of `finally`; a retryable error now shows only when no response came back (`isAuthRetryableFetchError(err) && err.status === 0`, which is account-independent and not captured to Sentry). Every HTTP status stays on the indistinguishable check-email state, still capturing unexpected ones. This closes #6's UX complaint for the one case that's provably safe and leaves the server-error case as-is by design.

### 7. `api.test.ts:58` — test-coverage — CONFIRMED — Not fixing (accepted)

The entire `describe('constructor')` block — the only test covering `ApiClient`'s startup guard that throws "VITE_F1_FANTASY_API environment variable is not set" (`api.ts:18-24`) — was deleted with no replacement anywhere; the guard itself still exists but is now completely untested, and nothing in the diff or the plan explains the removal.

A future change renames the env var, reorders the constructor, or drops the `if (!envBaseUrl) throw` after a refactor of `getBaseHeaders` (the very method this diff touched). No test fails. The app builds and deploys with `this.baseUrl = undefined`, so every request becomes `fetch('undefined/api/me/profile')` — the user sees a blank page or a cascade of opaque network errors on load, instead of the loud, actionable startup error the guard was written to produce. `grep` confirms no other test in `web/src` asserts on that message.

**Not fixing (accepted).** A one-line fail-fast guard whose only failure mode — the env var unset at deploy — surfaces loudly at first boot and in the CI e2e run doesn't earn a `resetModules` + dynamic-import change-detector; the equivalent `supabase.ts` guard tests were deleted for symmetry, so both config guards are now held to the same untested standard. The real fix is a single validated `env.ts` consumed by both and tested as a pure function, out of scope for #339.

### 8. `ForgotPasswordForm.tsx:41` — accessibility — CONFIRMED

The submit → "Check your email" transition replaces the entire card with no live-region announcement and no focus management: the focused submit button is unmounted, focus falls back to `<body>`, and nothing is announced. Every other auth form in the codebase (`SignInForm`, `SignUpForm`, and the sibling `ResetPasswordForm` added in this same diff) wires `useLiveRegion`/`LiveRegion`; this form imports neither.

A screen-reader user tabs to "Send reset link" and presses Enter. `setSubmitted(true)` unmounts the form (including the focused button), so focus resets to the document body and no live region announces the new state. The user hears silence and has no indication whether the request went through; re-navigating with the virtual cursor is the only way to discover the "Check your email" card. This is a WCAG 2.1 AA status-message failure on the primary path, not an edge case.

### 9. `ResetPasswordForm.tsx:57` — simplification — CONFIRMED

The password rules (mismatch + min-length, including the exact message strings and the `setError`/announce/`setIsLoading` trio) are copy-pasted from `SignUpForm.tsx` lines 71-85, and `minLength={6}` is duplicated in both forms.

Changing the password policy (e.g. raising Supabase's minimum from 6 to 8, or adding a strength rule) requires finding and editing two identical blocks plus two `minLength` literals. Miss one and sign-up rejects a 6-character password client-side while password reset still accepts it and only fails on the gotrue round trip — with the recovery token already spent, so the user cannot retry from a fresh link. A shared `validateNewPassword(password, confirmPassword): string | null` (next to the other `lib/auth-*` helpers) removes the divergence.

### 10. `ResetPasswordForm.tsx:91` — correctness — PLAUSIBLE

The raw GoTrue error message is rendered straight into the `InlineError`, surfacing internal auth strings to the user.

`error instanceof Error ? error.message : …` passes `AuthApiError.message` through verbatim. If the user leaves the form open for more than an hour after the token is spent (or their recovery session is otherwise gone), `supabase.auth.updateUser` throws `AuthSessionMissingError` and the page displays the literal string "Auth session missing!" in a `role="alert"` box. The user is given a gotrue implementation detail with no remedy — the reset link they hold is already spent, so the correct guidance ("request a new link") is exactly what they are not told.

### 11. `ForgotPasswordForm.tsx:29` — correctness — PLAUSIBLE

The rate-limit check depends on a `code` field GoTrue does not always populate, so throttled requests can still be reported to Sentry.

`err.code === 'over_email_send_rate_limit'` is the only recognised throttle. GoTrue's generic request limiter returns 429 with `over_request_rate_limit`, and older/self-hosted GoTrue returns 429 with no `code` at all (only the message "For security purposes, you can only request this after N seconds"). Because the submit button is not disabled during the in-flight request (`LoadingButton` only sets `aria-busy`), an impatient user clicking "Send reset link" twice trips the throttle on the second call, which then falls through the `!isRateLimit` branch and is captured as an unexpected exception. Sentry fills with 429 noise from ordinary double-clicks, drowning the genuine send failures this capture exists to surface.

### 12. `ResetPasswordForm.tsx:34` — accessibility — PLAUSIBLE

`role="alert"` is put on the whole dead-link Card, but in the `!recoveryToken` case that card is present on first paint — live regions only announce content that changes _after_ the region exists, so nothing is announced and focus is never moved; the project convention reserves `role="alert"` for `InlineError`, and here it wraps a heading, a paragraph, and a link.

A screen-reader user opens a reset link whose `type` param was mangled by a link scanner (a case the totalized Zod schema exists to support). The component renders the alert Card as the initial page content, so assistive tech treats it as ordinary static content and announces nothing; the user, expecting a password form, hears only whatever the shell reads and never learns the link is dead. In the token-rejected transition the same role fires the opposite way — the entire card, including the "Request a new link" link text, is read as an assertive interruption.

### 13. `ResetPasswordForm.tsx:106` — correctness — PLAUSIBLE

The reset form has two `autocomplete="new-password"` fields and no username/email field, so password managers have nothing to bind the new credential to; Chrome/Safari guidance for password-change forms is to include a hidden or readonly `autocomplete="username"` field carrying the account email.

User completes the reset in Chrome. The save/update prompt fires on a form with no username field, so the manager either saves an entry with an empty username or updates the wrong stored credential for the site. On the next visit the saved password no longer autofills against their email, and the user is pushed back through the reset flow. The email is recoverable for the form (it is on the recovery session `verifyOtp` mints, or could be carried in the link), so nothing prevents rendering the username field.

### 14. `router.tsx:235` — correctness — PLAUSIBLE

`staticData.publicShell` is untyped — `Layout` reads it through an `as { publicShell?: boolean }` cast — so a typo in the flag compiles clean and silently reverts the route to the authenticated shell.

Writing `staticData: { publicshell: true }` (or moving/renaming the key) type-checks, `Layout`'s cast yields `undefined`, and the reset form remounts mid-submit on the auth flip: typed passwords and the `hasSpentToken` ref are lost, the spent token is re-read from the URL, and the user dead-ends with a burnt token and an unchanged password. TanStack supports augmenting `StaticDataRouteOption`, and `router.tsx` already has a `declare module '@tanstack/react-router'` block at line 684 — declaring `pageTitle?: string; publicShell?: boolean` there types every `staticData` read and deletes the casts in `Layout.tsx` (lines 21-23 and 27-29).
