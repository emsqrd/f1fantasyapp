# Issue #251 — Failure-state handling: route-error recovery, dead-invite 404, transient-failure discrimination

## Context

Three related failure-handling defects on the routing layer:

- **(a) Route errors recover with a full-page reload.** Eight route `errorComponent`s recover via `onReset={() => window.location.reload()}` (`router.tsx` account/create-team/leagues/browse-leagues/league/team/my-team/join-invite), discarding the running app and re-running startup (Sentry init, Supabase client, the root fetches) to recover from what is usually a transient loader blip. Two boundaries (root `:110`, `_authenticated` `:284`) instead use the framework `reset` — which the issue holds up as the "good" pattern. Four routes (index, sign-in, sign-up, auth/confirm) use a bare `<ErrorComponent>` with no retry at all, and `defaultErrorComponent` (`:704`) has no retry button.
- **(b) A dead invite link shows the generic site 404.** `joinInviteRoute` throws `notFound()` (`:246`) but defines no `notFoundComponent`, so it bubbles to the root generic 404 ("404 - Page Not Found", `:115`) — indistinguishable from mistyping any URL.
- **(c) The invite loader swallows every error into `notFound()`.** `joinInviteRoute`'s loader catches **all** errors from `previewInvite` and throws `notFound()` (`:237-248`). A network blip, 500, or auth hiccup on a *valid* link renders "Page Not Found" instead of an error state, and never reaches Sentry (`notFound()` isn't an error). Same failure class as #249 — transient failure misread as absence — the principle already stated in `route-guards.ts`'s `requireTeam` comment.

### Findings that emerged during grilling (beyond the issue's framing)

