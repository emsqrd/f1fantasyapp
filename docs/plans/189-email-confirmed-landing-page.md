# Plan — Issue #189: Dedicated email-confirmed landing page

## Status as of 2026-05-19 (token-hash redesign)

Commit 1 (`_unauthenticated` layout, `df129c6`) is shipped and unchanged. This document supersedes the earlier draft of Commits 2 and 3 — the previous design intercepted Supabase's implicit-grant URL fragment via a `detectSessionInUrl` hook + `window.__f1ImplicitGrantOnLoad` arrival flag; the revised design uses Supabase's documented token-hash flow (`verifyOtp({ token_hash, type })`) and owns the verification step inside a route loader.

**Discard prior WIP before starting:**

```bash
git restore web/
rm -rf web/src/components/auth/ConfirmedNotice
rm web/src/tests/integration/auth-confirmed.integration.test.tsx
```

The branch returns to `df129c6`. Then implement Commits 2 and 3 in order.

## Context

Today, the signup magic link expands `{{ .ConfirmationURL }}` to Supabase's server-side verifier (`https://<project>.supabase.co/auth/v1/verify?token=<hash>&type=signup&redirect_to=...`). GoTrue verifies server-side, mints a session, and 302s back to the SPA with `#access_token=...` in the URL fragment. `supabase-js`'s `_initialize()` parses the hash, establishes the session, fires `SIGNED_IN`. The user lands on whatever `redirect_to` resolves to (`/`, `/join/<token>`, etc.) with no acknowledgment that the email was just confirmed.

The new flow swaps where verification happens:

