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

- `web/src/components/Home/Home.tsx` (new) — pure presentational. Props: `{ name: string; team: Team | null; summary: TeamSummary | null; standings: MyLeagueStanding[]; races: RaceWeekend[] }`. Sections inline:
  - **Identity header** — welcome line always; team-name `<h2>` only when `team !== null`.
  - **Next-race hero** — delegates to `<NextRaceCard races={races} />`.
  - **Score-cards row** — two cards (Last Race / Season). Em-dashes when `summary?.seasonTotalPoints == null` or `summary?.lastRace == null`. Layout per `docs/mockups/home-page/design-handoff.md` §3.
  - **Leagues list** — Leaderboard grid template literally: `grid-cols-[32px_1fr_52px] md:grid-cols-[52px_1fr_70px_96px_36px]`. The `_70px` "Move" column renders empty in this commit (Commit 6 wires `PositionDelta` into it). Each row links to `/league/$leagueId`. Em-dashes for null `position`/`totalPoints`. Chevron column hidden at `<md`. Renders nothing when `standings.length === 0`.
- `web/src/components/Home/NextRaceCard.tsx` (new) — accepts `races: RaceWeekend[]`. Picks `races.find(r => r.isCurrent) ?? null`. When null → "Season complete · Final race: {name}, {date}" card (uses `races.at(-1)` for the final race), no CTA. When non-null → race name + location + date on the left, `useLockCountdown(currentRace.lockDeadline)` countdown on the right with the `Dd HHh MMm` lockup. Mobile: stacked with `border-t` divider per the design handoff. Co-locate a private `TimeSegment({ value, unit })` sub-component inside this file so the three `remaining.days` / `remaining.hours` / `remaining.minutes` renders aren't a repeated `<span><span/></span>` pair.
- `web/src/components/Home/NextRaceCard.test.tsx` (new) — two cases only: happy path with `isCurrent` race (asserts race name + countdown render, pick one lock state — not both); season-complete fallback (no `isCurrent` race). The locked/unlocked matrix is owned by `useLockCountdown.test.ts` per the overlap rule; re-walking it here would be waste.
- `web/src/components/Home/Home.test.tsx` (new) — `Home` is pure presentational (props in, DOM out — no hooks, no contexts, no services). Per `web/CLAUDE.md` it's a leaf, so its prop-level conditionals belong here, not in integration. Cases: (1) team present → "Welcome back, X" + team heading; (2) no team → only the welcome heading; (3) summary with values → score numbers + "pts" suffix render; (4) null summary → em-dashes, no "pts"; (5) standings present → leagues section renders with a row link to `/league/$leagueId`; (6) empty standings → leagues section absent. Stub `Link` from `@tanstack/react-router` with `importActual` since the leaf doesn't need a real router.

---

## Commit 5 — Wire `/` to render `Home` for authed; rewrite root-routing integration test

The thread that pulls the previous commits together: root context exposes `team`; `indexRoute` moves out from under `_unauthenticated`; loader branches on auth; component branches on loader. Integration test asserts both branches end-to-end.

### Files