1. **The issue's "good" pattern is itself broken.** TanStack Router's docs carry a HIGH-severity warning: `reset()` only resets the error-boundary UI — it does **not** re-run the loader. For a loader/`beforeLoad` error, clicking "Try again" on the `reset` version is a no-op. The canonical fix is `router.invalidate()` (re-runs the loader **and** resets the boundary). So neither `reset` nor `reload` is right; `invalidate` is.
2. **The backend returns 400, not 404, for a bad token.** `InvalidLeagueInviteTokenException → 400` (`GlobalExceptionHandler.cs:125`), asserted by the `UnknownInviteTokenGivesClearError` integration test. "Invalid" and "expired" are indistinguishable server-side (the token simply isn't found). And a 404 can't reach this loader — an empty/missing token fails to match `/join/$token` and 404s at the *router* before the loader runs. So the discrimination is **400 only**, not the issue's guessed "404/400".
3. **Invites don't expire.** `LeagueInvite` has no expiry field and `GetOrCreate` returns the existing row — tokens are stable and permanent. The "expired" language in the issue and the server message is aspirational; the not-found copy must not promise an expiry concept that doesn't exist. (Captured in `CONTEXT.md` → "League invite".)
4. **The `ErrorBoundary` class is dead once the wrappers go.** Every route `errorComponent` wraps `<ErrorFallback>` in `<ErrorBoundary level="page">`. That wrapper catches nothing useful: its own default fallback is another `<ErrorFallback>` with the same `error`, so a throw would re-throw and propagate past it anyway (React won't let a boundary catch its own fallback). The class's only production use is this no-op wrap. Removing it is a clean delete (researched — see below).
5. **The app shell has no error boundary** — a pre-existing gap, *not* created by deleting the class. Tracked separately as **[#271](https://github.com/emsqrd/f1fantasyapp/issues/271)** (`priority:low`).

### Validated against the docs, not inferred

- **`invalidate`, not `reset`.** TanStack Router docs + their lint-style skill (HIGH severity): "reset() only resets the error boundary UI. It does NOT re-run the loader. For loader errors, use router.invalidate()."
- **Soft `<Link>`, not a hard `<a href>`, for the escape.** TanStack's idiom is `<Link>` for internal navigation; it reserves hard-nav anchors for external/cross-origin destinations, and every error-recovery example in the docs uses soft mechanisms (`invalidate`, `navigate`, `reset`). A hard reload would only beat a soft nav for a stale post-deploy bundle — and this app has **no code-splitting** (every route is a static import in `router.tsx`; no `lazy`/dynamic imports, no `manualChunks`), so the "chunk 404 after deploy" case can't happen on navigation. Hard nav buys effectively nothing here; soft `<Link>` is idiomatic and sufficient.
- **Deleting `ErrorBoundary` opens no coverage gap.** Confirmed against react.dev and the TanStack docs:
  - Route loader **and component-render** errors are caught by TanStack's per-route `errorComponent` (their docs/test force a throwing route `component` and assert the fallback renders) → `RouteErrorComponent`.
  - React 19's `onCaughtError`/`onUncaughtError`/`onRecoverableError` (`main.tsx:66-70`, wired to `Sentry.reactErrorHandler()`) are telemetry-only and fire for userland boundaries (TanStack's). So every error class still reaches Sentry. The class's `componentDidCatch → Sentry.captureException` was redundant with this (and never fired). Coverage is identical before and after.

## Decisions (from the grilling session)

- **Retry mechanism: `router.invalidate()`.** Real in-place recovery; also corrects the broken `reset` on root/`_authenticated`. A one-line WHY comment sits at the call site.
- **Secondary "Go home" escape.** UX research (NN/g heuristic #9; error-state pattern guides) converges on primary action + secondary escape for full-page errors, and the symptom-(c) fix is what *earns* the retry: once absence (400) routes to `notFound` and only transient/recoverable failures reach the error boundary, retry is the textbook-correct affordance — provided it's real (which is why `reset` is out). "Go home" covers the non-retryable slice so there's no dead end.
- **One shared `RouteErrorComponent`.** `useRouter().invalidate()` + `ErrorFallback`. Wired as `defaultErrorComponent`; referenced explicitly only on root and `_authenticated` (the latter documented load-bearing for the team guard's `beforeLoad` throw, covered by `route-guards.integration.test.tsx`). The ~12 duplicate per-route `errorComponent`s are deleted — they render at their own outlet position via the default, so chrome is preserved.
- **Soft `<Link to="/">` everywhere on the failure surface.** The escape and all not-found CTAs. Existing not-found anchors (root, default, league, team) convert from `<a href>` to `<Link>` for consistency.
- **"Go home" is supplied to `ErrorFallback` through a `secondaryAction` slot**, with `RouteErrorComponent` passing the `<Link to="/">`. Keeping the `<Link>` out of `ErrorFallback` leaves it a router-free presentational leaf, so its existing props-in/DOM-out tests need no `RouterProvider`. (A hard-coded `<Link>` would force all 11 `ErrorFallback` tests into a router — `<Link>` throws outside a provider — which violates the leaf-component testing rule. The slot earns its keep *now*, not speculatively.) The router-coupled bits (`invalidate` + the `<Link>`) both live in the router-aware `RouteErrorComponent`.
- **Delete the `ErrorBoundary` class** + its test + the barrel export + stale docs. Drop the nested wrapper from every route `errorComponent`.
- **Folder restructure.** `components/ErrorBoundary/` is named after one of the two components it holds — a poor name now that the class is leaving. Split into peer folders: `components/ErrorFallback/` and `components/RouteErrorComponent/`; delete `components/ErrorBoundary/`. (`ErrorState/` already stands alone.)
- **Invite not-found copy.** Heading **"Invite Not Found"**; body **"This invite link isn't valid. Double-check the link, or ask the league owner to share it again."**; **"Go home" → `/`**. No "expired" — invites don't expire.
- **Loader discrimination: `isApiError(error) && error.status === 400` → `notFound()`; rethrow the rest.** Sentry is already covered by `apiClient` (5xx + network). A brief WHY comment explains the special-case.
- **No ADR.** Re-applying the bar: it fails "hard to reverse" (a UI/routing convention refactorable in an afternoon, unlike the auth/routing ADRs 002/003/007), and the one genuinely-surprising call (`invalidate` not `reset`) is better served by a WHY comment at the call site than a doc. The rest is idiomatic (soft `<Link>`) or already documented (absence-vs-failure in `requireTeam` + #249).
- **Test layering.** `ErrorFallback` stays a **unit** (presentational leaf) — moved, existing cases kept. The new failure-mode guards are **integration** (real router + loader + MSW): retry-re-runs-loader, invite-400→not-found, invite-500→error-not-404. No E2E (failure-branch logic is integration's job per the testing strategy). No new backend test — the 400 contract is locked by `UnknownInviteTokenGivesClearError`.
- **Docs:** `CONTEXT.md` "League invite" added (done). `web/CLAUDE.md` + `web/.github/instructions/architecture.md` lose their now-false `ErrorBoundary` references in commit 1. No ADR.

## Approach

Two self-contained commits, each independently passing build/lint/test/format, each a gate (wait for approval before the next):

1. **Consolidate route error recovery** (symptom a) — shared `RouteErrorComponent` + `invalidate` + "Go home"; delete the ~12 duplicates, the nested wrappers, the dead `ErrorBoundary` class; strip the now-dead `level` variant from `ErrorFallback`; folder restructure; doc edits.
2. **Invite failure handling** (symptoms b + c) — loader 400-discrimination + invite `notFoundComponent`; convert the remaining not-found anchors to `<Link>`.

Two commits, not three: the `ErrorFallback` folder-move rides inside commit 1 — do not split it into its own mechanical commit.

Order is foundation-first: commit 1 establishes the shared error component that commit 2's transient-failure test lands on.

---

## Commit 1 — Consolidate route error recovery

### `web/src/components/RouteErrorComponent/RouteErrorComponent.tsx` (new)

```tsx
import { ErrorFallback } from '@/components/ErrorFallback/ErrorFallback';
import { Button } from '@/components/ui/button';
import { Link, type ErrorComponentProps, useRouter } from '@tanstack/react-router';

export function RouteErrorComponent({ error }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <ErrorFallback
      error={error}
      level="page"
      onReset={() => router.invalidate()}
      secondaryAction={
        <Button asChild variant="link">
          <Link to="/">Go home</Link>
        </Button>
      }
    />
  );
}
```

### `web/src/components/ErrorFallback/ErrorFallback.tsx` (moved from `ErrorBoundary/`, gains "Go home")

Move the file, adding the secondary escape link and stripping the now-dead `level` prop (with `ErrorBoundary` gone, `RouteErrorComponent` is the only consumer and always renders page-level):

```tsx
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  error: Error | null;
  onReset?: () => void;
  secondaryAction?: ReactNode;
}

export function ErrorFallback({ error, onReset, secondaryAction }: Props) {
  return (
    <div className={/* unchanged */}>
      <Card className="w-full max-w-md p-6">
        <div className="flex flex-col items-center space-y-4 text-center">
          {/* icon, heading, message, <details> — unchanged */}
          {onReset && (
            <Button onClick={onReset} variant="default">
              Try again
            </Button>
          )}
          {secondaryAction}
        </div>
      </Card>
    </div>
  );
}
```

No `<Link>` / router import here — `ErrorFallback` stays a router-free leaf; the caller (`RouteErrorComponent`) owns the link. (The `/* unchanged */` markers above are ellipses for the existing `className`/markup — move and edit the real file; don't paste this block literally, since `className={/* unchanged */}` is a syntax error.)

Move `ErrorFallback.test.tsx` into the new folder. It stays a router-free presentational test, and the existing cases stay green with the new optional prop (it defaults to `undefined` → renders nothing). **No new case for `secondaryAction`** — it's a trivial `ReactNode` passthrough, exercised end-to-end by the `RouteErrorComponent` integration test (which passes the real link and asserts its `href`); a dedicated unit case would just assert that React renders its children. The **"Go home → `/`"** assertion lives in that integration test, not here.

### `web/src/router.tsx`

- Import `RouteErrorComponent`; drop the imports of `ErrorBoundary`, `ErrorFallback`, and TanStack's `ErrorComponent` (no longer used directly).
- **Delete the `errorComponent` from all 12 leaf/intermediate routes** (index, sign-in, sign-up, auth-confirm, join-invite, account, create-team, leagues, browse-leagues, league, team, my-team) — they inherit the default, rendered at their own outlet position (chrome preserved).
- Set `defaultErrorComponent: RouteErrorComponent` (`:704`) — this intentionally gives the previously retry-less default the same retry + "Go home" as every route.
- Replace the root (`:110`) and `_authenticated` (`:284`) `errorComponent` bodies with `errorComponent: RouteErrorComponent` (keep the `_authenticated` comment about catching the child `beforeLoad` throw).
- Remove the stale `{@link ErrorBoundary}` JSDoc reference (`:688`).

### Deletions

- `web/src/components/ErrorBoundary/ErrorBoundary.tsx`
- `web/src/components/ErrorBoundary/ErrorBoundary.test.tsx`
- `web/src/components/ErrorBoundary/index.ts` (the barrel; new folders import directly via `@/components/ErrorFallback/ErrorFallback`, matching the repo's `X/X` convention)
- the now-empty `web/src/components/ErrorBoundary/` folder

### Docs

- `web/CLAUDE.md` "Error Handling" — strike the two `ErrorBoundary` lines ("catches React rendering errors" / "wrap components that might throw during render").
- `web/.github/instructions/architecture.md` — remove the `#### ErrorBoundary Component` subsection only (the dead class). **Keep** the "React 19 Error Handlers" subsection (still accurate) and the `#### ErrorFallback` subsection, but update ErrorFallback's path to `components/ErrorFallback/` and drop the "displayed by ErrorBoundary" wording. (Leave `sentry.md` and the agent persona file: they reference `Sentry.ErrorBoundary` / a generic teaching example, not our class.)

### Tests (commit 1)

**Layering (settled — do not re-litigate).** `ErrorFallback` is a presentational leaf → **unit** tests: provider-free, props-in/DOM-out, bare `render`. Its existing tests already conform; the `secondaryAction` slot is what keeps them router-free (no `RouterProvider` needed). `RouteErrorComponent` is a router-aware adapter → its only test is the **integration** one below (does "Try again" re-run the loader); **no** unit test mocking `useRouter`. The split is by failure mode: presentational rendering is unit-level, "retry actually refetches" is only catchable with a real router + loader.

- **New `web/src/tests/integration/route-error-recovery.integration.test.tsx`** — the load-bearing one for (a): build a one-route tree whose loader rejects on the first call and resolves on the second, driven by an **attempt-counter MSW handler** (reuse the `let attempts = 0` pattern from `join-invite.integration.test.tsx`'s retry test). Assert the error card renders, click **"Try again"**, assert the recovered content appears — this passes with `invalidate` and would *fail* against `reset` (proving the mechanism). Also assert the "Go home" link's `href` is `/` (the `getAttribute('href')` style used in `join-invite.integration.test.tsx`).
- **Update the 9 integration mirrors** that import/wrap `<ErrorBoundary>` (`account`, `view-team`, `team-lineup`, `leaderboard`, `leagues`, `league-invite-dialog`, `league-loader`, `join-invite`, `route-guards`). One rule, applied per file: remove the dead `<ErrorBoundary>` + `<ErrorFallback>` imports and wrapper; then **if the test asserts on the error UI, set `errorComponent: RouteErrorComponent`** (from `@/components/RouteErrorComponent/RouteErrorComponent`); **otherwise delete the `errorComponent` entirely** — a mirror that never renders the error path doesn't need one (web/CLAUDE.md: keep the mirror minimal — only what the test mounts). `route-guards` keeps it (asserts "try again" appears — `:160`); `join-invite` keeps it (its commit-2 transient-failure test renders the card). The rest most likely drop it — confirm per file by whether the test asserts error UI.
- **`route-guards.integration.test.tsx`** — its mirror used `onReset={reset}`; move to the `invalidate` pattern. The existing assertion (requireTeam `beforeLoad` failure → error card with retry) is the regression guard for the `_authenticated` placement.
- Delete `ErrorBoundary.test.tsx`; move `ErrorFallback.test.tsx`.

---

## Commit 2 — Invite failure handling

### `web/src/router.tsx` — `joinInviteRoute`

**Loader** (`:237-248`) — discriminate instead of swallow:

```tsx
loader: async ({ params }) => {
  const ROUTE_ID = '/join/$token';
  try {
    const preview = await previewInvite(params.token);
    return { preview };
  } catch (error) {
    // 400 means the token resolves to no league (invalid / never existed) — a real
    // absence, so notFound. 5xx and network errors are transient; rethrow them to
    // the error boundary.
    if (isApiError(error) && error.status === 400) {
      throw notFound({ routeId: ROUTE_ID });
    }
    throw error;
  }
},
```

Add `import { isApiError } from '@/utils/errors';`.

**`notFoundComponent`** (new, inline — matching the `league`/`team` pattern):

```tsx
notFoundComponent: () => (
  <div className="flex min-h-screen flex-col items-center justify-center">
    <h1 className="mb-4 text-4xl font-bold">Invite Not Found</h1>
    <p className="text-muted-foreground mb-4">
      This invite link isn't valid. Double-check the link, or ask the league owner
      to share it again.
    </p>
    <Link to="/" className="text-primary hover:underline">
      Go home
    </Link>
  </div>
),
```

The route's `errorComponent` was already removed in commit 1 (inherits `RouteErrorComponent`), so a rethrown 5xx/network now lands on the retryable error card.

### `<a href>` → `<Link>` consistency rider

Convert the remaining not-found CTAs to soft `<Link>` (import `Link` where needed):

- root `notFoundComponent` (`:119`, `Go back home` → `/`) and `defaultNotFoundComponent` (`:713`)
- `leagueRoute` notFound (`:494`, → `/leagues`)
- `teamRoute` notFound (`:590`, → `/leagues`)
- `myTeamRoute` notFound (`:644`, → `/create-team`)

These keep their bare underlined-link styling (`className="text-primary hover:underline"`) — only the element changes (`<a href>` → `<Link to>`). The error card's "Go home" is a `Button`-styled link instead, since it sits among the card's action buttons; the styling split is intentional.

### Tests (commit 2)

- **Update `join-invite.integration.test.tsx`** — the "invalid token" test (`:173-191`) currently returns 404 and asserts the generic "404 - Page Not Found". Change the MSW handler to **400**, add the route's new `notFoundComponent` to the mirror, and assert the **"Invite Not Found"** copy. Update the mirror's loader (`:38-50`) to the new 400-discrimination. The mirror's `errorComponent` is already `RouteErrorComponent` (swapped in commit 1), so a rethrown 500 lands on the shared retryable card — no further mirror change needed for the next test.
- **New transient-failure test** — preview returns **500**; assert the **error card** ("Something went wrong" + "Try again") renders, and that neither the invite-not-found nor the generic 404 appears. This is the regression guard for (c): a transient failure on a valid-looking token is a retryable error, not an absence.
- Backend: none — `UnknownInviteTokenGivesClearError` already locks the 400 contract.

---

## Out of scope / follow-ups

- **[#271](https://github.com/emsqrd/f1fantasyapp/issues/271)** — top-level error boundary for the app shell (the pre-existing gap surfaced while deleting the `ErrorBoundary` class). `priority:low`.