- The signup email template is rewritten to point the link at our own `/auth/confirm` route, embedding the `{{ .TokenHash }}` directly: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next={{ .RedirectTo }}`.
- `/auth/confirm`'s `beforeLoad` reads `token_hash` + `type` from search and calls `supabase.auth.verifyOtp({ token_hash, type })`. Success → renders `<ConfirmedNotice>`. Error → redirects to `/sign-up` with an error code in search. Missing params → redirects to `/sign-up` (signed-out) or `defaultAuthedDestination` (signed-in).
- The user clicks "Continue" to leave the page; navigation target comes from `search.next` (the value Supabase populated from `emailRedirectTo`), parsed and validated against the same origin, with `defaultAuthedDestination(teamContext)` as fallback.
- `SignUpForm` no longer threads the landing page through `emailRedirectTo`. The template owns the landing page literal; `emailRedirectTo` becomes the **final destination** (e.g., `/leagues/123` or `/join/<token>`) — the meaning its name has always implied.

### Why this is defensible against the prior PKCE revert

The branch's history at `93fa04a` reverted a PKCE attempt (`23ca5ec`) for two documented reasons captured in the prior plan rework:

> The PKCE flow's `signUp` writes `code_challenge` (`GoTrueClient.ts:899-924`) but `resend` does not (`2535-2574`), which broke the resend path; implicit sidesteps the asymmetry.

PKCE additionally fails cross-device because `code_verifier` lives in the signup-time browser's `localStorage` — Browser B opening the email link has no verifier and `exchangeCodeForSession` fails.

**`verifyOtp({ token_hash })` is not PKCE.** Verified at `web/node_modules/@supabase/auth-js/src/lib/types.ts:853-859`:

```typescript
export interface VerifyTokenHashParams {
  token_hash: string
  type: EmailOtpType
}
```

No `code_verifier`, no client-stored counterpart, no `flowType: 'pkce'` config. The hash itself is the secret — the same hash GoTrue already embeds in `{{ .ConfirmationURL }}` today, just verified by our client code instead of Supabase's `/auth/v1/verify` endpoint. The `resend` asymmetry doesn't apply because `verifyOtp` has no client state to keep in sync; cross-device works because Browser B needs nothing from Browser A's storage to call `verifyOtp`.

### Scope

Bounded by issue #189's acceptance criteria. Out of scope: the in-app OTP-code path (`<CheckEmailNotice>` → `onVerified()`), the sign-in flow, backend changes beyond the signup email template, and any other Supabase email template (recovery, magic-link, invite, email-change).

---

## Implementation — 2 commits

Each commit independently passes `npm run web:build`, `npm run web:lint`, `npm run web:format:check`, `npm run web:test`. Commit 3 additionally requires `npm run e2e` (with the e2e Supabase stack up) to remain green.

---

### Commit 2 — Add `/auth/confirm` route that calls `verifyOtp` (additive, fully tested)

**Why this lands first:** the new route can ship behind no production callers. The email template still points at `{{ .ConfirmationURL }}` after this commit, so no real user flow exercises `/auth/confirm` — but the route is fully wired, type-safe, and tested with mocked `verifyOtp`. Build/test green in isolation. Commit 3 flips the template and the switchover happens atomically there.

**Files added:**

- `web/src/components/auth/ConfirmedNotice/ConfirmedNotice.tsx` — Card with heading "Email confirmed", description ("You're all set. Click continue to head into F1 Fantasy."), and a single primary `<Button>` labeled "Continue". On click, calls `useNavigate()` to:
  - `resolveNextDestination(search.next)` if it returns a same-origin internal path, OR
  - `defaultAuthedDestination(teamContext)` otherwise (read via `useRouteContext({ from: '/auth/confirm' })`).

  No `useEffect`-driven navigation, no timer — the click is the acknowledgment (AC 9). The heading text "Email confirmed" is the e2e selector target (`getByRole('heading', { name: /email confirmed/i })`); keep them in sync.

  `resolveNextDestination` lives co-located in this file (or `@/lib/router-context.ts` if needed elsewhere — currently it isn't):

  ```typescript
  function resolveNextDestination(next: string | undefined): string | null {
    if (!next) return null;
    try {
      const url = new URL(next, window.location.origin);
      if (url.origin !== window.location.origin) return null;
      return url.pathname + url.search;
    } catch {
      return null;
    }
  }
  ```

  Cross-origin or unparseable `next` values fall back to `defaultAuthedDestination`. This is defense-in-depth; Supabase already validates `emailRedirectTo` against `additional_redirect_urls` server-side before embedding `{{ .RedirectTo }}`, but the parser also rules out tampered email links.

- `web/src/tests/integration/auth-confirm.integration.test.tsx` — integration coverage for the route. Builds a per-test route tree with `createRootRouteWithContext<RouterContext>()`, mirrors the production `authConfirmRoute` inline (its `beforeLoad`, `validateSearch`, `component`), and includes stub routes for `/sign-up`, `/leagues`, `/create-team`, `/join/$token` so redirect targets are assertable via `findByRole('heading', { name })`. Uses `buildStubRoute` from `web/src/tests/test-utils/routeTreeBuilders.tsx`.

  **Mock seam.** Per `web/CLAUDE.md`, don't mock own-code modules in the integration layer. Mock only the third-party seam: `vi.mock('@/lib/supabase', () => ({ supabase: { auth: { verifyOtp: vi.fn() } } }))` — same pattern `signup-resend.integration.test.tsx:12` uses for `supabase.auth.resend`. The real route logic runs against that mock.

  Test cases:

  1. **Valid token, no-team user** — `verifyOtp` resolves `{ error: null }`, auth = `createAuthedAuth()`, `teamContext.hasTeam = false`. Asserts "Email confirmed" + a single "Continue" button. Click Continue → `/create-team` stub.
  2. **Valid token, has-team user** — same setup but `teamContext.hasTeam = true`. Continue → `/leagues` stub.
  3. **Valid token + `next=http://localhost:5173/join/abc`** — Continue → `/join/abc` stub (overrides team-state decision).
  4. **`verifyOtp` errors with `otp_expired`** — resolves `{ error: { code: 'otp_expired', ... } }`. Asserts redirect to `/sign-up?confirmationError=expired` stub.
  5. **`verifyOtp` errors generically** — resolves `{ error: { code: 'some_other', ... } }`. Asserts redirect to `/sign-up?confirmationError=generic` stub.
  6. **Missing `token_hash`, signed-out** — `initialEntry: '/auth/confirm'`, `auth = createUnauthAuth()`. Asserts redirect to `/sign-up` stub.
  7. **Missing `token_hash`, signed-in (no team)** — same but `auth = createAuthedAuth()`, `hasTeam = false`. Asserts redirect to `/create-team` stub.
  8. **Missing `token_hash`, signed-in (has team)** — `hasTeam = true`. Asserts redirect to `/leagues` stub.
  9. **Cross-origin `next` value** — `next=https://evil.example.com/foo`, otherwise valid token. Asserts ConfirmedNotice renders, but Continue navigates to `defaultAuthedDestination` (not the cross-origin URL).
  10. **No auto-redirect on success** — extends case 1: without clicking Continue, page stays on `/auth/confirm` across a `waitFor` window. Covers AC 9 directly.

  No MSW handlers needed — this route makes no API calls (the mock substitutes the only Supabase call).

