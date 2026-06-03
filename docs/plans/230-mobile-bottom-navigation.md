# Issue #230 — Surface primary navigation on mobile (bottom bar)

## Context

On mobile (`<768px`) the primary destinations live entirely behind the sidebar's hamburger drawer, so My Team / My Leagues / Browse Leagues are invisible by default — there's no obvious way to reach your team from the Home page without discovering and opening the drawer.

This change gives mobile a **persistent bottom navigation bar** (destinations, in the thumb zone) plus a **top bar** (brand + account). Desktop keeps the sidebar. Both presentations are driven by **one shared nav definition** (`useNavDestinations`) so they can't drift. The design reference is `docs/mockups/design_handoff_mobile_bottom_nav/README.md`; this plan records where the as-built deviates from or sharpens that handoff.

The handoff claims "no behavior change on desktop." That is **overstated** and we are accepting the desktop changes deliberately (see Commit 2): the no-team Create Team sidebar item is dropped, and two icons change. The companion architectural decision — rendering two distinct shell trees by a JS breakpoint rather than CSS visibility — is recorded in `docs/adr/005-mobile-shell-via-js-breakpoint.md`.

Out of scope (filed separately): contextual back/up navigation for the league→team drill-down (#232); a mobile-viewport E2E project (#238). #230 ships on unit + integration coverage.

## Approach

Three self-contained commits, each independently passing build/lint/test/format, each a gate (wait for approval before the next):

1. Extract `UserAvatar` (presentational leaf) + `useCurrentAvatar` (hook) + `AccountMenu`; refactor the `AppSidebar` footer to consume them. **Behavior-preserving refactor** — not strictly move-only: `AccountMenu` switches `router.invalidate()` from the `@/router` singleton to `useRouter()`, and `UserAvatar` becomes prop-driven (both detailed below).
2. Add `useNavDestinations`; refactor the `AppSidebar` nav to consume it. **Desktop-visible changes land here** (drop Create Team item, new icons, `<Link>` + `useMatchRoute` active state).
3. Add `MobileBottomNav` + `MobileTopBar`; flip `Layout` to a viewport switch; remove the mobile drawer/hamburger; add the safe-area plumbing. **Completes the feature.**

Foundation precedes use: shared primitives → nav hook → presentations.

---

## Commit 1 — Extract `UserAvatar` + `useCurrentAvatar` + `AccountMenu` (behavior-preserving refactor)

The account menu currently lives inline in `AppSidebar.tsx` and must appear in two surfaces after this change (desktop sidebar footer + mobile top-bar avatar). Extract it now so both surfaces share one implementation. This is **behavior-preserving, not strictly move-only** — two deliberate changes ride along, each flagged below.

### New `web/src/hooks/useCurrentAvatar.ts`

Owns the "current user's avatar" logic so it isn't duplicated across the sidebar footer and the mobile top bar: reads `profile` from route context (`useRouteContext({ from: '__root__' })`, matching `IndexRoute`), layers an uploaded URL pushed via `avatarEvents`, and tracks the image-loading flag. Returns `{ avatarUrl, isLoading, onLoad, onError }`. Lifts the logic at `AppSidebar.tsx:62-78, 148-155` (profile read, uploaded-URL state, `avatarEvents` subscription, loading state). This is the home for the context/subscription logic that `UserAvatar` no longer holds.

### New `web/src/components/UserAvatar/UserAvatar.tsx`

**Pure presentational leaf** — props in, DOM out, no router, no context. Renders the shadcn `Avatar`: shows `avatarUrl` when present, the `CircleUser` glyph fallback when absent, and the loading-spinner overlay when `isLoading` (an announced `role="status"` region). Props: `avatarUrl?`, `isLoading?`, `onLoad?`, `onError?`, `className?` (size). Callers pair it with `useCurrentAvatar()`.

> **Deliberate change #1:** the current dropdown *header* avatar (`AppSidebar.tsx:279-289`) has **no** spinner overlay, while the trigger avatar (`248-263`) does. A single `UserAvatar` gives the header a spinner it lacked. Accepted (the header avatar *should* reflect loading too) — this is part of why Commit 1 is "behavior-preserving" rather than "zero change."

### New `web/src/components/AccountMenu/AccountMenu.tsx`

Renders `<DropdownMenu>` + `<DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>` + the shared content (header row pairing `useCurrentAvatar()` → `UserAvatar` with name/email, *My Account* → `/account`, *Theme* Light/Dark/System, *Sign Out*). Owns the behaviors: theme via `next-themes`, account navigation, and the sign-out flow lifted from `AppSidebar.tsx:113-141` — **preserve `startAuthTransition()`/`completeAuthTransition()`** (Sentry capture + `toast.error` on failure), not just `signOut` → invalidate → navigate.

> **Deliberate change #2:** the sign-out flow currently calls `router.invalidate()` on the imported `@/router` **singleton** (`AppSidebar.tsx:5,119`). Switch to `const router = useRouter()` so `invalidate()` targets the router from context. This is the idiomatic TanStack pattern (the singleton is for non-component code like `main.tsx`), it lets the flow be integration-tested with **no `@/router` mock**, and it severs the existing circular import `router.tsx → Layout → AppSidebar → @/router` that the current `AppSidebar.test` mocks `@/router` to dodge.

Props:

- `trigger: ReactNode` — caller supplies its own trigger (composition, matching the existing `asChild` usage).
- `side: 'right' | 'bottom'` — explicit, not inferred from `useIsMobile()` (keeps it composable/testable).
- `onSelect?: () => void` — optional close hook; the sidebar passes `closeOnMobile` here so the mobile drawer still closes on navigation **while the drawer still exists** (removed in Commit 3).

### `web/src/components/AppSidebar/AppSidebar.tsx`

Footer becomes `<AccountMenu trigger={<SidebarMenuButton size="lg" …>{/* useCurrentAvatar() → <UserAvatar/> */}…name/email…<ChevronUpIcon/></SidebarMenuButton>} side="right" onSelect={closeOnMobile} />`. Nav section unchanged in this commit.

### Tests

- `useCurrentAvatar.test.tsx` (hook): resolves `profile.avatarUrl`; empty profile avatar treated as none; uploaded URL overrides; loading flag toggles on `onLoad`/`onError`. Provide `profile` via a real-router probe (`renderWithRouter` + a DOM probe) — **not** `vi.mock('@tanstack/react-router')`. As-built: `.tsx`, not `.ts` — the probe needs JSX.
- `UserAvatar.test.tsx` (unit, leaf, **no router, no primitive mock**): asserts only what the leaf owns — the `role="status"` loading overlay shows when `isLoading`, not otherwise. The image / `CircleUser`-fallback path is the vendored Radix primitive's job and its load-state machine doesn't advance in jsdom, so it's left to the library (verified for real in a browser). _Narrowed from the original "image/fallback/onLoad-onError" plan: those would only have tested a mocked primitive, against `web/CLAUDE.md`._
- `src/tests/integration/account-menu.integration.test.tsx`: the sign-out flow (success + failure), *My Account* navigation, and theme selection — via `renderWithRouter` with the real router, **no `@/router` and no `@tanstack/react-router` mocks**. Assert real outcomes: `signOut` (the injected `vi.fn` auth value) called and landed on `/`; on failure assert `Sentry.captureException` and `toast.error` (spied). As-built: `Sentry.captureException` can't be spied (ESM namespace isn't configurable) so `@sentry/react` is **partial-mocked** — stubbing a third party we don't own is sanctioned; for theme, wrap in the real `next-themes` provider and assert `document.documentElement`. The test installs local jsdom shims it needs: `matchMedia` (for `next-themes`) and pointer-capture/`scrollIntoView` (for the real Radix dropdown). This replaces the account-dropdown cases removed from `AppSidebar.test.tsx`.
- `AppSidebar.test.tsx`: drop the account-dropdown/sign-out cases (now `AccountMenu`'s, covered by `account-menu.integration`), the avatar-lifecycle cases (now `useCurrentAvatar`'s), and the `@/router` mock; keep the nav/logo/active cases (still on the existing router mock until Commit 2).

