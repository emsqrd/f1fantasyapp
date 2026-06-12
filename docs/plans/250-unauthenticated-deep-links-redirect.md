# Issue #250 — Unauthenticated deep links lose their destination

## Context

Opening a protected URL while signed out sends the user to `/` (the marketing landing) and discards where they were headed; signing in does not return them. Measured: anon → `/my-team` ends on `/` with 0 API calls.

The redirect-preservation plumbing already exists but is **half-built**:

- **Consumers (read `search.redirect`, already work):** `SignInForm` (`SignInForm.tsx:33`, navigates to `search.redirect ?? '/'`), `SignUpForm` (`SignUpForm.tsx:35`, drives both `emailRedirectTo` and the post-confirmation navigation — the destination survives the email round-trip as `/auth/confirm?…&next=<dest>`), and `CreateTeam` (`CreateTeam.tsx:58`).
- **Producer (sets the param):** only `JoinInvite` (`JoinInvite.tsx:142/147/165`), threading `/join/$token` through the sign-in / sign-up / create-team links.
- **The gap:** the generic `requireAuth` guard (`route-guards.ts:11`) throws `redirect({ to: '/' })` with **no** param. It's the one producer that was never wired up, so every protected route except the invite flow loses its destination on a cold visit.

Two findings surfaced during grilling, beyond the issue's framing, and were folded into scope:

1. **The already-authed bounce ignores `redirect`.** The `_unauthenticated` layout (`router.tsx:131`) bounces signed-in visitors to a hardcoded `/`, so an already-authed user hitting `/sign-in?redirect=/my-team` lands on `/`, not `/my-team`.
2. **The redirect validator has a latent open-redirect hole.** `redirectSearchSchema` (`router.tsx:82`) validates with `url.startsWith('/')`, which does **not** stop protocol-relative URLs — `"//evil.com".startsWith('/')` is `true`, and browsers resolve `//evil.com` to an external origin. Making the param reachable from every protected route turns this from theoretical into reachable.

The decision and its relationship to ADR 002 are recorded in **[ADR 007](../adr/007-unauthenticated-deep-links-redirect-to-sign-in.md)**.

### Why `/sign-in`, not `/` (validated against the docs, not inferred)

Researched against TanStack Router's own [authenticated-routes guide](https://tanstack.com/router/latest/docs/framework/react/guide/authenticated-routes) and the cross-framework consensus (Angular/Vue/React/Next return-URL guards). The canonical pattern is unambiguous: the guard redirects an unauthenticated user to the **login page** carrying the attempted URL as a `redirect` search param, and the login route both (a) navigates there after auth and (b) bounces an already-authed visitor straight to it. Routing a returning user through the marketing page is the bounce a return-URL exists to avoid. This codebase's own `JoinInvite` already conforms — it points at `/sign-in?redirect=…`, not `/?redirect=…`.

ADR 002 ("`/` renders Home, no bounce") governs where *authed* and *post-auth* users land; this is the *pre-auth gate* for unauthed users hitting protected routes — a different axis, not a contradiction. ADR 007 records that distinction so a future reader doesn't "fix" this back to `/`.

## Decisions (from the grilling session)

