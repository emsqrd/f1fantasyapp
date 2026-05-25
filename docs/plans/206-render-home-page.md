# Plan: Render Home page at `/` for authed users (issue #206)

## Context

`/` currently renders the marketing `LandingPage` for anon users; authed users get bounced away by `_unauthenticated.beforeLoad` to either `/create-team` or `/leagues`. Per ADR 002 and ADR 003, `/` becomes the canonical post-auth destination — anon users still see `LandingPage`, authed users see a new `Home` surface composed from `GET /me/team/summary` (#205), `GET /me/standings` (#205), and the existing `GET /seasons/{id}/race-weekends`.

The backend endpoints from #205 are already merged. This issue ships the frontend side: services + types, the `Home` UI, an extracted `useLockCountdown` hook (shared with `Team.tsx`), sidebar tweaks, and the route refactor that flips `/` from "Landing-only with redirect" to "auth-branching surface."

**Open-question decisions (from clarifying turn):**

- **Team data for the identity header** — `rootRoute.beforeLoad` already fetches `getMyTeam()` for the `teamContext.setMyTeamId` sync but throws the result away. We add `team` to its return. The `RouterContext` type already declares `team: Team | null` (`router-context.ts:21`), so this is plumbing, not a type change. Zero extra requests.
- **Empty states (no team / no leagues)** — issues #207 / #208 own dedicated empty-state UX. For #206, `Home` renders the same layout for every authed user: missing scored race → em-dashes (already required by the issue's em-dash rule); missing team → identity header drops the `<h2>` team name and keeps the welcome; empty standings → leagues section just renders nothing. No placeholder components, no internal branching by data shape.

---

## Commit 1 — Frontend types + service wrappers for `/me/team/summary` and `/me/standings`

Mirror the C# DTOs from `api/F1CompanionApi/Api/Models/` into TS contracts and add the two missing service functions. Service shape follows the established 404-handling convention from `teamService.ts:21-31` (`if (isApiError(error) && error.status === 404) return null; throw error;`).

### Files

- `web/src/contracts/TeamSummary.ts` (new) — `{ seasonTotalPoints: number | null; lastRace: { round: number; name: string; totalScore: number } | null }`.
- `web/src/contracts/MyLeagueStanding.ts` (new) — `{ leagueId: number; leagueName: string; totalTeams: number; position: number | null; totalPoints: number | null }`.
- `web/src/services/teamService.ts` — append `getTeamSummary(): Promise<TeamSummary | null>` hitting `GET /me/team/summary`; wrap with the 404-as-null pattern.
- `web/src/services/standingsService.ts` — append `getMyStandings(): Promise<MyLeagueStanding[]>` hitting `GET /me/standings`. Returns `[]` shape — no 404 wrapping (collection endpoint, per #205 plan).

### Tests

Per existing convention (see `teamService.ts` and `standingsService.ts` — neither has a `.test.ts`), thin client wrappers get no direct unit tests; coverage comes from the integration tests in Commit 5 via MSW handlers.

---

## Commit 2 — Extract `useLockCountdown` from `Team.tsx` + tests

Lift the lock-deadline ticker (`Team.tsx:62-118` — the `useState(new Date())` + `useEffect` interval + visibility-change handler + `lockDisplay` formatting + `lockingImminently` flag) into a shared hook. `Home` consumes it from the next-race hero; `Team` keeps the same behavior.

### Files

- `web/src/hooks/useLockCountdown.ts` (new) — input: `lockDeadlineStr: string | null`. Output: `{ isLocked: boolean; lockingImminently: boolean; lockDeadline: Date | null; remaining: { days: number; hours: number; minutes: number } | null }`. Preserves the visibility-change listener so the display updates on tab refocus. Hook owns math + tick + visibility-refresh only — string formatting is the caller's job.
- `web/src/components/Team/Team.tsx` — replace the local `useState`/`useEffect`/derived-string block with `const { isLocked, lockingImminently, lockDeadline, remaining } = useLockCountdown(currentRace?.lockDeadline ?? null);`. Format inline at the render site as `${remaining.days}d ${pad(remaining.hours)}h ${pad(remaining.minutes)}m` — **no conditional to omit the `Xd` segment when days is zero**. Existing Team page currently hides `0d` (drops to `HHh MMm`); this change makes it always show `0d 02h 14m` under a day. Confirmed acceptable behavior change.
- `web/src/hooks/useLockCountdown.test.ts` (new) — follow the `useLineupPicker.test.ts` shape (`renderHook` + `vi.useFakeTimers()`). Cover: transition test that walks a single deadline through `lockingImminently` flipping at T-59s and `isLocked` flipping past T-0 in one fixture; `remaining` math at representative deadlines (multi-day, sub-day, sub-hour); null deadline returns sane defaults. Skip the visibility-change listener — mocking `document.visibilityState` is high setup for plumbing-only behavior.

### Risk

Existing `team-lineup.integration.test.tsx` exercises `Team.tsx` end-to-end — it will fail loudly if the hook extraction regresses the ticker. No need to re-cover that path here.

---

## Commit 3 — `AppSidebar`: pin `Home` nav item + fix `My Team` active-path bug

Two unrelated-but-tiny edits to `web/src/components/AppSidebar/AppSidebar.tsx`. Bundled together because both are one-liners in the same `navigationItems` block (`AppSidebar.tsx:152-180`).

### Files

- `web/src/components/AppSidebar/AppSidebar.tsx`:
  - Import `HomeIcon` from `lucide-react` (matching the existing `TrophyIcon` / `UsersIcon` / etc. suffix convention in this file) and add a `handleHome` navigation handler (`navigate({ to: '/' })`).
  - Prepend a `Home` item to `navigationItems` *outside* the `hasTeam` ternary so it shows for both team / no-team states. `isActive: currentPath === '/'`. The existing `hasTeam` filter on `My Team` / `My Leagues` / `Browse Leagues` stays (#199 owns its removal).
  - Fix `My Team`'s `isActive: currentPath.startsWith('/team/')` → `isActive: currentPath === '/my-team'`. The current check never matches the real route.

### Tests

No `AppSidebar.test.tsx` exists today and the integration suite already exercises navigation through real route trees. Skip; if a regression surfaces, integration tests catch it.

---

## Commit 4 — Build `Home` and `NextRaceCard` + unit tests

Two files under `web/src/components/Home/`. Single responsive component per the issue — Tailwind `md:` prefixes only, no `*.mobile.tsx`, no `useMediaQuery`. Reuse `PositionDelta`, the Leaderboard grid template, and (from Commit 2) `useLockCountdown`. Score-card and leagues-list sections live inline inside `Home.tsx` (they're each used at most twice and have no internal state — matches the `Leaderboard.tsx` "one file per surface" pattern).

### Files

- `web/src/components/Home/Home.tsx` (new) — pure presentational. Props: `{ firstName: string; team: Team | null; summary: TeamSummary | null; standings: MyLeagueStanding[]; races: RaceWeekend[] }`. Sections inline:
  - **Identity header** — welcome line always; team-name `<h2>` only when `team !== null`.
  - **Next-race hero** — delegates to `<NextRaceCard races={races} />`.
  - **Score-cards row** — two cards (Last Race / Season). Em-dashes when `summary?.seasonTotalPoints == null` or `summary?.lastRace == null`. Layout per `docs/mockups/home-page/design-handoff.md` §3.
  - **Leagues list** — Leaderboard grid template literally: `grid-cols-[32px_1fr_52px] md:grid-cols-[52px_1fr_70px_96px_36px]`. The `_70px` "Move" column renders empty (`MyLeagueStandingResponse` from #205 doesn't include `positionChange`; flagged below). Each row links to `/league/$leagueId`. Em-dashes for null `position`/`totalPoints`. Chevron column hidden at `<md`. Renders nothing when `standings.length === 0`.
- `web/src/components/Home/NextRaceCard.tsx` (new) — accepts `races: RaceWeekend[]`. Picks `races.find(r => r.isCurrent) ?? null`. When null → "Season complete · Final race: {name}, {date}" card (uses `races.at(-1)` for the final race), no CTA. When non-null → race name + location + date on the left, `useLockCountdown(currentRace.lockDeadline)` countdown on the right with the `Dd HHh MMm` lockup. Mobile: stacked with `border-t` divider per the design handoff. Co-locate a private `TimeSegment({ value, unit })` sub-component inside this file so the three `remaining.days` / `remaining.hours` / `remaining.minutes` renders aren't a repeated `<span><span/></span>` pair.
- `web/src/components/Home/NextRaceCard.test.tsx` (new) — two cases only: happy path with `isCurrent` race (asserts race name + countdown render, pick one lock state — not both); season-complete fallback (no `isCurrent` race). The locked/unlocked matrix is owned by `useLockCountdown.test.ts` per the overlap rule; re-walking it here would be waste.

### Tests not written

No `Home.test.tsx` — composition + score-cards + leagues-list rendering is exercised through the integration test in Commit 5 (with MSW supplying real loader data). Per `web/CLAUDE.md` testing layer: leaf components in unit tests, composition in integration.

### A note on `positionChange`

`MyLeagueStandingResponse` from #205 returns `{ leagueId, leagueName, totalTeams, position, totalPoints }` — no `positionChange`. The design handoff calls for `PositionDelta` in the leagues list. For #206 the Move column renders empty; a follow-up issue should extend the response with `positionChange` and wire it in. Flag this in the PR description so it doesn't fall on the floor.

---

## Commit 5 — Wire `/` to render `Home` for authed; rewrite root-routing integration test

The thread that pulls the previous commits together: root context exposes `team`; `indexRoute` moves out from under `_unauthenticated`; loader branches on auth; component branches on loader. Integration test asserts both branches end-to-end.

### Files

- `web/src/router.tsx`:
  - **`rootRoute.beforeLoad`** — extend both success and error return shapes to include `team`. Change line 120 to `return { profile, currentSeason, team };` and lines 141 / 144 to `return { profile: null, currentSeason: null, team: null };`. No type change needed (`RouterContext.team` already declared).
  - **`indexRoute`** — change `getParentRoute: () => unauthenticatedLayoutRoute` to `getParentRoute: () => rootRoute`. Add a `loader` that guards on `context.auth.user`: returns `{ home: null }` when anon; otherwise `Promise.all([getTeamSummary(), getMyStandings(), context.currentSeason ? getRaceWeekends(context.currentSeason.id) : Promise.resolve([])])` and wraps as `{ home: { summary, standings, races } }`. Replace `component: LandingPage` with a new `IndexComponent` that reads `useLoaderData()` + `useRouteContext({ from: '__root__' })` and renders `<LandingPage />` when `home === null`, otherwise `<Home firstName={profile!.firstName} team={team} summary={home.summary} standings={home.standings} races={home.races} />`.
  - **Route tree** (`routeTree` block, ~line 737) — remove `indexRoute` from `unauthenticatedLayoutRoute.addChildren([...])`; add `indexRoute` to `rootRoute.addChildren([...])` directly. `_unauthenticated` keeps only `signInRoute` and `signUpRoute`.
- `web/src/tests/integration/root-routing.integration.test.tsx`:
  - Anon test (L49-61) — keep as-is.
  - Replace the two redirect tests (L63-87) with two `Home`-renders assertions: (1) authed-with-team-and-leagues at `/` renders the team name as a heading; (2) authed-no-team at `/` still renders the welcome heading (asserts no crash and a stable assertion target). Both new tests need MSW handlers seeded via `server.use(...)` for `GET /me/team/summary`, `GET /me/standings`, and `GET /seasons/$id/race-weekends`. Build the route tree to mirror the new `indexRoute` shape (loader + branching component); copy the structure from `account.integration.test.tsx`.

### Tests that should keep passing untouched

- `team-lineup.integration.test.tsx` — Commit 2's hook refactor must not regress this. Run before pushing.
- `leagues.integration.test.tsx`, `league-loader.integration.test.tsx` — unaffected; sanity-only.

---

## Verification

From repo root, after each commit:

```bash
npm run web:lint
npm run web:format:check
npm run web:test           # unit + integration
npm run web:build          # type check
```

End-to-end smoke after Commit 5 (manual):

```bash
npm run web:dev
# In browser:
#   1. Open `/` in a fresh incognito window  → LandingPage renders.
#   2. Sign in as a user with a team and a league → Home renders with team name, scored race in the hero, two score cards, league row.
#   3. Sign in as a user with no team → Home renders welcome line, em-dash score cards, no leagues section. No crash.
#   4. Confirm sidebar shows `Home` at top, active when at `/`; `My Team` is active when at `/my-team`.
#   5. DevTools Network panel for an anon visit to `/` → zero `/me/*` requests fired.
```

Reference: `docs/mockups/home-page/design-handoff.md` for layout, typography, and copy validation.