**Gate:** build/lint/test/format all pass; the account/avatar logic moves intact, with the two deliberate changes above (header-avatar spinner, `useRouter()`); no other behavior change on desktop or the mobile drawer.

---

## Commit 2 — Add `useNavDestinations`; refactor `AppSidebar` nav

### New `web/src/hooks/useNavDestinations.ts`

Single source of truth for destinations. Returns **Home only** when `!hasTeam`; Home + My Team + My Leagues + Browse Leagues when `hasTeam` (reads `useTeam().hasTeam`). Shape: `{ key, title, short, icon, to }`. Icons (final, adopted on **both** surfaces): Home → `Home`, My Team → `Users`, My Leagues → `ChartNoAxesGantt`, Browse → `Search`. **Create Team is not a destination** — it stays the Home `CreateTeamHero` action.

### `web/src/components/AppSidebar/AppSidebar.tsx`

Nav maps `useNavDestinations()`. Compute active state with `useMatchRoute()` — the `<Link>` render-prop can't feed the *wrapping* button's `isActive`, and the sidebar's active styling comes from `SidebarMenuButton`'s `data-active`:

```tsx
const matchRoute = useMatchRoute();
// per destination — exact match (matchRoute defaults to `fuzzy: false`),
// preserving today's `pathname === dest.to` behavior so detail pages
// (/league/$id, /team/$id) don't highlight a tab:
const isActive = !!matchRoute({ to: dest.to });
<SidebarMenuButton asChild isActive={isActive} tooltip={dest.title}>
  <Link to={dest.to} onClick={closeOnMobile}>
    <dest.icon />
    <span>{dest.title}</span>
  </Link>
</SidebarMenuButton>
```