- **Redirect target:** `requireAuth` → `/sign-in?redirect=<location.href>`. Capture `location.href` (path + search + hash) so `/league/5?tab=roster#standings` returns whole, not just the pathname.
- **Already-authed bounce:** move it off the `_unauthenticated` layout onto `signInRoute` and `signUpRoute` (the routes that validate `redirect`) and honor the param. A parent `beforeLoad` throwing `redirect({ to: '/' })` short-circuits before the child's validated search is ever seen, so the bounce *must* move down — which is also the canonical shape. **Keep the `_unauthenticated` layout route** (strip only its `beforeLoad`): `SignInForm`/`SignUpForm` read `useSearch({ from: '/_unauthenticated/sign-in' })`, so deleting the layout changes those route IDs and breaks the `from:` references.
- **Sign-up participates:** forward `redirect` across both sign-in ↔ sign-up toggle links and honor it in the sign-up authed-bounce, so a brand-new user who follows a shared deep link and *registers* (rather than signs in) also returns to destination. The sign-up consumer is already built end-to-end; this closes the last gap.
- **Hardening:** extract a shared `safeInternalPath(value)` to `src/lib/`, origin-checked (`new URL(value, origin)`, reject mismatched origin), and unit-test the rejection matrix as a table. Reuse it in `redirectSearchSchema` and refactor `ConfirmEmailNotice.resolveNextDestination` onto it (which also fixes that path silently dropping the URL hash). The open-redirect matrix is security logic with a dozen adversarial inputs — it belongs at the lowest layer (unit on the pure function), not walked through MSW. (`CONTEXT.md`'s "test Zod rules through integration" yields here to "edge-case matrices belong in unit.")
- **Test schema mirrors stay inline, not exported.** Two integration tests copy the redirect schema inline; rather than export `redirectSearchSchema` from `router.tsx` (which would be its first router-internal export, against the `web/CLAUDE.md` "mirror inline" convention), keep them inline but point them at the shared `safeInternalPath`. The security logic is single-sourced in the helper; only the trivial Zod wrapper is duplicated. (Confirmed via review against installed Zod 4.4.3 / Router 1.170.4.)
- **No new E2E.** This is pure client-side routing — guards, search params, navigation — with no new backend or session-wiring surface. The integration layer (real router + real guards + MSW) catches every failure mode this introduces; an E2E would be ice-cream-cone overlap.
- **Docs:** ADR 007 created. No `CONTEXT.md` change — "deep link / return URL" are general web concepts, not F1-domain language.

## Approach

Four self-contained commits, each independently passing build/lint/test/format, each a gate (wait for approval before the next):

1. **Harden the redirect validator** — `safeInternalPath` + schema + `ConfirmEmailNotice` refactor + unit matrix. *Lands first, on purpose: it closes the open-redirect hole before the next commit makes the param reachable from every protected route.*
2. **Capture the destination in `requireAuth`** — guard takes `location`, redirects to `/sign-in?redirect=<href>`; wiring + unit + integration.
3. **Honor `redirect` on the already-authed bounce** — move the bounce off the `_unauthenticated` layout onto the sign-in/sign-up routes; drop the now-dead `indexRoute` schema.
4. **Carry `redirect` across the sign-in ↔ sign-up toggle** — both toggle links forward the param.

---

## Commit 1 — Harden the redirect validator

### `web/src/lib/safeInternalPath.ts` (new)

```ts
/**
 * Coerce an untrusted redirect value to a safe same-origin path, or `undefined`.
 *
 * Resolving against the current origin and comparing origins rejects the whole
 * open-redirect class — protocol-relative (`//evil.com`), backslash (`/\evil.com`,
 * which the URL parser folds to `//`), absolute external, and `javascript:` —
 * which a `startsWith('/')` check lets through.
 */
export function safeInternalPath(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return undefined;
    return url.pathname + url.search + url.hash;
  } catch {
    return undefined;
  }
}
```

### `web/src/router.tsx` (`redirectSearchSchema`, ~line 82)

Replace the `startsWith('/')` refine with a transform through the helper:

```ts
const redirectSearchSchema = z.object({
  redirect: z
    .string()
    .optional()
    .catch(undefined)
    .transform((value) => safeInternalPath(value)),
});
```

`redirectSearchSchema` stays a `ZodObject`, so `signUpSearchSchema = redirectSearchSchema.extend({ … })` (`router.tsx:183`) is unaffected. The field value stays `string | undefined`; the only type shift is the key going from optional (`redirect?:`) to always-present (`redirect:`) once the transform runs — harmless to the three consumers, which all read via `??`/truthiness (`SignInForm.tsx:33`, `SignUpForm.tsx:35`, `CreateTeam.tsx:58`). Sanitization now happens on *arrival* at any route that validates this schema (verified at runtime: a thrown `redirect({ search: { redirect: '//evil.com' } })` arrives with `search.redirect === undefined`) — defense in depth even though `requireAuth` only ever feeds it a trusted `location.href`.

### `web/src/components/auth/ConfirmEmailNotice/ConfirmEmailNotice.tsx`

Delete the inline `resolveNextDestination` (lines 8–17) and call the shared helper (lines 44–45):

```ts
const destination = safeInternalPath(search.next) ?? '/';
```

Behavior is identical except the hash is now preserved (the old version returned `pathname + search` only), matching the `location.href` we capture in Commit 2.

### Test schema mirrors (must move in lockstep)

Two integration tests inline-copy the old `.startsWith('/')` validator and would silently diverge from production — keeping them on the weak check, which for `create-team` means its test would still accept `//evil.com` (and `CreateTeam` is the one consumer an attacker can influence, via `JoinInvite`'s `search={{ redirect }}`). Per `web/CLAUDE.md` ("production routes are not exported; mirror inline"), keep the mirrors inline but point them at the shared `safeInternalPath` so the security logic stays single-sourced:

- **`web/src/tests/integration/create-team.integration.test.tsx:34`** — swap the inline `redirectSearchSchema` to `.optional().catch(undefined).transform(safeInternalPath)`.
- **`web/src/tests/integration/signup-resend.integration.test.tsx:26`** — same swap on its inline `signUpSearchSchema`'s `redirect` field (its `confirmationError` field is untouched). (This file is also touched in Commit 3 for `buildUnauthenticatedLayout`.)

### Tests

- **`web/src/lib/safeInternalPath.test.ts` (new, unit):** the rejection matrix as a table — `/my-team` → `/my-team` ✓, `/league/5?tab=x#y` → preserved ✓, `//evil.com` → `undefined` ✗, `/\evil.com` → `undefined` ✗, `https://evil.com` → `undefined` ✗, `javascript:alert(1)` → `undefined` ✗, `undefined`/`''` → `undefined`.
- **`ConfirmEmailNotice` integration** (existing `auth-confirm.integration.test.tsx`): unchanged assertions still pass; **add a `next` carrying a hash** (e.g. `/league/5#standings`) to lock the now-preserved fragment — this is a behavior change Commit 1 deliberately introduces, so it ships with a test, not optionally.

**Gate:** `web:build`, `web:lint`, `web:test`, `web:format:check` pass.

---

## Commit 2 — Capture the destination in `requireAuth`

### `web/src/lib/route-guards.ts` (`requireAuth`, lines 11–18)

```ts
export function requireAuth(context: RouterContext, redirectTo?: string): void {
  if (context.auth.user) return;

  throw redirect({
    to: '/sign-in',
    search: { redirect: redirectTo },
    replace: true,
  });
}
```

The target route's `validateSearch` runs `safeInternalPath` on `redirectTo`, so a malformed value degrades to `/sign-in` with no param rather than throwing.

### `web/src/router.tsx` (`authenticatedLayoutRoute.beforeLoad`, line 284)

```ts
beforeLoad: ({ context, location }) => requireAuth(context, location.href),
```

### `web/src/tests/test-utils/routeTreeBuilders.tsx` (`buildAuthenticatedLayout`)

Mirror production capture so integration tests exercise the real param flow:

```ts
beforeLoad: ({ context, location }: { context: RouterContext; location: { href: string } }) =>
  requireAuth(context, location.href),
```

### `web/src/tests/test-utils/renderWithRouter.tsx` (~line 61)

Return the `router` so tests can assert post-redirect location:

```ts
return { ...render(/* … */), queryClient, router };
```

Once this lands, simplify Commit 1's fragment-preservation test in `auth-confirm.integration.test.tsx`: it currently asserts the preserved hash through a `LeagueStub` rendering `useLocation().hash` (the only way to read the post-navigation hash without the `router`). Replace that with a direct `router.state.location.hash` assertion and drop `LeagueStub`.

### Tests

- **`route-guards.test.ts` (unit):** the unauthenticated `requireAuth` case asserts `redirect({ to: '/sign-in', search: { redirect: '/my-team' }, replace: true })` (was `{ to: '/', replace: true }`); add a no-`redirectTo` case asserting `search: { redirect: undefined }`. The authed case is unchanged.
- **`SignInForm.test.tsx` (component):** assert a successful sign-in with `?redirect=/league/5` navigates to `/league/5`, and falls back to `/` when absent (the consumer already exists at `SignInForm.tsx:33` — lock it).
- **`route-guards.integration.test.tsx:55`:** flip the assertion. Add a `/sign-in` stub to `buildGuardRouteTree`; unauthed `/my-team` now lands there with `router.state.location.pathname === '/sign-in'` and `router.state.location.search.redirect === '/my-team'`. Add one deep link *with* a query string (`/league/5?tab=roster`) to prove `location.href` round-trips. Drop the now-unused `Home Page` stub assertion for this case.