**Files modified:**

- `web/src/router.tsx` — add `authConfirmRoute` as a peer of `unauthenticatedLayoutRoute` (NOT under it — a successful verification creates a session, and the layout would redirect signed-in users away from the very page they're meant to see). Imports `defaultAuthedDestination` from `@/lib/router-context` (already added in Commit 1).

  ```typescript
  const authConfirmSearchSchema = z.object({
    token_hash: z.string().optional(),
    type: z
      .enum(['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'])
      .optional(),
    next: z.string().optional().catch(undefined),
  });

  const authConfirmRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/auth/confirm',
    validateSearch: authConfirmSearchSchema,
    component: ConfirmedNotice,
    beforeLoad: async ({ context, search }) => {
      if (!search.token_hash || !search.type) {
        if (context.auth.user) {
          throw redirect({
            to: defaultAuthedDestination(context.teamContext),
            replace: true,
          });
        }
        throw redirect({ to: '/sign-up', replace: true });
      }
      const { error } = await supabase.auth.verifyOtp({
        token_hash: search.token_hash,
        type: search.type,
      });
      if (error) {
        const confirmationError = error.code === 'otp_expired' ? 'expired' : 'generic';
        throw redirect({
          to: '/sign-up',
          search: { confirmationError },
          replace: true,
        });
      }
    },
    errorComponent: ({ error }) => <ErrorComponent error={error} />,
  });
  ```

  Register in the route tree alongside `joinInviteRoute`:

  ```typescript
  const routeTree = rootRoute.addChildren([
    unauthenticatedLayoutRoute.addChildren([indexRoute, signInRoute, signUpRoute]),
    authConfirmRoute,
    joinInviteRoute,
    // ... rest unchanged
  ]);
  ```

  No other production wiring changes in this commit. `signUpRoute.validateSearch`, `signUpRoute.beforeLoad`, `indexRoute.beforeLoad`, `SignUpForm.tsx`, and `supabase.ts` all stay as-is for now — Commit 3 owns those.

**New tests:** the integration test above. No unit tests for the inline `resolveNextDestination` — the integration cases (1, 3, 9) cover its three branches end-to-end.

**Build/test commands:** `npm run web:lint && npm run web:format:check && npm run web:test && npm run web:build`.

---

### Commit 3 — Flip the email template, delete the implicit-flow scaffolding

**What ships:** the production switchover. The signup email link points at `/auth/confirm` instead of Supabase's verifier; the `detectSessionInUrl` hook and arrival-flag infrastructure go away; the implicit-flow error-recovery path on `/` and `/sign-up` is deleted; `SignUpForm` is updated to pass the final destination as `emailRedirectTo`; e2e tests step through the new page.

**Backend / config:**

- `api/supabase/templates/confirmation.html:172` — change `href`:

  ```html
  <!-- type MUST match [auth.email.template.confirmation] in api/supabase/config.toml -->
  <a
    href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next={{ .RedirectTo }}"
    class="btn"
    style="..."
  >
    Confirm your email
  </a>
  ```

  The HTML comment earns its place: `type=signup` is a literal that must match the `[auth.email.template.X]` section name, and that constraint isn't visible from the URL itself. Without the comment, a reader copying the template (or refactoring it) has no signal that the literal is load-bearing.

- `e2e/supabase/templates/confirmation.html` — apply the same change if the e2e stack has its own copy. If it symlinks `api/supabase/templates/confirmation.html` (check `ls -la e2e/supabase/templates/`), no change needed.

- **Production Supabase dashboard** — the email template lives in the project's Auth settings UI as well as the local config. Flag in the PR description as a manual deploy step. Out of repo's automation scope.

**Frontend cleanup (delete obsolete code):**

- `web/src/lib/supabase.ts` — drop the `detectSessionInUrl` callback and the `Window` declaration. Set `detectSessionInUrl: false` explicitly so the SDK never tries to parse URL fragments (no URL in the new flow produces one):

  ```typescript
  export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { detectSessionInUrl: false },
  });
  ```

- `web/src/lib/supabase.test.ts` — delete the `detectSessionInUrl` callback test (the case that mocks `window.__f1ImplicitGrantOnLoad` doesn't apply anymore). Update the `createClient` args assertion:

  ```typescript
  expect(createClient).toHaveBeenCalledWith(
    'https://myproject.supabase.co',
    'my-anon-key',
    { auth: { detectSessionInUrl: false } },
  );
  ```

- `web/src/lib/auth-redirect.ts` — **delete the file entirely.** Both `readConfirmationLinkError` and `hadConfirmationGrantOnLoad` are dead. Verify no remaining importers via `rg "from '@/lib/auth-redirect'"`.

- `web/src/router.tsx`:
  - Remove the `import { hadConfirmationGrantOnLoad, readConfirmationLinkError } from '@/lib/auth-redirect'` line.
  - Drop `indexRoute.beforeLoad` entirely. The remaining body was a `readConfirmationLinkError` check that's now unreachable (no email link redirects to `/`). The `unauthenticatedLayoutRoute` parent already handles signed-in redirect.
  - Drop `signUpRoute.beforeLoad` entirely. Extend `signUpRoute.validateSearch` to surface the confirmation error as a search param:

    ```typescript
    const signUpSearchSchema = redirectSearchSchema.extend({
      confirmationError: z.enum(['expired', 'generic']).optional().catch(undefined),
    });
    ```

    (Define `signUpSearchSchema` locally or extend `redirectSearchSchema`.)

- `web/src/components/auth/SignUpForm/SignUpForm.tsx`:
  - **`emailRedirectTo` becomes the final destination** (the value `{{ .RedirectTo }}` in the email template will interpolate into the `next=` query param):

    ```typescript
    const emailRedirectTo = `${window.location.origin}${search.redirect ?? '/'}`;
    ```

    The landing page (`/auth/confirm`) is no longer constructed here — the email template owns that literal.
  - **Source of `confirmationError` moves from `useRouteContext` to `useSearch`** (it's a search param now, not a `beforeLoad` return value):

    ```typescript
    const search = useSearch({ from: '/_unauthenticated/sign-up' });
    const { confirmationError } = search;
    ```

    Drop the `useRouteContext` import if unused.
  - The `resendConfirmation` call (line 112) still passes `{ emailRedirectTo }`; no shape change, just the value now means "final destination" instead of "landing page."

- `web/src/components/auth/SignUpForm/SignUpForm.test.tsx` — update the `confirmationError` test setup: instead of injecting via route context, set the search param on the router entry. Update the `emailRedirectTo` assertions in the existing tests to match the new value.

**Test fixture changes:**

- `web/src/tests/integration/signup-resend.integration.test.tsx`:
  1. **Register `/auth/confirm` stub** so any test that indirectly traverses through the new route doesn't break. Use `buildStubRoute(rootRoute, { path: '/auth/confirm', heading: 'Auth Confirm Stub' })` and include in `rootRoute.addChildren([...])`. Optional — only needed if a test navigates there.
  2. **Update the `emailRedirectTo` assertion** at line 81 (and any sibling) to:

     ```typescript
     options: {
       emailRedirectTo: `${window.location.origin}/leagues/123`,
     }
     ```

     The value is now the final destination, not `/auth/confirmed?redirect=...`.

**E2E (`e2e/tests/auth.spec.ts`):**

- Lines 64, 129, 175 — three regex matches against `/auth/v1/verify` swap to `/auth/confirm`:

  ```typescript
  const linkMatch = message.HTML.match(/href="([^"]*\/auth\/confirm[^"]*)"/);
  ```

- Lines 69, 134 (single-browser flows) — after `page.goto(confirmationUrl)`:

  ```typescript
  await expect(page).toHaveURL(/\/auth\/confirm/);
  await expect(page.getByRole('heading', { name: /email confirmed/i })).toBeVisible();
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page).toHaveURL('/create-team');
  ```

- Lines 137-188 (cross-browser flow) — update the URL assertion at line 185:

  ```typescript
  await expect(pageB).toHaveURL(/\/auth\/confirm/);
  await pageB.getByRole('button', { name: /continue/i }).click();
  await expect(pageB).toHaveURL(new RegExp(`/join/${invite.token}$`));
  await expect(pageB.getByText(leagueName)).toBeVisible();
  ```

  Update the stale comment at lines 157-158 — the test no longer proves "the implicit flow's auto-detect works on fragment alone." It now proves that `verifyOtp({ token_hash })` works on Browser B with zero prior storage state because the token hash is the sole proof of identity (no `code_verifier` lookup, no fragment parsing). Rewrite to reflect the load-bearing property the test actually demonstrates now.

- **NEW test: "expired magic link lands on /sign-up with the inline error"** — covers AC 3 through the new redirect chain. Pattern: sign up, extract the magic link from Mailpit, mutate the `token_hash` query parameter to a known-invalid value, `page.goto(brokenUrl)`. Assert `toHaveURL(/\/sign-up\?confirmationError=/)` and that the page shows the existing "couldn't confirm" inline error (message strings live in `SignUpForm.tsx:15-18` — assert via `getByRole('alert')` matching the visible text).

**Build/test commands:**

```bash
npm run web:lint && npm run web:format:check && npm run web:test && npm run web:build
# E2E requires `cd e2e/supabase && supabase start` first:
npm run e2e
```

---

## Verification (end-to-end, after both commits)

1. **Manual smoke (dev stack):** `npm run web:dev` + `npm run api:watch`. In the browser:
   - Sign up with a new email → land on Check Your Email screen. Open Mailpit (`http://localhost:54324`), grab the magic link, paste in a fresh incognito window. Expect: `/auth/confirm` → ConfirmedNotice visible. Click Continue → `/create-team`. (AC 1, 2)
   - Sign up at `/sign-up?redirect=/join/<some-valid-token>`. Confirm via incognito link. Expect: `/auth/confirm?...&next=http://localhost:5173/join/<token>`, click Continue → `/join/<token>`. (AC 8)
   - Resend from the Check Your Email screen, confirm via the *resent* link. Same `/auth/confirm` landing. (AC 6)
   - Visit `/auth/confirm` directly (no `token_hash`) while signed out → immediate redirect to `/sign-up`. (AC 4)
   - Sign in with an existing account, then visit `/auth/confirm` directly → immediate redirect to `/leagues` or `/create-team`. (AC 5)
   - Mangle a magic-link `token_hash` in Mailpit and visit it → `/sign-up?confirmationError=...` with the existing inline error. (AC 3)
   - Type a 6-digit OTP from the email into the Check Your Email screen instead of clicking the link → still navigates straight into the app, never touching `/auth/confirm`. (AC 7)

2. **Automated:**
   - `npm run web:test` — full frontend suite, including the new `auth-confirm.integration.test.tsx` and the updated `signup-resend.integration.test.tsx`.
   - `npm run test:all` — frontend + backend.
   - `cd e2e/supabase && supabase start` then `npm run e2e` — full Playwright suite, with the three updated `auth.spec.ts` tests covering AC 1, 2, 6, 8 and the new expired-link test covering AC 3 through the real stack.

---

## Notes for implementation

- **Supabase redirect allowlist:** dev/e2e are covered by the existing `http://localhost:5173/**` wildcard in `api/supabase/config.toml:126`; no config change. Production may need verification — `site_url` and `additional_redirect_urls` in the dashboard must allow the new link target. Flag in PR description.
- **Commit message style:** conventional commits per CLAUDE.md (`feat:`, `refactor:`). PR title NOT conventional-commit-styled per user preference. No `Co-Authored-By` footer.
- **Comments:** the one inline HTML comment in `confirmation.html` (calling out that `type=signup` must match the template section name) is the only comment that earns its place — `type=signup` is a literal cross-file constraint that isn't visible from the URL alone. Everything else (route structure, component shape, redirect decisions) is self-evident from the code.
- **No new contracts, services, or third-party deps** are introduced. `verifyOtp` is part of the existing `@supabase/supabase-js` dependency (`web/node_modules/@supabase/auth-js/src/lib/types.ts:853-859`). `defaultAuthedDestination` was added in Commit 1.
- **Why not under `_unauthenticated`:** the layout's invariant is "signed-in users get redirected away." But the success case for `/auth/confirm` is precisely "signed-in user just confirmed — render the acknowledgment for them to click through." Putting it under the layout would redirect away every successful confirmation. So `authConfirmRoute` keeps its own `beforeLoad` with the subtler logic and lives as a peer route.
- **`type` literal discipline:** each future email template (recovery, magic-link, etc.) will need its own `type=` literal in the URL that matches the `[auth.email.template.X]` section name. The HTML comment in `confirmation.html` establishes the pattern for any future templates to follow. This plan does not introduce those templates — they belong in their own issues.