The interim `onClick={closeOnMobile}` preserves drawer-close while the mobile drawer still exists (gone in Commit 3). Remove the inline `navigationItems` array and the per-item `handle*` navigate callbacks. (The `<Link>` render-prop is used only by `MobileBottomNav` in Commit 3, where no wrapping button needs the value.)

**Desktop-visible changes land here** (approved): no Create Team item for no-team users; My Team icon `Trophy → Users`; My Leagues icon `Users → ChartNoAxesGantt`.

### Tests

- `useNavDestinations.test.ts` (unit): wrap `renderHook` in a `TeamContext.Provider` (via `createTeamContext({ hasTeam })`) — **not** `vi.mock`. No-team → `[home]`; has-team → `[home, team, leagues, browse]` with correct `to`/`short`. This unit test owns the destination *logic*.
- `AppSidebar.test.tsx`: the nav now uses `useMatchRoute()` + `<Link>`, so its mapping/active-state behavior is router-dependent. Drop the `@tanstack/react-router` mock and every router-dependent case (nav navigation, active state, logo) plus the now-false "Create Team item when no team" case. The nav *wiring* (sidebar maps the hook, links carry the right `to`, active tab reflects the route) is asserted by the Commit 3 integration test, which renders the real `Layout`→`AppSidebar` on desktop. If nothing router-free remains in `AppSidebar.test.tsx`, delete it. **Coverage handoff:** for this one commit the sidebar wiring rests on the hook unit test (logic) until Commit 3's integration test lands the wiring assertions.

**Gate:** build/lint/test/format all pass.

---

## Commit 3 — Mobile shell + viewport switch (completes the feature)

### New `web/src/components/MobileBottomNav/MobileBottomNav.tsx`

Fixed, edge-to-edge bar; maps `useNavDestinations()`. Container: `fixed inset-x-0 bottom-0 z-40`, `bg-background`, `border-t`, `h-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom))]`, `pb-[env(safe-area-inset-bottom)]`, inner flex row. Each tab is a `<Link to={dest.to} activeOptions={{ exact: true }}>` using the `isActive` render-prop to drive icon `strokeWidth` (2 → 2.3), label `fontWeight` (500 → 650), and color (`muted-foreground` → `primary`); icon 23px, label 10.5px `short`, `min-h-[46px]`. `activeOptions={{ exact: true }}` on **every** tab (not just Home): the bottom bar relies on `Link`'s own active calc, whose default is prefix matching (`/` would be active everywhere), so exact-on-all keeps it in lockstep with the sidebar's `useMatchRoute({ to })` exact match and prevents detail pages (`/league/$id`) from highlighting a tab. `aria-label="Primary"` on the `<nav>`; `aria-current="page"` is set automatically by `Link` when active (verified in `@tanstack/react-router@1.169.2`). With no team, one full-width Home tab (intended).

### New `web/src/components/MobileTopBar/MobileTopBar.tsx`