**Gate:** build/lint/test/format pass; manual: anon visit to `/my-team` lands on the sign-in form, sign in, return to `/my-team`.

---

## Commit 3 — Honor `redirect` on the already-authed bounce

### `web/src/router.tsx`

- **`unauthenticatedLayoutRoute` (lines 128–140):** remove the `beforeLoad`; keep the route as a grouping wrapper (`component: () => <Outlet />`). Its `id: '_unauthenticated'` and the child route IDs are unchanged.
- **`signInRoute` (lines 175–181)** and **`signUpRoute` (lines 190–196):** add the redirect-honoring authed-bounce (`search` is already validated by each route's `validateSearch`):

  ```ts
  beforeLoad: ({ context, search }) => {
    if (context.auth.user) {
      throw redirect({ to: search.redirect ?? '/', replace: true });
    }
  },
  ```
- **`indexRoute` (line 152):** remove `validateSearch: redirectSearchSchema` — dead now that nothing sends `redirect` to `/`. `IndexRoute` reads `useLoaderData`, never `useSearch`, so this is inert.

### `web/src/tests/test-utils/routeTreeBuilders.tsx` (`buildUnauthenticatedLayout`)

Drop the hardcoded `/` bounce to mirror production (the layout is now a plain wrapper). Its only consumer is `signup-resend.integration.test.tsx`; if any case there asserts the authed-bounce, wire the per-route `beforeLoad` on that test's sign-up stub instead.

### Tests

- **`route-guards.integration.test.tsx` (new case):** an already-authed visitor to `/sign-in?redirect=/league/5` lands on the `/league/5` stub (not `/`). Same for `/sign-up?redirect=/x`.
- **`signup-resend.integration.test.tsx`:** adjust for the helper change above; existing resend assertions otherwise stand.

**Gate:** build/lint/test/format pass; manual: while signed in, visiting `/sign-in?redirect=/account` lands on `/account`.

---

## Commit 4 — Carry `redirect` across the sign-in ↔ sign-up toggle

### `web/src/components/auth/SignInForm/SignInForm.tsx` (line 94)

```tsx
<Link to="/sign-up" search={{ redirect: search.redirect }}>
  Don't have an account? Sign up
</Link>
```

### `web/src/components/auth/SignUpForm/SignUpForm.tsx` (line 190)

```tsx
<Link to="/sign-in" search={{ redirect: search.redirect }}>
  Already have an account? Sign in
</Link>
```

Forward only `redirect` (not `confirmationError`). When `redirect` is `undefined`, the link resolves to the bare route. Both targets accept `redirect` (`signInRoute`/`signUpSearchSchema`), so the typed `search` prop checks out.

### Tests

- **Integration:** mount `/sign-in?redirect=/league/5`, click "Sign up", assert `router.state.location.pathname === '/sign-up'` and `…search.redirect === '/league/5'`. Mirror for the reverse toggle from `/sign-up`.

**Gate:** build/lint/test/format pass; manual: anon `/my-team` → sign-in → "Sign up" → register → land on `/my-team`.

---

## Out of scope / follow-ups

- **`requireTeam` destination preservation.** A user without a team who deep-links to `/league/5` is sent to `/create-team` and, after creating, does not return to `/league/5` (the invite flow handles this case explicitly; generic deep links don't). Different gate, different issue.
- **Post-sign-up email round-trip for non-invite deep links** already works via `emailRedirectTo` → `next`; no change needed, but worth a manual smoke once Commits 1–4 land.

## Verification

- `npm run web:build`, `web:lint`, `web:test`, `web:format:check`.
- Manual matrix: (a) anon deep link → sign-in → returns to destination; (b) anon deep link with query string → returns whole; (c) already-authed visit to `/sign-in?redirect=/x` → `/x`; (d) anon deep link → toggle to sign-up → register → returns to destination; (e) a hand-crafted `/sign-in?redirect=//evil.com` → the param is stripped from the URL on arrival (the schema transforms it to `undefined` and the router re-serializes the cleaned search, so this is observable without signing in), and signing in falls back to `/`, never off-origin.
