# 345: Password policy, field hint, and reveal toggle

Implements [#345](https://github.com/emsqrd/f1fantasyapp/issues/345) per [ADR 011](../adr/011-length-only-password-policy.md) (length-only policy: min 8, max 72, no character classes, no breach screening). Interactive prototype of the target behavior: [sign-up error model artifact](https://claude.ai/code/artifact/2d3efb7a-2c17-41db-b5a1-3b4d0aa8768c).

All dependencies are already installed: `react-hook-form`, `zod` (v4), `@hookform/resolvers`.

## Behavior contract

- Validation runs on submit; after the first submit, every change re-validates (React Hook Form defaults: `mode: 'onSubmit'`, `reValidateMode: 'onChange'`, `shouldFocusError` focuses the first invalid field). No explicit mode config needed.
- Errors are inline per field, all at once, additive to the hint. The password hint is always visible; an error renders below it. The form-level `InlineError` callout is reserved for server/submission failures only.
- Inline field errors self-announce via `role="alert"`; manual `announce()` calls remain only for server errors.
- Reveal toggles: per-field, independent, `type="button"`, `aria-pressed={visible}` with stable `aria-label="Show password"`, lucide `Eye`/`EyeOff`. Toggling never moves focus or submits.
- SignInForm never enforces the policy (accounts created under the 6-char default must sign in); it gets the toggle only.
- Max 72 is enforced as a validation error, never a `maxLength` attribute; the hint does not mention it.

### Copy table (single source of truth)

| Field        | Condition           | Message                                    |
| ------------ | ------------------- | ------------------------------------------ |
| Display name | empty (after trim)  | Enter a display name                       |
| Display name | over 50 chars       | Display name must be 50 characters or fewer |
| Email        | empty (after trim)  | Enter your email                           |
| Email        | malformed           | Enter a valid email address                |
| Password     | hint (always shown) | Password must be at least 8 characters     |
| Password     | empty               | Enter a password                           |
| Password     | 1–7 chars           | Password is too short                      |
| Password     | over 72 chars       | Password must be 72 characters or fewer    |
| Confirm      | empty               | Confirm your password                      |
| Confirm      | differs from password | Passwords do not match                   |

No trailing periods. Reset form reuses the password/confirm rows verbatim. Empty confirm shows "Confirm your password" only (the mismatch refinement does not stack on it). Trimmed display name and email are what get submitted.

## Commits

Each commit is a gate: implementation and tests together, independently passing build, lint, tests, and formatting. Wait for approval before starting the next.

### Commit 1 — FormField: resolvable error ids, hint and error coexist

`web/src/components/FormField/FormField.tsx`

- Fix the wiring bug: the error `<p>` currently carries `aria-describedby={`${id}-error`}` on itself; it must carry `id={`${id}-error`}` so the input's `aria-describedby` resolves.
- Hint/error coexistence: render `helpText` whether or not an error is present (today `helpText && !error` hides it). DOM order within a field: control, then hint, then error, so the hint never shifts when an error appears.
- The control's `aria-describedby` lists both ids when both render: `"{id}-help {id}-error"`. Apply consistently across `FormFieldInput`, `FormFieldTextarea`, and `FormFieldSwitch`.

Tests (`FormField.test.tsx`): `aria-describedby` tokens resolve to real elements; with both `helpText` and `error`, both render, both are referenced, and help precedes error in the DOM; error has `role="alert"`.

Note: existing FormField consumers that pass both `helpText` and `error` will now show both. That is the intended behavior change; eyeball those surfaces during manual verification.

### Commit 2 — PasswordInput with reveal toggle; wire into SignInForm

New `web/src/components/PasswordInput/PasswordInput.tsx`

- Wraps the vendored `Input` in a relative container with the toggle button positioned inside the right edge (input gets right padding to clear it).
- `type` flips between `password` and `text` from internal visibility state. Accepts and forwards standard input props (`ComponentProps<typeof Input>`), so both usages work unchanged: spread `{...register('password')}` (RHF forms) or `value`/`onChange` (SignInForm).
- Toggle: `type="button"`, `aria-pressed`, stable `aria-label="Show password"`, `Eye`/`EyeOff` from `lucide-react`.

`SignInForm.tsx`: swap the password `Input` for `PasswordInput`. No other changes — no hint, no validation, manual state stays.

Tests: new `PasswordInput.test.tsx` — starts as `type="password"`; activating the toggle flips to `text`, sets `aria-pressed="true"`, accessible name stays "Show password"; activating again reverts; keyboard (Enter/Space) works; toggling inside a `<form>` does not submit. `SignInForm.test.tsx` — one assertion that the toggle is present, plus anchor the five `getByLabelText(/password/i)` queries, which now also match the toggle's `aria-label` (use `'Password'` with `{ exact: true }` or scope to the input).

Selector fallout in e2e, same commit: `e2e/fixtures/session.ts` `signInAs` uses non-exact `getByLabel('Password')`, and "Password" substring-matches "Show password" — a strict-mode violation that breaks every spec that signs in. Switch it to `{ exact: true }` (`auth.spec.ts` already does this).

### Commit 3 — Password policy module + SignUpForm migration to RHF + zod

New `web/src/validations/passwordPolicy.ts` (alongside the existing form schemas)

- `PASSWORD_MIN_LENGTH = 8`, `PASSWORD_MAX_LENGTH = 72`, `PASSWORD_HINT` derived from the min via template literal, a `passwordSchema` (zod) encoding empty/too-short/too-long with the copy-table messages, and the confirm row ("Confirm your password" + mismatch refinement) for form schemas to compose. This is the single source both forms import; no other file states 8, 72, or the password copy.

New `web/src/validations/signUpFormSchema.ts` (matching the `userProfileFormSchema.ts` convention): display name and email rows plus the composed password/confirm rows.

New `FormFieldPassword` in `web/src/components/FormField/FormField.tsx` (first consumer is this commit): the FormField family variant composing `PasswordInput`, with the same `error`/`helpText`/`register` API as `FormFieldInput`.

`SignUpForm.tsx`

- Migrate to `useForm` + `zodResolver` with `signUpFormSchema`: display name (trim, min 1, max 50), email (trim, min 1, valid format via zod v4), and the shared password/confirm rows (mismatch refinement targets the confirm field).
- Fields render through `FormFieldInput` (display name, email) and `FormFieldPassword` (password with `helpText={PASSWORD_HINT}`, confirm without hint).
- Remove the manual validation block and its `announce()` calls; `isLoading` becomes `formState.isSubmitting`. Preserve untouched: `awaitingConfirmation`/`CheckEmailNotice`, `confirmationErrorMessage`, `emailRedirectTo`, `completeSignUp` navigation, and the server-error path (`InlineError` + `announce`).

Tests (`SignUpForm.test.tsx`, rewritten through the real schema with `userEvent` — no isolated schema tests):

- Submit empty: all four errors at once with copy-table text; hint still present alongside the password error.
- Each message reachable: 51-char name, malformed email, 7-char password, 73-char password, mismatched confirm, empty confirm. Drive the 73-char case with `userEvent`, not `fireEvent.change` — `fireEvent` bypasses `maxLength`, so only `userEvent` fails if the forbidden `maxLength` attribute sneaks in.
- Empty confirm with a filled password shows "Confirm your password" only; the mismatch message must not stack.
- Padded display name and email submit trimmed values; a whitespace-only display name shows "Enter a display name".
- Nothing fires while typing before first submit; after submit, fixing a field clears its error keystroke-by-keystroke.
- Server failure renders in the callout (not inline) and announces; no-session success shows `CheckEmailNotice`.
- `FormField.test.tsx`: mirror commit 1's `aria-describedby` wiring assertions for the new `FormFieldPassword` variant (hint id always, error id when invalid). That variant test is the smallest owner of the wiring, so the form-level tests don't re-assert describedby.

### Commit 4 — ResetPasswordForm migration

`ResetPasswordForm.tsx`

- Same migration: new `web/src/validations/resetPasswordFormSchema.ts` composes the same password/confirm rows from `passwordPolicy.ts`; fields render through `FormFieldPassword` with identical hint and copy. "Identical copy" means the hint and validation messages — the labels stay "New Password" / "Confirm Password", so existing label-based selectors in the integration test and `e2e/tests/password-reset.spec.ts` keep matching.
- The token machinery moves inside RHF's valid-submit handler unchanged: `recoveryToken` initializer, `hasSpentToken` ref, `otp_expired` → `tokenRejected` card, Sentry capture, retry-on-network-failure, navigate on success. RHF only invokes the handler after validation passes, which preserves the validation-before-token-spend ordering by construction.

Tests: update `web/src/tests/integration/password-reset.integration.test.tsx` — replace "at least 6" assertions with the new inline copy; keep the assertions that a validation failure does not spend the token and that a double-click spends it once; add one happy-path assertion that the password hint renders (a missing `helpText={PASSWORD_HINT}` here is invisible to the SignUpForm tests).

### Commit 5 — Raise the local Supabase minimum to 8

- `api/supabase/config.toml` and `e2e/supabase/config.toml`: `minimum_password_length = 6` → `8`. `password_requirements` stays `""`. No comments, no drift guards.
- E2e fixtures already comply: every fixture password is `'e2e-password'` (12 chars, in `e2e/fixtures/auth.ts` and `auth.spec.ts`) — verified, no changes needed.
- Local stacks pick the value up on next `supabase start`/restart.

## After the final commit

**Manual browser verification** (dev stack, per root CLAUDE.md): sign up a throwaway user — hint visible from first render, submit-empty shows all errors inline with focus on display name, keystroke revalidation, both toggles independent and keyboard-operable with focus staying put on activation, confirmation code lands in the mail catcher; run the reset flow end to end; sign-in toggle works in an isolated context. Spot-check existing FormField surfaces that pass `helpText` for the coexistence change.

**Prod rollout** (manual, after deploy): Supabase dashboard → Authentication → min password length 8, no required characters — mirrors ADR 011. Existing users are unaffected (set-time enforcement); ignore the dashboard's weak-password sign-in notices for legacy 6-char accounts.
