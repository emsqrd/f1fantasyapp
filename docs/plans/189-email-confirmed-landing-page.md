# Plan — Issue #189: Dedicated email-confirmed landing page

## Context

When a user clicks the signup magic link today, Supabase's `/verify` 302s to `${origin}${emailRedirectTo}`, and the SDK's `initialize()` consumes `#access_token=...` from the hash before our routes mount. Because `SignUpForm` sets `emailRedirectTo = ${origin}${search.redirect ?? '/'}`, the user lands either:

- on `/`, where `indexRoute.beforeLoad` immediately redirects them to `/leagues` or `/create-team` (`web/src/router.tsx:181-191`), or
- on `/join/<token>` mid-invite-preview.

Either way there is **no acknowledgment** that the email was confirmed. Confirmation is a security-relevant event, and the user often arrives in a fresh tab on a different device — they need an anchor that says "this just happened, here's where you're going next."

The fix is a dedicated `/auth/confirmed` route that owns three states (success / error-redirect / defensive-redirect) and requires an explicit click to leave. `SignUpForm` is updated to point `emailRedirectTo` at this new route, and `indexRoute`'s `readConfirmationLinkError()` branch becomes dead and is removed.

**A precursor refactor lands first.** While planning, the duplication of `context.teamContext.hasTeam ? '/leagues' : '/create-team'` across `indexRoute`, `signInRoute`, `signUpRoute` (and the soon-to-be-added `authConfirmedRoute` + its component) surfaced as a symptom of a missing route-layout pattern. The codebase already has `_authenticated`, `_team-required`, `_no-team` pathless layouts that gate access — but no symmetric `_unauthenticated` layout for entry routes that should redirect signed-in users away. Adding that layout deduplicates the existing 3 sites at the architectural level, not via a calling-site helper that just hides the smell. The layout pattern is established by Commit 1; the new `/auth/confirmed` work follows in Commits 2–3.

Scope is bounded by the issue's acceptance criteria. The in-app OTP-code path (`<CheckEmailNotice>` → `onVerified()`), the sign-in flow, email template content, and backend changes are all out of scope.

---

## Implementation — 3 commits

Each commit independently passes `npm run web:build`, `npm run web:lint`, `npm run web:format:check`, `npm run web:test`. Commit 3 additionally requires `npm run api:test` and `npm run e2e` (with the e2e Supabase stack up) to remain green.

---

### Commit 1 — Introduce `_unauthenticated` layout route (refactor, no behavior change)

**Why this lands first:** the layout deduplicates the existing redirect-if-authed pattern *before* #189 adds a 4th and 5th site. Shipping the refactor as a focused precursor means the #189 commits stay scoped to the new feature, and the diff for each commit reads cleanly.

**What ships:** a new `_unauthenticated` pathless layout route (mirrors `_authenticated`, `_no-team` conventions) that runs the "if signed-in, redirect to leagues/create-team" check once in its `beforeLoad`. `indexRoute`, `signInRoute`, `signUpRoute` move under it. Their own `beforeLoad`s shrink: indexRoute's vanishes entirely (the `readConfirmationLinkError` branch is still removed in Commit 3, where its dead-code status becomes provable); signInRoute's vanishes entirely; signUpRoute's keeps only the `return { confirmationError: ... }` line.

**Files modified:**

- `web/src/router.tsx`:
  - Add `unauthenticatedLayoutRoute`:
    ```typescript
    const unauthenticatedLayoutRoute = createRoute({
      getParentRoute: () => rootRoute,
      id: '_unauthenticated',
      beforeLoad: ({ context }) => {
        if (context.auth.user) {
          if (context.teamContext.hasTeam) {
            throw redirect({ to: '/leagues', replace: true });
          }
          throw redirect({ to: '/create-team', replace: true });
        }
      },
      component: () => <Outlet />,
    });
    ```
  - Remove the `if (context.auth.user) { throw redirect(...) }` block from `indexRoute.beforeLoad` (lines 185-190), `signInRoute.beforeLoad` (lines 207-212), and `signUpRoute.beforeLoad` (lines 229-233). `indexRoute.beforeLoad` keeps its `readConfirmationLinkError` check (removed in Commit 3); `signUpRoute.beforeLoad` keeps `return { confirmationError: ... }`; `signInRoute.beforeLoad` becomes empty and is removed entirely.
  - Update the route tree (lines 721-737): wrap the three routes under `unauthenticatedLayoutRoute.addChildren([indexRoute, signInRoute, signUpRoute])`.