`sticky top-0 z-40`, height 52px, `border-b`, `bg-background`, space-between. Left: `Trophy` 21px (primary) + "F1 Fantasy" wordmark (match the sidebar lockup). Right: `<AccountMenu trigger={<button aria-label="Account menu"><UserAvatar className="size-8"/></button>} side="bottom" />`. Brand is **not** a separate nav control (Home is a tab) — non-interactive, avoids a redundant go-home affordance. No page title (covered by the active tab / each page's own heading).

### `web/src/components/Layout/Layout.tsx`

Authenticated branch switches on `useIsMobile()`:

- **mobile:** wrap in a flex column so `flex-1` has a context — the desktop branch gets this from `SidebarProvider`'s wrapper, but the mobile branch has none (`#root` is not a flex container; `body` only has `min-height:100vh`):
  ```tsx
  <div className="flex min-h-svh flex-col">
    <MobileTopBar />
    <main className="flex-1 p-4 pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom))]">
      <Outlet />
    </main>
    <MobileBottomNav />
  </div>
  ```
  **No `SidebarProvider`, no `AppSidebar`, no drawer, no hamburger** (never mounted). No `overflow:hidden` on the wrapper (would break the sticky top bar).
- **desktop:** today's `SidebarProvider` tree unchanged (header keeps `SidebarTrigger` + page title).

In `AppSidebar`, remove `closeOnMobile`, the interim `onClick`, and the now-unused `useSidebar()`/`isMobile` read (the drawer no longer renders on mobile, so nothing needs closing).

### `web/index.html` + `web/src/index.css`

- `index.html:6` meta → `width=device-width, initial-scale=1.0, viewport-fit=cover` (required for `env(safe-area-inset-bottom)` to be non-zero on iOS).
- `index.css` **`:root`** → `--bottom-nav-height: 3.5rem;` (single source for bar height + content padding). Define it in `:root` alongside `--radius`/`--primary` (`index.css:6-14`), **not** in the `@theme inline` block: with `inline` semantics Tailwind doesn't emit a runtime `:root` variable for the token, so the arbitrary `var(--bottom-nav-height)` usages would resolve to nothing. The `@theme inline` block exists only to map Tailwind utility namespaces (`--color-*`, `--radius-*`) — this token is consumed solely via `var()` in arbitrary properties, so it belongs in `:root`.

### Tests

- **`matchMedia` mock in `setupTests.ts`** (global): jsdom has no `matchMedia`. Add a mock implementing `matches`, `addEventListener`/`removeEventListener` (both used by `useIsMobile`'s `useSyncExternalStore` subscribe), `media`, and the legacy `addListener`/`removeListener`. Default to **desktop** (`matches: false`) with a per-test setter to flip to mobile, and reset it in `afterEach`. Being global, it also unblocks any test that renders the real `Sidebar` primitive (which calls `useIsMobile` internally) — previously avoided only because those tests mock `../ui/sidebar`.
- `src/tests/integration/navigation.integration.test.tsx` (real router + MSW): the single home for the nav wiring deferred from Commit 2 plus the mobile shell + viewport switch. Mount the **real `Layout`** so the `useIsMobile()` switch is exercised. Wiring the test needs (none of which `renderWithRouter` supplies on its own):
  - **`TeamContext.Provider`** in the route-tree root — `useNavDestinations` → `useTeam()` reads the React `TeamContext`, not the router context. Use `createTeamContext({ hasTeam })` and pass the same value as `routerContext.teamContext` so guards and the hook agree.
  - **`profile`** returned from the root route's `beforeLoad`/loader so the top-bar/sidebar avatar resolves (else `CircleUser` fallback — fine, but assert accordingly).
  - **`next-themes` provider** only if asserting theme; opening the menu doesn't require it.
  - Drive the switch by setting the `matchMedia` mock to mobile **before render** (separate renders for mobile vs desktop is simplest).
  - Assertions: mobile → bottom bar shows the right destinations (team vs no-team), top bar = brand + avatar, no sidebar/hamburger; desktop → sidebar, no bars; active tab reflects the current route; account menu opens from the top-bar avatar.
- **`Layout.test.tsx`** (existing): adding `useIsMobile()` to `Layout` makes it call `window.matchMedia` directly, so this file now depends on the global `matchMedia` mock above (default desktop keeps its authenticated-sidebar assertions valid). Keep its unauthenticated + page-title cases; let the integration test own the viewport switch — don't assert the mobile branch here (`MobileTopBar`/`MobileBottomNav` aren't mocked in it). It's the same pre-existing `vi.mock('@tanstack/react-router')` debt as `AppSidebar.test`; trim it the same way if convenient, but that's not required to ship #230.

**Gate:** build/lint/test/format all pass; acceptance criteria below verified.

---

## Key implementation notes

- **Safe area is dead without `viewport-fit=cover`** — adding it is app-wide (harmless on desktop). Once opted in, we own all bottom padding; don't mix browser defaults with manual hacks.
- **No Tailwind plugin** — `env()` via arbitrary values is real Tailwind v4; the shared `--bottom-nav-height` token (in `:root`, see Commit 3) keeps bar height and content padding in lockstep. Promote to an `@utility` only if safe-area usage spreads.
- **`matchMedia` is not globally mocked** (`setupTests.ts`) and Playwright is Desktop-Chrome-only — Commit 1's `account-menu` test already stubs it locally for `next-themes`, and Commit 3 promotes it to a global `matchMedia` mock (default desktop, per-test override) to drive `useIsMobile`. It becomes load-bearing for layout, not just the sidebar's internal Sheet decision, so it must implement the `change` event listeners `useSyncExternalStore` subscribes to.
- **`AppSidebar.test.tsx` and `Layout.test.tsx` are pre-existing tech debt** — both mock `@tanstack/react-router` and `../ui/sidebar`, against current `web/CLAUDE.md` guidance. The rework drops `AppSidebar.test`'s mocks (router-dependent behavior → integration); `Layout.test` keeps its unauth/page-title cases and leans on the new global `matchMedia` mock.
- **Active matching is exact** — detail pages (`/league/$id`, `/team/$id`) are siblings, not children, so no tab highlights on them (parity with today; the page's own `<h1>` carries context).

## Testing strategy alignment

- Pure branch logic (`useNavDestinations`), a presentational leaf (`UserAvatar`), and a self-contained hook (`useCurrentAvatar`) → **unit**, the lowest layer that sees them.
- Router wiring (`useMatchRoute` active state, the viewport switch, nav, the sign-out/account flow) → **frontend integration** with a real router, per `web/CLAUDE.md` ("router wiring → integration; don't `vi.mock('@tanstack/react-router')`"). The `useRouter()` switch in Commit 1 is what makes the account flow testable here without a `@/router` mock.
- **E2E deferred to #238** — the mobile tree's browser-only failure modes (fixed/sticky layout, safe-area, breakpoint switch) are real but warrant a deliberate mobile-viewport project, not a bolt-on. Tracked as high priority on the assumption mobile is the primary platform.

## Verification

- `npm run web:build`, `npm run web:lint`, `npm run web:test`, `npm run web:format:check` after each commit.
- Manual checks, split by what each tool can actually see:
  - **DevTools / responsive emulation:** the 768px switch shows exactly one shell (no double header, no overlap); content isn't obscured behind the fixed bar; the sticky top bar survives scroll; an open dialog/sheet covers the bar (`z-40` under `z-50`); no-team shows Home only in both presentations.
  - **Real device / iOS Simulator only:** the bottom bar clears the home indicator on a notched device. `env(safe-area-inset-bottom)` resolves to 0 under desktop-Chrome emulation, so this is the one check emulation can't reproduce — see #238.

## Acceptance criteria (from the issue + handoff checklist)

- [ ] `useNavDestinations()` is the single source of truth; Home-only when no team; icons as specified.
- [ ] `AppSidebar` consumes the hook; no Create Team nav item; account menu still in the footer (desktop).
- [ ] `MobileBottomNav` (edge-solid spec) consumes the hook; shown only `<768px`.
- [ ] `MobileTopBar` (brand + avatar → account menu); shown only `<768px`.
- [ ] The mobile sidebar drawer and hamburger no longer render on mobile.
- [ ] `env(safe-area-inset-bottom)` honored (and `viewport-fit=cover` present).
- [ ] No-team shows Home only in both presentations; Create Team remains the Home hero CTA.
- [ ] Route guards and their tests are unchanged.