- `web/src/router.tsx`:
  - **`rootRoute.beforeLoad`** — extend both success and error return shapes to include `team`. Change line 120 to `return { profile, currentSeason, team };` and lines 141 / 144 to `return { profile: null, currentSeason: null, team: null };`. No type change needed (`RouterContext.team` already declared).
  - **`indexRoute`** — change `getParentRoute: () => unauthenticatedLayoutRoute` to `getParentRoute: () => rootRoute`. Add a `loader` that guards on `context.auth.user`: returns `{ home: null }` when anon; otherwise `Promise.all([getTeamSummary(), getMyStandings(), context.currentSeason ? getRaceWeekends(context.currentSeason.id) : Promise.resolve([])])` and wraps as `{ home: { summary, standings, races } }`. Replace `component: LandingPage` with a new `HomeRoute` component in `web/src/components/Home/HomeRoute.tsx` that reads `useLoaderData({ from: '/' })` + `useRouteContext({ from: '__root__' })`. Renders `<LandingPage />` when `home === null || profile === null` (the `profile === null` branch is a defensive fallback for the `rootRoute.beforeLoad` error path). Otherwise renders `<Home name={profile.firstName ?? profile.displayName} team={team} summary={home.summary} standings={home.standings} races={home.races} />`. The `??` covers the genuinely-nullable `firstName`, falling back to `displayName` (tightening these contracts to non-null is deferred to #179).
  - **Route tree** (`routeTree` block, ~line 737) — remove `indexRoute` from `unauthenticatedLayoutRoute.addChildren([...])`; add `indexRoute` to `rootRoute.addChildren([...])` directly. `_unauthenticated` keeps only `signInRoute` and `signUpRoute`.
- `web/src/tests/integration/root-routing.integration.test.tsx`:
  - This layer owns routing + data wiring, not Home composition. Composition lives in `Home.test.tsx` (Commit 4). Keep assertions thin: one stable check per branch plus one assertion that the race-weekends endpoint flowed through to render.
  - Anon test (L49-61) — keep as-is.
  - Replace the two redirect tests (L63-87) with two `Home`-renders assertions: (1) authed-with-team at `/` renders the team name heading **and** the seeded race name (proves the third endpoint URL is wired); (2) authed-no-team at `/` renders the welcome heading (proves the 404 path of `getTeamSummary` flows through without crashing). Both tests need MSW handlers seeded via `server.use(...)` for `GET /me/team/summary`, `GET /me/standings`, and `GET /seasons/$id/race-weekends`. The test route tree must mirror the production loader's three-call `Promise.all` (gated on `context.currentSeason`); copy the structure from `account.integration.test.tsx`.

### Tests that should keep passing untouched

- `team-lineup.integration.test.tsx` — Commit 2's hook refactor must not regress this. Run before pushing.
- `leagues.integration.test.tsx`, `league-loader.integration.test.tsx` — unaffected; sanity-only.

---

## Commit 6 — Add `PositionChange` to `MyLeagueStandingResponse` + wire `<PositionDelta>` into Home

Commit 5 shipped the Home leagues list with the Move column rendering empty (desktop) and dropped entirely (mobile), because the `/me/standings` endpoint from #205 didn't include `positionChange`. The design mockup shows a `PositionDelta` per league row — desktop in its own column, mobile inline within the league name cell, matching `Leaderboard.tsx`.

The data already exists at the league level: `LeagueStandingsBuilder.Build` computes `prior.Position - current.Position` per team using the leaderboard at round `N` and round `N-1`. Mirror that calculation in `GetStandingsForUserAsync` so the caller's row in each of their leagues carries the same delta.

### Files

- `api/F1CompanionApi/Api/Models/MyLeagueStandingResponse.cs` — add `public int? PositionChange { get; set; }`. Null when there's no prior round to compare against (first scored round of the season, or the prior round simply has no standing record for this team).
- `api/F1CompanionApi/Api/Mappers/MyLeagueStandingResponseMapper.cs` — accept a `TeamLeagueStanding? priorStanding` parameter alongside the existing `latestStanding`, compute `PositionChange = priorStanding is not null && latestStanding is not null ? priorStanding.Position - latestStanding.Position : null`. Same formula as `LeagueStandingsBuilder.cs:43-45`.
- `api/F1CompanionApi/Domain/Services/LeagueStandingsService.cs:GetStandingsForUserAsync` — change the per-league lookup so it materializes all of the user's standings in the current season, then groups by league, picks the latest by round as `current`, and the standing with `round = current.Round - 1` as `prior`. Don't take "second-newest by ordering" — skipped rounds (team didn't score) must not be treated as the prior round. Pass both into the mapper. **Implementation note:** the method already `.ToListAsync()`s every one of the caller's current-season standings across all rounds and picks the latest in-memory (`LeagueStandingsService.cs:214-226`), so `prior` is already loaded — **no extra query**. The work is reshaping `latestByLeague` from `Dictionary<leagueId, single standing>` into per-league groups that expose both `current` and `prior`; a real restructure of that grouping, not a one-liner.
- `web/src/contracts/MyLeagueStanding.ts` — add `positionChange: number | null`.
- `web/src/components/Home/Home.tsx` — replace the placeholder `<div className="hidden md:block" />` in the desktop Move column with `<div className="hidden justify-center md:flex"><PositionDelta value={entry.positionChange} /></div>`. Under the league name, add a standalone `md:hidden` line containing `<PositionDelta value={entry.positionChange} variant="inline" />` (no leading text, no separator). Diverges from `Leaderboard.tsx:88-98` deliberately — Leaderboard's meta line carries `ownerName` because that's load-bearing context for a team row; Home's row already identifies the league in its name, so a teams-count or similar filler isn't worth a meta line.

### Tests

- `api/F1CompanionApi.IntegrationTests/Scenarios/MeStandingsTests.cs` — extend the existing `GetMyStandings_LeagueWithScoredRounds_*` case (or add a sibling) to seed two consecutive rounds with different positions for the caller, then assert `row.PositionChange == prior.Position - current.Position`. Add one more case asserting `PositionChange` is null when only one round has scored standings.
- `web/src/components/Home/Home.test.tsx` (**already exists, from Commit 4**) — the existing fixture must be updated. `Home.test.tsx:88-90` builds a `MyLeagueStanding[]` literal; adding the required `positionChange` field to the contract makes that literal a TS2741 error. `web:build` runs `tsc -b`, and `tsconfig.app.json` `include`s `src` (test files are type-checked) — so the **build fails** until the fixture carries `positionChange`. While there, optionally add a `PositionDelta` assertion to the existing leagues-list case; per `web/CLAUDE.md` the leaf is the right home for that render concern.
- Other frontend tests: no change. `root-routing.integration.test.tsx` keeps passing — its `/me/standings` handler returns `[]`, so no literal needs the new field; `positionChange` is a render concern, not a routing assertion.

### Design notes

- **Skipped rounds.** If a team scored in round 5 but not in round 4, the prior-round lookup at `round = current.Round - 1` returns null. The delta renders as a flat dash via `<PositionDelta value={null} />` (`PositionDelta.tsx:10`). That's the right behavior — comparing across a skipped round would misrepresent the user's actual movement.
- **`design-handoff.md` is stale for this list — follow the code, not the doc.** The handoff (`design-handoff.md:36`) describes a separate `components/Home/MyLeaguesList.tsx` and a 4-column mobile grid that keeps the Move column. Commit 4 actually built the leagues list inline in `Home.tsx` with a 3-column mobile grid (Pos / League / Pts) mirroring the real `Leaderboard.tsx`, where the delta sits inline under the name on mobile rather than in its own column. Commit 6's `PositionDelta` wiring follows the implemented `Home.tsx` / `Leaderboard.tsx` pattern.
- **No new endpoint.** Same URL, same shape extended by one field. Frontend reads it via the existing `getMyStandings()` service. No service-layer change on the frontend side beyond the contract addition.

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