- `web/src/tests/test-utils/routeTreeBuilders.tsx` — add a sibling helper to the existing `buildAuthenticatedLayout` / `buildTeamRequiredLayout` / `buildNoTeamLayout`:
  ```typescript
  export function buildUnauthenticatedLayout(rootRoute: AnyRoute) {
    return createRoute({
      getParentRoute: () => rootRoute,
      id: '_unauthenticated',
      beforeLoad: ({ context }: { context: RouterContext }) => {
        if (context.auth.user) {
          if (context.teamContext.hasTeam) {
            throw redirect({ to: '/leagues', replace: true });
          }
          throw redirect({ to: '/create-team', replace: true });
        }
      },
      component: () => <Outlet />,
    });
  }
  ```
  Keeps a single source of truth so a future change to the redirect rule touches one file, not every integration test (this is exactly the convention the file's header comment establishes).

- `web/src/tests/integration/signup-resend.integration.test.tsx` — currently mirrors `signUpRoute` directly under root (line 29-43). Wrap it under `buildUnauthenticatedLayout(rootRoute)` so it exercises the real layout's redirect-if-authed pipeline. Other integration tests that build sign-up / sign-in / index trees get the same treatment if any exist (check via `grep -l "signUpRoute\|signInRoute\|indexRoute" web/src/tests/integration/`).

**New tests:** none required — this is a pure refactor with no behavioral change. The existing `route-guards.integration.test.tsx` and `signup-resend.integration.test.tsx` cover the behavior that's being relocated; rerunning them against the layout-wrapped tree verifies the relocation. If grep surfaces a `root-routing.integration.test.tsx` or similar that pinned the inline-ternary behavior, update it to mount through the layout.

**Build/test commands:** `npm run web:lint && npm run web:format:check && npm run web:test && npm run web:build`.

---

### Commit 2 — Add `/auth/confirmed` route (dead code, fully tested)

**What ships:** a new public route, its component, a tiny helper that captures URL-hash state at module load, and a small `defaultAuthedDestination` helper for the two sites the layout can't cover (the route's defensive branch and the component's Continue handler). Nothing in production sends users to `/auth/confirmed` yet — that wiring lands in Commit 3.

**Why not under the `_unauthenticated` layout:** the layout's invariant is "signed-in users get redirected away." But `authConfirmedRoute`'s success case is precisely "signed-in user just confirmed — render the acknowledgment for them to click through." Putting it under the layout would redirect away every successful confirmation. So `authConfirmedRoute` keeps its own `beforeLoad` with the subtler logic.

**Files added:**

- `web/src/components/auth/ConfirmedNotice/ConfirmedNotice.tsx` — the success-state UI: a `Card` with a brief acknowledgment heading + description, and a single primary `Button` labeled "Continue". On click, navigates via `useNavigate` to:
  - `search.redirect` if present, OR
  - `defaultAuthedDestination(teamContext)` otherwise (via `useRouteContext({ from: '/auth/confirmed' })` to read `teamContext`).

  No `useEffect`-driven navigation. No timer. The click is the acknowledgment (AC 9). Uses existing primitives — `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `Button` from `@/components/ui/*`.

- `web/src/tests/integration/auth-confirmed.integration.test.tsx` — integration coverage for the route. Builds a per-test route tree with `createRootRouteWithContext<RouterContext>()`, mirrors the production `authConfirmedRoute` inline (its `beforeLoad`, `validateSearch`, `component`), and includes stub routes for `/sign-up`, `/leagues`, `/create-team`, `/join/$token` so redirect targets are assertable via `findByRole('heading', { name })`. Uses `buildStubRoute` from `web/src/tests/test-utils/routeTreeBuilders.tsx`.

  **Mock seam.** Per `web/CLAUDE.md`, don't mock own-code modules in the integration layer. Mock only the third-party seam — `vi.mock('@/lib/supabase', () => ({ supabase: { auth: { initialize: vi.fn() } } }))` — the same pattern `signup-resend.integration.test.tsx:12` uses for `supabase.auth.resend`. The real `readConfirmationLinkError()` runs against that mock and returns null / expired / generic based on what `initialize()` resolves to.

  **Hash-capture test wiring.** Because `hadConfirmationGrantOnLoad` captures `window.location.hash` at module load, per-test variation requires `vi.resetModules()` + dynamic `await import('@/lib/auth-redirect')` inside each test, after setting `window.location.hash`. The route tree must also be built per test inside the same dynamic-import scope so it pulls the freshly evaluated helper:

  ```typescript
  beforeEach(() => { vi.resetModules(); });

  async function setupRoute({ hash }: { hash: string }) {
    window.location.hash = hash;
    const { hadConfirmationGrantOnLoad, readConfirmationLinkError } = await import('@/lib/auth-redirect');
    const { ConfirmedNotice } = await import('@/components/auth/ConfirmedNotice/ConfirmedNotice');
    return buildAuthConfirmedRouteTree({ hadConfirmationGrantOnLoad, readConfirmationLinkError, ConfirmedNotice });
  }
  ```

  Tests:

  1. **Fresh magic-link arrival, no-team user** — hash set to `'#access_token=fake'`, `supabase.auth.initialize` resolves `{ error: null }`, auth = `createAuthedAuth()`, `teamContext.hasTeam = false`. Asserts the confirmation message renders + a single "Continue" button. Click Continue → `/create-team` stub.
  2. **Fresh magic-link arrival, has-team user** — same setup but `teamContext.hasTeam = true`. Continue → `/leagues` stub.
  3. **Fresh magic-link arrival, with `?redirect=/join/abc`** — initialEntry includes the search param; Continue → `/join/abc` stub (overrides team-state decision).
  4. **Error in hash** — `supabase.auth.initialize` resolves with an `AuthImplicitGrantRedirectError` carrying `details.code: 'otp_expired'`. Asserts redirect to `/sign-up` stub (ConfirmedNotice never renders). `'generic'` covered by a second case (different error code).
  5. **Defensive: no hash, no session** — hash = `''`, `auth = createUnauthAuth()`. Asserts redirect to `/sign-up` stub.
  6. **Defensive: no hash, has session** — hash = `''`, `auth = createAuthedAuth()`, `hasTeam = false`. Asserts redirect to `/create-team` stub. Mirror case with `hasTeam = true` → `/leagues` stub.
  7. **No auto-redirect on success** — extends test 1: without clicking Continue, page stays on `/auth/confirmed` across a `waitFor` window. Covers AC 9 directly.

  No MSW handlers needed — this route makes no API calls.

**Files modified:**

- `web/src/lib/auth-redirect.ts` — add `hadConfirmationGrantOnLoad()`. The capture must happen at module load because Supabase's `initialize()` (scheduled as a microtask during client construction) strips the URL fragment before any `beforeLoad` can run.

  ```typescript
  // Captured at module load — the auth library removes this part of the URL
  // before our route guards run, so reading it later returns nothing.
  const HAD_IMPLICIT_GRANT_ON_LOAD =
    typeof window !== 'undefined' && window.location.hash.includes('access_token=');

  export function hadConfirmationGrantOnLoad(): boolean {
    return HAD_IMPLICIT_GRANT_ON_LOAD;
  }
  ```

- `web/src/lib/route-guards.ts` — add a small named function for the route + component sites the layout can't cover:

  ```typescript
  export function defaultAuthedDestination(
    teamContext: Pick<RouterContext['teamContext'], 'hasTeam'>,
  ): '/leagues' | '/create-team' {
    return teamContext.hasTeam ? '/leagues' : '/create-team';
  }
  ```

  Used by `authConfirmedRoute.beforeLoad` defensive branch and `ConfirmedNotice` Continue handler. The layout in Commit 1 inlines its branches for clarity (just two `throw redirect` calls); this helper exists for the non-route sites where the value flows into a `navigate({ to })` call or another decision.

- `web/src/router.tsx` — add `authConfirmedRoute` as a peer of the `unauthenticatedLayoutRoute` (NOT under it — see "Why not under the `_unauthenticated` layout" above). Register in the route tree.

  ```typescript
  const authConfirmedRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/auth/confirmed',
    validateSearch: redirectSearchSchema,
    component: ConfirmedNotice,
    beforeLoad: async ({ context }) => {
      const error = await readConfirmationLinkError();
      if (error) {
        throw redirect({ to: '/sign-up', replace: true });
      }
      if (!hadConfirmationGrantOnLoad()) {
        if (!context.auth.user) {
          throw redirect({ to: '/sign-up', replace: true });
        }
        throw redirect({ to: defaultAuthedDestination(context.teamContext), replace: true });
      }
    },
    errorComponent: ({ error }) => <ErrorComponent error={error} />,
  });
  ```

  Error redirects leave Supabase's URL hash (`#error=...&error_code=otp_expired`) intact for `signUpRoute.beforeLoad`'s `readConfirmationLinkError()` to read on arrival — same `<InlineError>` pipeline the user already sees today (AC 3). Verified: `initialize()` caches the result, so the second call from `signUpRoute` returns the same error info.

**Build/test commands:** `npm run web:lint && npm run web:format:check && npm run web:test && npm run web:build`.

---

### Commit 3 — Wire SignUpForm to `/auth/confirmed`, remove dead indexRoute branch, update tests

**What ships:** the production switchover. `SignUpForm`'s `emailRedirectTo` now points at `/auth/confirmed` via TanStack's typed URL builder, which makes the magic-link flow actually use the new route. `indexRoute`'s `readConfirmationLinkError()` branch becomes unreachable (no magic link ever lands on `/` again) and is removed. The signup-resend integration test and the magic-link e2e tests are updated.

**Files modified:**

- `web/src/components/auth/SignUpForm/SignUpForm.tsx` — replace the `emailRedirectTo` construction (lines 35-36) with TanStack Router's typed location builder. This is the file's first use of `buildLocation`, but `useRouter()` is already an established pattern in the codebase (`useLineupPicker.ts:2`). The win: compile-time validation that `/auth/confirmed` is a registered route, and typed search-param shape.

  ```typescript
  const router = useRouter();
  // ...inside the component body...
  const built = router.buildLocation({
    to: '/auth/confirmed',
    search: search.redirect ? { redirect: search.redirect } : undefined,
  });
  const emailRedirectTo = `${window.location.origin}${built.href}`;
  ```

  Add `useRouter` to the existing `import { Link, useNavigate, useRouteContext, useSearch } from '@tanstack/react-router'` line. `destination` (line 35) stays as-is — still used by the in-app OTP-typed `completeSignUp()` path at line 41 (AC 7 unchanged). The new `emailRedirectTo` is consumed by both `signUp()` (line 88) and `resendConfirmation()` (line 112), so this one change covers AC 6.

- `web/src/router.tsx` — remove the `readConfirmationLinkError` branch from `indexRoute.beforeLoad` (now reduced to just that check after Commit 1). Magic-link errors no longer land on `/` — they land on `/auth/confirmed`, which redirects them to `/sign-up` itself. Drop the import of `readConfirmationLinkError` if no callers remain at the indexRoute level (`signUpRoute.beforeLoad` and `authConfirmedRoute.beforeLoad` still use it — keep the import).

  After this commit, `indexRoute.beforeLoad` may end up empty — if so, drop the `beforeLoad` key entirely. The `unauthenticatedLayoutRoute` parent already handles signed-in redirect.

- `web/src/tests/integration/signup-resend.integration.test.tsx` (line 81) — update the assertion. The `built.href` from `buildLocation` produces a path with TanStack's canonical search-string encoding; verify the exact string against an actual call output during implementation, but expected shape:

  ```typescript
  options: {
    emailRedirectTo: `${window.location.origin}/auth/confirmed?redirect=%2Fleagues%2F123`,
  }
  ```

  (TanStack `buildLocation` URL-encodes search-param values via the router's `parseSearch` / `stringifySearch` pair, which defaults to `JSON.parse` / `JSON.stringify`-with-encoding; the value `/leagues/123` round-trips to `%2Fleagues%2F123` — confirm during implementation.) The test's `initialEntry` (`/sign-up?redirect=/leagues/123`) and the rest of the flow are unchanged. The same test now covers AC 6's "resent email points at confirmation page" property.

- `e2e/tests/auth.spec.ts` — update three tests so post-link-click assertions step through the new intermediate page, and add one new test for the error-redirect chain. The OTP test (lines 72-99) and the sign-in tests are not touched.

  - **"completes signup via the magic link"** (lines 42-70): after `await page.goto(confirmationUrl)`, replace `await expect(page).toHaveURL('/create-team')` with:

    ```typescript
    await expect(page).toHaveURL(/\/auth\/confirmed#?$/);
    await expect(page.getByRole('heading', { name: /email confirmed/i })).toBeVisible();
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page).toHaveURL('/create-team');
    ```

    (The `#?$` allowance mirrors line 185 — the SDK leaves a bare `#` after stripping the fragment.)

  - **"resends the confirmation email and confirms via the resent link"** (lines 101-135): same three-line update at line 134.

  - **"preserves /join/<token> across browsers via emailRedirectTo"** (lines 137-188): after `await pageB.goto(confirmationUrl)`, replace the `toHaveURL` assertion (line 185-186) with:

    ```typescript
    await expect(pageB).toHaveURL(new RegExp(`/auth/confirmed\\?redirect=%2Fjoin%2F${invite.token}#?$`));
    await pageB.getByRole('button', { name: /continue/i }).click();
    await expect(pageB).toHaveURL(new RegExp(`/join/${invite.token}#?$`));
    await expect(pageB.getByText(leagueName)).toBeVisible();
    ```

    This still proves the load-bearing property — that the SDK's fragment auto-detect works on a fresh browser with zero prior storage state (AC 8) — and additionally exercises the cross-browser invite preservation through the new page.

  - **NEW: "expired magic link lands on /sign-up with the inline error"** — add one e2e covering the error-redirect chain (`/auth/confirmed` → `/sign-up` with `<InlineError>`). The new redirect hop is cross-system wiring that earns e2e coverage per the project testing strategy. Pattern: do a signup, extract the magic-link URL from Mailpit, mutate the `token` query parameter to a known-invalid value, `page.goto(brokenUrl)`. Assert `toHaveURL(/\/sign-up/)` and that the page shows the existing "couldn't confirm" / "no longer valid" inline error (message strings live in `SignUpForm.tsx:15-18` — assert via `getByRole('alert')` matching the visible text). One test, covers AC 3 end-to-end.

**Build/test commands:**

```bash
npm run web:lint && npm run web:format:check && npm run web:test && npm run web:build
npm run api:test
# E2E requires `cd e2e/supabase && supabase start` first:
npm run e2e
```

---

## Verification (end-to-end, after all three commits)

1. **Manual smoke (dev stack):** `npm run web:dev` + `npm run api:watch`. In the browser:
   - Sign up with a new email → land on Check Your Email screen. Open Mailpit (`http://localhost:54324`), grab the magic link, paste in a fresh incognito window. Expect: `/auth/confirmed`, message visible, "Continue" button. Click → `/create-team`. (AC 1, 2)
   - Sign up at `/sign-up?redirect=/join/<some-valid-token>`. Confirm via incognito link. Expect: `/auth/confirmed?redirect=...`, click Continue → `/join/<token>`. (AC 8)
   - Resend from the Check Your Email screen, confirm via the *resent* link. Same `/auth/confirmed` landing. (AC 6)
   - Visit `/auth/confirmed` directly while signed out → immediate redirect to `/sign-up`. (AC 4)
   - Sign in with an existing account, then visit `/auth/confirmed` directly → immediate redirect to `/leagues` or `/create-team`. (AC 5)
   - Mangle a magic-link query string in Mailpit (truncate the token) and visit it → `/sign-up` with the existing "couldn't confirm" inline error. (AC 3)
   - Type a 6-digit OTP from the email into the Check Your Email screen instead of clicking the link → still navigates straight into the app, never touching `/auth/confirmed`. (AC 7)
   - Sign in (as an authed user), then manually navigate to `/sign-in` / `/sign-up` / `/` — each immediately redirects to leagues or create-team (proves Commit 1's `_unauthenticated` layout works in production for all three entry routes).

2. **Automated:**
   - `npm run web:test` — full frontend unit + integration suite, including the new `auth-confirmed.integration.test.tsx` and the updated `signup-resend.integration.test.tsx`.
   - `npm run test:all` — frontend + backend.
   - `cd e2e/supabase && supabase start` then `npm run e2e` — full Playwright suite, with the three updated `auth.spec.ts` tests covering AC 1, 2, 6, 8 and the new expired-link test covering AC 3 through the real stack.

---

## Notes for implementation

- **Supabase redirect allowlist:** dev/e2e are covered by the existing `http://localhost:5173/**` wildcard in `api/supabase/config.toml:126`; no config change. Production may need `/auth/confirmed` added if the dashboard uses tightened patterns — flag in PR description; out of repo's automatable scope.
- **Commit message style:** conventional commits per CLAUDE.md (`refactor:`, `feat:`, `feat:` or similar). PR title NOT conventional-commit-styled per user preference. No `Co-Authored-By` footer.
- **Comments:** only one is justified — the const in `auth-redirect.ts` explaining the module-load capture timing. Everything else (component structure, redirect decisions, layout intent) is self-evident from the code and the route-tree shape.
- **No new contracts, services, or third-party deps** are introduced. The new component uses existing `@/components/ui/*` primitives; the route reuses `redirectSearchSchema` and the existing `RouterContext` shape. `useRouter` and `buildLocation` are already in the project's TanStack Router dependency.
