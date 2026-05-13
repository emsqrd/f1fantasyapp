# Plan — Issue #164: Require email confirmation on signup

## Context

Email confirmations are currently disabled in Supabase (`enable_confirmations = false` in `api/supabase/config.toml:176`). Anyone can sign up with any email and immediately be logged in — there's no proof of address ownership. The issue asks us to:

1. Enable email confirmations
2. Show a "pending confirmation" state after signup (since `signUp()` will no longer return a session)
3. Allow the confirmation email to be resent
4. Complete verification when the user clicks the email link
5. Handle the case where an unconfirmed user later tries to sign in

**Out of scope:**

- Branded email template content (deferred to #22)
- Standardizing post-auth redirect destinations (deferred to #165)
- Production Supabase dashboard configuration (must be done manually after deploy: enable Confirm Email in Authentication → Providers → Email, add `https://<prod>/auth/callback` to redirect allowlist, upload custom template)

## Decisions

| Decision                                    | Choice                                                                                                                                                                                                                                  | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Confirmation method                         | **Both magic link AND OTP code** in the email; user can use whichever                                                                                                                                                                   | Resilient to corporate email scanners (Defender, Barracuda, Mimecast) that pre-fetch links and consume the token before users click. Supabase auth issue [#1214](https://github.com/supabase/auth/issues/1214) is open and unfixed; no clean recovery for affected users without an OTP fallback. Default Supabase template already emits both, so the email-side cost is near zero.                                                                                                                                                                                                                                |
| OTP input component                         | Custom `<OtpInput>` at `web/src/components/OtpInput/`                                                                                                                                                                                   | Hand-rolled single-input + overlay slot pattern (same architecture as `input-otp`) that fixes the slot-retargeting bug ([shadcn/ui #4046](https://github.com/shadcn-ui/ui/issues/4046)) where clicking a non-final slot focuses the last cell. Preserves every must-have: single accessible `<input>` for WCAG 1.3.5, iOS/Android SMS autofill via `autocomplete="one-time-code"`, native paste, full keyboard a11y, auto-submit. Lives outside `ui/` because `ui/` is reserved for vendored shadcn; sits next to the other custom primitives (`LoadingButton`, `InlineError`). Removes the `input-otp` dependency. |
| Pending-UI surface                          | Inline state + shared `<CheckEmailNotice>` component                                                                                                                                                                                    | No URL params (OWASP: PII like email shouldn't appear in URLs — leaks via browser history, server logs, Referer to Sentry). Refresh degrades benignly: link in inbox still works, resend reachable via signin path.                                                                                                                                                                                                                                                                                                                                                                                                 |
| `<CheckEmailNotice>` shape                  | **Card-only component, not a full-page screen** — returns the `<Card>` directly; page chrome (centering, full-viewport height, background) is the caller's responsibility                                                               | The caller already provides a page wrapper (`SignUpForm`'s and `SignInForm`'s outer `flex w-full ... justify-center ... md:min-h-screen` div). A second wrapper inside `<CheckEmailNotice>` would double-wrap and made the Card's `w-full max-w-lg` resolve against a content-sized parent, which let the `<InlineError>`'s width feed back into the Card width. Card-only avoids both issues; commits 3 and 6 swap `<CheckEmailNotice>` in place of the existing `<Card>` inside the parent's wrapper.                                                                                                             |
| Auto-submit vs. manual submit               | **Auto-submit on 6th digit AND a manual Verify button**, no `<form>` wrapper. Button is `type="button"` with `onClick`. No Enter-to-submit                                                                                              | Auto-submit covers every typed/pasted happy path (`onPaste` in `<OtpInput>` also fires `onChange`). The Verify button serves as the loading-state visual, the success-state visual ("Verified" + check), and the explicit retry affordance after a failure. The `<form>` was vestigial after we dropped HTML-form-validation; its only remaining job was Enter-to-submit, which would only ever re-fire the same already-failed code — a weak use case for OTP.                                                                                                                                                     |
| Verify button shape                         | Centered, `size="lg" min-w-48`, not full-width                                                                                                                                                                                          | Centered slots above + centered button below reads visually balanced. Full-width would deviate less from `SignUpForm`/`SignInForm` but visually anchors the manual button more heavily than is warranted given auto-submit is the primary path. `min-w-48` keeps the tap target generous on mobile.                                                                                                                                                                                                                                                                                                                 |
| Failure copy                                | Static generic message _"That code didn't match. Check your email for the latest one."_ — not the raw Supabase error string                                                                                                             | Supabase emits jargon ("Token has expired or is invalid"). Users typed a "code", not a "token", and the canonical follow-up is to enter a new code from the latest email. Also: `verify()` no longer optimistically clears the error at function entry (only on success), so re-attempts don't unmount/remount the `<InlineError>` and trigger a layout shift mid-flight.                                                                                                                                                                                                                                           |
| Error placement inside `<CheckEmailNotice>` | `<InlineError>` sits _under_ the slot row, inside the same `space-y-3` group, replacing the idle-state status hint when present                                                                                                         | Keeps the eye path slots → error → button continuous. Originally placed above the slots; that path made the user snap up to the top, then back down to retype.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Email passing                               | React state within form components                                                                                                                                                                                                      | User never retypes — Supabase's confirmation token uniquely identifies the user. Email passed as prop from parent (`SignUpForm`, `SignInForm`) into `<CheckEmailNotice>`.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Sign-in unconfirmed handling                | In scope, same issue (commit 5)                                                                                                                                                                                                         | Completes the verification story: signup → pending → resend → confirm AND signin → unconfirmed → resend.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Post-confirmation destination               | Preserve current logic per parent (`SignUpForm` → redirect-or-`/create-team`; `SignInForm` → redirect-or-`/leagues`; magic link callback uses URL `redirect` search param, else `/create-team`)                                         | Standardization deferred to #165.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Resend with redirect override               | `AuthContext.resendConfirmation(email, { redirect? })` accepts the current redirect param so the resent email's link encodes the _current_ destination (e.g., signin's `/leagues/123`) rather than whatever was baked in at signup time | Helps a user who hits the unconfirmed-signin path with a deep link, triggers Resend, and uses the new email's link. The original signup email's link still routes to `/create-team` (can't fix retroactively); the OTP path always routes correctly via the callsite.                                                                                                                                                                                                                                                                                                                                               |
| E2E approach                                | Existing admin-API fixture keeps `email_confirm: true` (auto-confirms); add two new tests in commit 6 (magic-link path + OTP path)                                                                                                      | Existing tests stay fast; targeted e2e covers the new wiring                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Email template                              | Custom template at `api/supabase/templates/confirmation.html` includes both `{{ .ConfirmationURL }}` and `{{ .Token }}`, lands in commit 3 alongside the config flip                                                                    | Default Supabase template already has both; we're shipping our own to control wording and prep for #22's branding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Cross-issue ordering                        | 164 → 167 → 165 (locked)                                                                                                                                                                                                                | 164 builds verification primitives; 167 reuses callback route + OTP entry pattern for change-email re-verification; 165 audits all destinations after both new flows exist.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Auth callback implementation                | **Route loader + inline `errorComponent`, no separate component**                                                                                                                                                                       | Async work belongs in a TanStack Router `loader` (matches every other async route in the codebase — `joinInviteRoute`, `accountRoute`, etc.); avoids the `useEffect` + `cancelled`-flag anti-pattern. Side effects (Sentry capture) live at the failure site inside the loader's `try/catch`, not in a render-time hook. The shared `ErrorFallback` doesn't fit (hardcoded copy + "Try again" button; reloading can't fix a consumed PKCE code), and the bespoke error UI is small enough to inline in `errorComponent` rather than warrant a dedicated component file.                                             |
| Sentry coverage for loader failures         | Manual `Sentry.captureException` inside the loader's `try/catch`                                                                                                                                                                        | The auth-callback failure mode is a Supabase SDK error that bypasses `apiClient`'s built-in HTTP-error capture, so without explicit capture in the loader, Sentry never sees PKCE failures. This is consistent with the existing pattern in `rootRoute.beforeLoad`. The codebase-wide observability gap (loader failures outside `apiClient` are silently rendered) is tracked separately in #180; commit 1 doesn't try to solve it here.                                                                                                                                                                           |

---

## Commits

Each commit is a gate. Each must independently build, lint, test, and format. Wait for approval before moving on. Note: these commits are sized for review/approval — they don't necessarily map 1:1 to production deploys. Recommendation is to land all six before flipping production confirmations on, so users always have the OTP fallback path. The local-dev confirmation flip happens in commit 3; commits 1–2 are preparatory and safe under `enable_confirmations = false`.

### Commit 1 — PKCE flow + `/auth/callback` loader

**Goal:** Stand up the magic-link landing page and switch the Supabase client to PKCE so the link returns `?code=` instead of an implicit hash. Safe to land while `enable_confirmations` is still `false`: the route exists but nothing emits a magic link yet, and PKCE is fully compatible with the existing implicit-flow happy path.

**Supabase client flow change** (`web/src/lib/supabase.ts`):

- Today: `createClient(url, key)` with no options → defaults to `flowType: 'implicit'` (verified in `auth-js` source — `DEFAULT_OPTIONS.flowType: 'implicit'`)
- Required: pass `{ auth: { flowType: 'pkce' } }` so the magic link returns `?code=` (which `exchangeCodeForSession` consumes) instead of `#access_token=` (implicit hash flow)
- This is a small but app-wide auth behavior change — covered by existing AuthContext tests

**New helper** (`web/src/lib/auth-destination.ts`):

- `getPostSignupDestination(redirectParam?: string): string` — returns `redirectParam` if present, else `/create-team`. Search-param validation is already enforced upstream by the route's Zod schema, so this helper just chooses between two valid values. Used by the auth-callback loader here, and later by `SignUpForm` and `<CheckEmailNotice>`'s `onVerified` from the signup callsite (commit 3). Lands here because the auth-callback loader is its first caller.

**Wiring** (`web/src/router.tsx`):

- New Zod schema `authCallbackSearchSchema` validates `code` (optional string) and `redirect` (optional string, must start with `/` — same shape as the existing `redirectSearchSchema`).
- New `authCallbackRoute` as a public child of root (sibling to `/sign-up`, `/sign-in`). Built as a loader-driven route:
  - `loaderDeps` pulls `code` and `redirect` from the validated search params.
  - `loader` wraps the exchange in `try/catch`: if `code` is missing or `supabase.auth.exchangeCodeForSession` returns/rejects with an error, capture to Sentry with `tags: { component: 'authCallbackRoute', operation: 'exchangeCodeForSession' }` and rethrow. On success, `throw redirect({ to: getPostSignupDestination(redirect) })`.
  - `pendingComponent` renders a "Confirming your email..." spinner during the loader phase.
  - `errorComponent` is inlined: renders `<InlineError>` with the user-friendly copy and a "Back to sign in" `<Link>`. No dedicated component file — the shared `ErrorFallback` doesn't fit (hardcoded copy, "Try again" button that can't recover a consumed PKCE code), and the bespoke UI is ~15 lines of JSX.
  - No `component` field — the loader always throws (`redirect` on success, captured error otherwise), so the route never renders to a normal component.

**Tests:**

- `web/src/tests/integration/auth-callback.integration.test.tsx` — covers loader branches via a real router mounted over an inline route-tree mirror (matches the convention in `account.integration.test.tsx`):
  - Default destination: with `?code=abc`, loader exchanges and redirects to `/create-team`; no Sentry capture.
  - `redirect` honored: with `?code=abc&redirect=/leagues`, loader redirects to `/leagues`.
  - Missing `code`: renders error UI + `Sentry.captureException` called with `component: authCallbackRoute`.
  - Supabase returns error: renders error UI + Sentry captured with the supabase error.
  - Supabase rejects: renders error UI + Sentry captured with the rejection.
- `auth-destination.test.ts`:
  - Returns the redirect param when provided.
  - Falls back to `/create-team` when redirect is missing/empty.
- Existing `AuthContext.test.tsx` keeps passing under PKCE (no behavioral change to the public API).

**Verification:**

1. `npm run web:test` green
2. `npm run web:lint` + `npm run web:format:check` green
3. `npm run web:build` green (TypeScript compile)
4. Manual: existing signup/signin flow still works (auto-confirm path, no email sent because `enable_confirmations` is still `false`)

---

### Commit 2 — `<OtpInput>` primitive + `<CheckEmailNotice>` component

**Goal:** Add the pending-state UI as a self-contained, tested component, backed by a hand-rolled `<OtpInput>` primitive (no `input-otp` dependency). Fixes the slot-retargeting bug so a user can click any slot to edit just that digit. Not yet wired into any form — that happens in commit 3.

**New primitive — `<OtpInput>`** (`web/src/components/OtpInput/OtpInput.tsx`):

- **Architecture:** Single-input + overlay slots, stacked via CSS Grid (not `position: absolute`). One real `<input>` and one slot-row `<div>` are both children of a `grid` container, both placed at `col-start-1 row-start-1` so they occupy the same cell. The input is rendered with transparent text and caret (`text-transparent caret-transparent`) and sits _under_ the slot row (which has `z-10`), so the slot row intercepts clicks and the input owns keyboard input + SMS autofill + screen-reader naming.
- **Scope:** numeric OTP only. The non-digit filter and `inputMode="numeric"` default are baked in; no `pattern` prop. Spelled out in the component's JSDoc.
- **Why single input, not N individual inputs:** `<input autocomplete="one-time-code">` SMS autofill on iOS only works with a single input ([web.dev — SMS OTP form](https://web.dev/articles/sms-otp-form), confirmed broken on multi-input in [Chakra #4095](https://github.com/chakra-ui/chakra-ui/issues/4095), [react-verification-input #57](https://github.com/andreaswilli/react-verification-input/issues/57)). Paste, backspace, and arrow nav also come free at the browser level.
- **Props:**
  - `id?: string` — forwarded to the underlying `<input>` so external `<Label htmlFor>` works
  - `value: string`, `onChange: (value: string) => void`
  - `length?: number` (default `6`) — also forwarded as `maxLength`
  - `disabled?: boolean`
  - `'aria-label'?: string`
  - `autoComplete?: string` (default `"one-time-code"`)
  - `inputMode?: ComponentPropsWithoutRef<'input'>['inputMode']` (default `"numeric"`)
  - `className?: string` — merged via `cn()` onto the grid container (outer sizing only)
  - `slotClassName?: string` — merged onto each slot for per-slot style overrides
  - Each visible slot carries `data-slot="otp-slot"` as a styling/structure marker (mirrors the shadcn convention). Not a public test hook except for the one click-retargeting test that the bug it guards is structural-positional.
- **Behavior:**
  - `onChange` strips non-digit characters and slices to `length`.
  - **Paste interceptor (`onPaste`):** intercepts paste events, `preventDefault`s the browser default, sanitizes `clipboardData.getData('text')`, and calls `onChange` with the sliced result. Necessary because `maxLength` on the underlying input would otherwise truncate a mixed-character paste (e.g., `"abc123456xyz"`) to its first 6 characters (`"abc123"`) _before_ our digit filter can run. With the interceptor, paste yields `onChange("123456")` in a single call.
  - **Click-to-edit any slot (the bug fix):** on slot `onPointerDown`, `preventDefault`, `focus()` the input, then `setSelectionRange(i, i+1)` if the slot has a character, else collapse the caret at `min(i, value.length)`. Safari requires `focus()` before `setSelectionRange`.
  - **Active slot tracking:** uses a `document`-level `selectionchange` listener (gated on `isFocused`) — the only DOM event that fires for _every_ selection mutation, including programmatic `setSelectionRange`. `onSelect` would miss the click-retarget case. The listener updates a `selectionStart` state, and `activeIndex` is derived from `isFocused + selectionStart + value.length`. Caret animation uses `animate-caret-blink` (from `tw-animate-css`).
  - **Disabled:** propagates to the `<input>` and the slot container (`pointer-events-none opacity-50`).
- **Styling defaults baked in:** slot `h-14 w-12 rounded-md border font-mono text-2xl font-medium tabular-nums`; active state `border-primary ring-2 ring-primary/40 ring-inset`; slot-row `flex justify-center gap-2.5`. Consumer-supplied `className` / `slotClassName` merge via `cn()` (Tailwind merge wins on conflicts).
- **Accessibility:** the grid container carries no `role`; the slot-row `<div>` is `aria-hidden="true"`. Screen readers see only the single labeled `<input>`.

**New flow component — `<CheckEmailNotice>`** (`web/src/components/auth/CheckEmailNotice/CheckEmailNotice.tsx`):

- **Returns just a `<Card>`** — no outer page wrapper. Caller (commit 3's `SignUpForm`, commit 5's `SignInForm`, dev-route scaffolding) provides centering, full-viewport height, and background.
- **Props:**
  - `email: string` — rendered in the body
  - `onVerified: () => void` — called after `verifyOtp` resolves successfully so caller can navigate
  - `onResend?: () => Promise<void>` — declared in `Props` for commit 4; renders nothing in commit 2 (no `CardFooter` yet)
  - `onChangeEmail?: () => void` — same; renders nothing until commit 4 reintroduces the `CardFooter`
- **Layout:**
  - `CardHeader`: envelope icon, "Check your email" heading, two-paragraph body (sentence 1 with the email chip; sentence 2 with "Enter it below or click the link…") wrapped in a `space-y-2` div so the two `<p>`s are visually separated.
  - `CardContent` (`space-y-4`): a `space-y-3` group containing the label + progress bar, the `<OtpInput length={6} className="w-full" />`, and (when set) `<InlineError>`. Below the group, a centered `<LoadingButton size="lg" min-w-48>` that fires `verify(code)` on click.
- **No `<form>` wrapper.** Verify button is `type="button"` with `onClick={() => { if (status === 'idle') verify(code); }}`. Auto-submit handles every code-completion path (`onChange` reaches `OTP_LENGTH`). The `status === 'idle'` guard on the button prevents a mid-verify re-click from re-firing.
- **`verify(token)`:** sets status to `'verifying'`, awaits `supabase.auth.verifyOtp({ email, token, type: 'signup' })`. On success: clears `error`, sets status to `'success'`, calls `onVerified()`. On failure (rejection OR returned error): sets a static generic message _"That code didn't match. Check your email for the latest one."_ and resets status to `'idle'`. Notably, the error is _not_ optimistically cleared at function entry — so a re-attempt doesn't unmount/remount `<InlineError>` and trigger a layout shift while the new request is in flight.
- **`Status` type:** `'idle' | 'verifying' | 'success'`. Drives the `<OtpInput disabled>`, the `<LoadingButton isLoading>`, the Card's success ring (`ring-1 ring-emerald-500/40`), and the button's "Verified" + check icon swap-in. No separate status-line component — `LoadingButton` and the Card visual state carry it.

**Tests:**

- `OtpInput.test.tsx` (6 behavioral tests): attribute forwarding (`inputmode` / `maxlength` / `autocomplete`); typing filters non-digits; paste yields one `onChange` call with sanitized + sliced value; backspace removes last digit; click slot 3 after full code → `selectionStart === 3` (the bug fix); `disabled` prevents typing.
- `CheckEmailNotice.test.tsx` (4 behavioral tests, trimmed per the testing strategy — no static-JSX assertions, no duplication of `OtpInput`'s attribute matrix, no separate test per error code path):
  - Email prop renders in the body
  - Auto-submit fires `verifyOtp` with `{ email, token, type: 'signup' }` and `onVerified` on success
  - Failure path renders the generic `<InlineError>` text and skips `onVerified`
  - Verify button stays disabled (and `verifyOtp` uncalled) until the 6th digit lands

**Verification:**

1. `npm run web:test` + `npm run web:lint` + `npm run web:format:check` + `npm run web:build` green.
2. Manual via a working-tree `/dev/check-email` scratch route (added during implementation, removed before commit): (a) typing 6 digits triggers auto-submit, (b) clicking a middle slot after entering a full code retargets the caret to that slot, (c) pasting `"abc123456xyz"` fills the slots with `123456`, (d) iOS Simulator one-time-code autofill still works (sanity check that single-input wasn't broken).
3. Scratch route + its `CheckEmailNotice` import removed from `web/src/router.tsx` before commit.

---

### Commit 3 — Enable confirmations + wire SignUpForm into the pending UI

**Goal:** Flip the feature on. Signup goes end-to-end via either path: submit → "check your email, click link or enter code" UI → user clicks link OR types code → land back in app, logged in. (Resend deferred to commit 4; signin-unconfirmed deferred to commit 5.) This is the load-bearing commit; commits 1–2 are preparatory.

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
  - No new context method this commit (resend in commit 4).
- `web/src/components/auth/SignUpForm/SignUpForm.tsx`:
  - After successful `signUp()`, branch on `data.session`:
    - If `session` is non-null (auto-confirm fallback if confirmations are ever disabled): existing navigate-to-destination logic at lines 68-72.
    - If `session` is null: set local `pending` state, render `<CheckEmailNotice email={email} onVerified={handleVerified} />` _in place of the existing `<Card>`_ (not the whole component) — the outer page wrapper (`<div className="flex w-full items-center justify-center p-8 md:min-h-screen">` and the `<div className="w-full max-w-md space-y-4">` cap) stays. `handleVerified` runs the same destination logic via `getPostSignupDestination`.
  - Width nuance: `<CheckEmailNotice>` Card is `max-w-lg` (512px), but the parent's `max-w-md` cap wins, so pending renders at 448px — same width as the form. If you want pending wider, raise the `SignUpForm` wrapper's cap to `max-w-lg`.

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

### Commit 4 — Resend confirmation email

**Goal:** "Resend" button on the pending UI re-sends the confirmation email (which contains both link and OTP).

**Wiring:**

- `web/src/contexts/AuthContext.ts` — add `resendConfirmation(email: string, options?: { redirect?: string }): Promise<void>` to interface
- `web/src/contexts/AuthContext.tsx` — implement: calls `supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: ${origin}/auth/callback${redirect ? '?redirect=' + encodeURIComponent(redirect) : ''} } })`; throws on error
- `web/src/components/auth/CheckEmailNotice/CheckEmailNotice.tsx` — **reintroduce** the `<CardFooter>` (removed during commit 2's trim) and add a Resend button inside it, gated on the existing `onResend` prop being present. On click, call `onResend()` (parent passes `auth.resendConfirmation(email, { redirect })`). Use existing `<LoadingButton>` for loading state. Use existing `<LiveRegion>` to announce success ("New confirmation email sent"). Use `<InlineError>` for errors, with friendly handling for Supabase's rate-limit error code (`over_email_send_rate_limit` → "Please wait a moment before requesting another email"). The `onResend` prop and `handleResend` orchestrator already exist in `Props` from commit 2's interface but render nothing today.
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
- `web/src/tests/integration/signup-resend.integration.test.tsx` — frontend integration (real router over an inline route-tree mirror, same convention as `auth-callback.integration.test.tsx` and `account.integration.test.tsx`; mock only the Supabase SDK):
  - Mount the app at `/sign-up?redirect=/leagues/123`, submit the form, assert `<CheckEmailNotice>` renders. Click Resend, assert `supabase.auth.resend` was called with `{ type: 'signup', email, options: { emailRedirectTo: 'http://localhost/auth/callback?redirect=%2Fleagues%2F123' } }` — proves the route's `redirect` search param actually threads through the form → context → SDK call.
  - Same setup, mock `supabase.auth.resend` to return `{ error: { code: 'over_email_send_rate_limit' } }`, click Resend, assert the friendly rate-limit copy renders (catches the error-code → user-copy wiring in the router context).

**Verification:**

- Manual: sign up, click Resend, verify a second email appears in Mailpit; either email's link OR either email's most-recent OTP completes verification
- Manual: rapid-fire Resend → rate-limit message
- All test commands green

---

### Commit 5 — Friendly handling of unconfirmed-email sign-in

**Goal:** If a user signs up but never confirms, then later tries to sign in, they see the same `<CheckEmailNotice>` (with OTP entry + Resend) instead of a generic auth error.

**Wiring:**

- `web/src/components/auth/SignInForm/SignInForm.tsx` — after `signIn()` throws, inspect the error: if it's Supabase's `email_not_confirmed` (check `error.code === 'email_not_confirmed'` — verified against `auth-js/src/lib/error-codes.ts`; `AuthApiError` has a string `code` property per `auth-js/src/lib/errors.ts`), set local `pending` state and render `<CheckEmailNotice email={email} onVerified={handleVerified} onResend={() => auth.resendConfirmation(email, { redirect })} />` _in place of the existing `<Card>`_ (the outer page wrapper stays, same shape as commit 3's `SignUpForm` wiring), where `redirect` is the current route's `redirect` search param (same source as today's signin redirect handling at `SignInForm.tsx:33-37`). `handleVerified` here navigates to redirect-or-`/leagues`. For any other error, fall through to the existing `<InlineError>` at `SignInForm.tsx:39-43`. The Resend's `redirect` override means the resent email's magic link will encode the signin-time destination rather than the (potentially different) signup-time one.

**Tests:**

- `SignInForm.test.tsx`:
  - Mocked `signIn` rejects with `email_not_confirmed` → `<CheckEmailNotice>` rendered, no navigation
  - Mocked `signIn` rejects with any other error → existing `<InlineError>` behavior preserved
  - On `<CheckEmailNotice>` `onVerified`, navigation runs with signin destination logic
  - Resend from this context passes the signin-time `redirect` param to `resendConfirmation`
- `web/src/tests/integration/signin-unconfirmed.integration.test.tsx` — frontend integration (real router over inline route-tree mirror; mock only the Supabase SDK):
  - Mount at `/sign-in?redirect=/leagues/123`, mock `supabase.auth.signInWithPassword` to reject with `{ code: 'email_not_confirmed' }`, submit the form, assert `<CheckEmailNotice>` renders (proves the error-code → pending-state wiring in the real router context).
  - Continue the same flow: mock `supabase.auth.verifyOtp` to resolve successfully, type 6 digits into the OTP input, assert navigation lands at `/leagues/123` (proves the signin-time `redirect` param threads through `handleVerified` rather than falling back to `/leagues`).

**Verification:**

- Manual: sign up, do NOT click the email link / enter the OTP, navigate to `/sign-in`, attempt sign-in with the unconfirmed credentials, verify pending UI appears with working OTP entry + Resend
- All test commands green

---

### Commit 6 — E2E coverage for magic-link and OTP signup paths

**Goal:** Cross-system assertion that the wired-up flow from commit 3 actually works end-to-end through a real browser, against the local Supabase + Mailpit stack.

**New fixture** (`e2e/fixtures/mailpit.ts`):

- Helper functions: `searchByRecipient(email)`, `getMessage(id)`, `clearAll()`. Thin HTTP wrappers, single-shot — no internal retry/polling. Targets `http://127.0.0.1:54424` (e2e Mailpit).
- **Waiting for an email to arrive:** callsites wrap `searchByRecipient` in `expect.poll(...).toHaveProperty('count', 1)` (Playwright's built-in polling assertion). Polling lives in test code, not the fixture, so waits are visible at the callsite, integrate with Playwright's timeout reporting, and individual tests can vary the expected count (e.g., `2` for a resend test). No `sleep`-based waits anywhere.
- **Note on naming:** Supabase CLI replaced Inbucket with Mailpit but kept the `[inbucket]` config block and the container name `supabase_inbucket_*` for backward compatibility. The actual image is `public.ecr.aws/supabase/mailpit` (verified via `docker inspect`), and the API surface is Mailpit's, not Inbucket's.
- **Search by recipient:** `GET /api/v1/search?query=to:<urlencoded email>` — returns newest-first. Verified shape:
  ```json
  {
    "total": 15,
    "count": 1,
    "messages_count": 1,
    "messages": [
      {
        "ID": "Vqp696v5jB9384dNn4y8Pr",
        "From": { "Name": "Admin", "Address": "admin@email.com" },
        "To": [{ "Name": "", "Address": "bob2@test.com" }],
        "Subject": "Confirm your F1 Fantasy email",
        "Created": "2026-05-10T04:29:00.864Z",
        "Snippet": "Confirm your email Welcome to F1 Fantasy!..."
      }
    ]
  }
  ```
- **Fetch message body:** `GET /api/v1/message/{ID}` — note singular `message`. Returns `{ ID, Text, HTML, ... }`. The `Text` body of a Supabase signup email contains both the magic link and the OTP. Verified excerpt:

  ```
  Confirm your email ( http://127.0.0.1:54421/auth/v1/verify?token=pkce_49af69736d98ab8581cfb35402e76a84b69db32b81ec70fd4f78af8b&type=signup&redirect_to=http://localhost:5273/auth/callback )

  Or enter this code in the app: *765877*
  ```

  The verify URL is _Supabase's_ endpoint (port 54421 in e2e); hitting it 302s to the app callback (`http://localhost:5273/auth/callback?code=...`) which `<AuthCallback>` then exchanges for a session. The OTP is wrapped in `*…*` (markdown bold).

- **Per-test isolation:** `DELETE /api/v1/messages` (no body) clears all mailboxes — call from a per-test `beforeEach` so prior tests' emails don't bleed in.
- **Port arithmetic:** 54424 = Mailpit dev port 54324 (`api/supabase/config.toml:96`, under the still-named `[inbucket]` block) + 100 per the e2e port-shift rule.

**New e2e tests** (`e2e/tests/auth.spec.ts`):

- **OTP-input selector note:** the `<OtpInput>` from commit 2 renders 6 visible slot `<div>`s overlaying a single real `<input autocomplete="one-time-code">`. Tests type the 6-digit code into the underlying input (queryable via its `aria-label`), not into individual slots — the slot `<div>`s are `aria-hidden`. This is the only commit-6-specific selector callout; everything else follows the project-wide semantic-selector discipline from `e2e/README`.
- **Magic-link path:** fill signup form via UI → assert `<CheckEmailNotice>` appears → `expect.poll(() => mailpit.searchByRecipient(email)).toHaveProperty('count', 1)` → GET the message → regex `Text` for the verify URL → `page.goto(verifyUrl)` → assert the app shows `/create-team`.
- **OTP path:** fill signup form → assert `<CheckEmailNotice>` appears → poll Mailpit for the message → GET it → regex `Text` for `/Or enter this code in the app: \*(\d{6})\*/` → type the 6 digits into the OTP input (the single underlying `<input>`, per the selector note above) → assert the app shows `/create-team`.

**Verification:**

- `npm run e2e` green (existing suite + the two new tests)

---

## Critical files

**Modified:**

- `web/src/lib/supabase.ts` (commit 1 — add `flowType: 'pkce'`)
- `web/src/router.tsx` (commit 1 — add `/auth/callback` route with loader, pendingComponent, and inline errorComponent)
- `api/supabase/config.toml` (commit 3)
- `e2e/supabase/config.toml` (commit 3)
- `web/src/contexts/AuthContext.tsx` (commits 3, 4)
- `web/src/contexts/AuthContext.ts` (commit 4)
- `web/src/components/auth/SignUpForm/SignUpForm.tsx` (commit 3, minor in commit 4)
- `web/src/components/auth/SignInForm/SignInForm.tsx` (commit 5)

**New:**

- `web/src/lib/auth-destination.ts` + `auth-destination.test.ts` (commit 1)
- `web/src/tests/integration/auth-callback.integration.test.tsx` (commit 1)
- `web/src/components/OtpInput/OtpInput.tsx` + `OtpInput.test.tsx` (commit 2) — custom OTP input primitive; lives at the top level of `components/` alongside other custom primitives (`LoadingButton`, `InlineError`, etc.), not in `ui/` (reserved for vendored shadcn)
- `web/src/components/auth/CheckEmailNotice/CheckEmailNotice.tsx` + `.test.tsx` (commit 2; expanded in commit 4)
- `api/supabase/templates/confirmation.html` (commit 3; includes both link and OTP from the start)
- `web/src/tests/integration/signup-resend.integration.test.tsx` (commit 4)
- `web/src/tests/integration/signin-unconfirmed.integration.test.tsx` (commit 5)
- `e2e/fixtures/mailpit.ts` (commit 6)
- New tests in `e2e/tests/auth.spec.ts` (commit 6)

**Reused (existing components, no changes):**

- `web/src/components/InlineError/InlineError.tsx` — error display in the auth-callback `errorComponent`, `<CheckEmailNotice>`, existing forms
- `web/src/components/LiveRegion/LiveRegion.tsx` — screen-reader announcements
- `web/src/components/LoadingButton/LoadingButton.tsx` — Verify and Resend button loading states
- `web/src/hooks/useAuth.ts` — auth hook (gains `resendConfirmation` in commit 4)

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
- Non-HTTP errors thrown from route loaders and `beforeLoad` guards are silently rendered to the user via `errorComponent` and never reach Sentry — `apiClient` only captures HTTP failures, and React's error-boundary path doesn't see errors caught at the route layer. The auth-callback loader works around this with manual `Sentry.captureException`, but the broader codebase-wide gap (parsing errors, schema mismatches, third-party SDK errors, runtime bugs across every data-loading route) is tracked separately in #180.
