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

## Commit 6 — Add `PositionChange` to `MyLeagueStandingResponse` + refactor the My Leagues section

Commit 4 shipped the Home leagues list as a points-oriented table (Pos / League / Move / Pts) with the Move column rendering empty, because the `/me/standings` endpoint from #205 didn't include `positionChange`. This commit reframes the section around what's actually useful at a glance: **per-league position and how it's moving**, not points. Points are near-identical across a user's leagues (they only diverge when a user joins a league mid-season), so a points column is redundant noise here.

New row shape — two columns:

- **Left (`1fr`)** — league name, with a `{Public|Private} · Total teams: {totalTeams}` meta line stacked underneath.
- **Right (`auto`)** — the position number, with the change indicator inline to its right. The indicator shows **only** when `positionChange` is a non-zero number; when the change is flat or unknown, nothing renders (no placeholder dash).

No points column, no separate Move column, no chevron. The row stays a clickable `Link` to `/league/$leagueId`. The `grid-cols-[1fr_auto]` column layout is constant across breakpoints, but the row *chrome* keeps the established responsive treatment — card-per-row on mobile (border, rounded, `bg-card`), borderless table rows inside a bordered container on desktop (`md:` prefixes), matching `Leaderboard.tsx` and the list that shipped in Commit 4.

The data already exists at the league level: `LeagueStandingsBuilder.Build` computes `prior.Position - current.Position` per team using the leaderboard at round `N` and round `N-1`. Mirror that calculation in `GetStandingsForUserAsync` so the caller's row in each of their leagues carries the same delta.

### Files

- `api/F1CompanionApi/Api/Models/MyLeagueStandingResponse.cs` — add `public int? PositionChange { get; set; }` (null whenever the team has only one scored round in the league — the season opener, a league that started mid-season, or the round the team joined an existing league — so there's no prior round to compare against) and `public required bool IsPrivate { get; set; }`.
- `api/F1CompanionApi/Api/Mappers/MyLeagueStandingResponseMapper.cs` — accept a `TeamLeagueStanding? priorStanding` parameter alongside the existing `latestStanding`, compute `PositionChange = priorStanding is not null && latestStanding is not null ? priorStanding.Position - latestStanding.Position : null` (same formula as `LeagueStandingsBuilder.cs:43-45`), and set `IsPrivate = membership.League.IsPrivate`. The `League` navigation is already loaded — the mapper reads `membership.League.Name` today — so `IsPrivate` costs no extra query.
- `api/F1CompanionApi/Domain/Services/LeagueStandingsService.cs:GetStandingsForUserAsync` — change the per-league lookup so each group, ordered by round descending, yields the latest standing as `current` and the next one as `prior`. Once a team is in a league it persists a standing every subsequent round, so its standings are contiguous and the second-newest *is* the round before `current` — no gap arithmetic needed. `prior` is null when the team has only one scored round in that league. Pass both into the mapper. **Implementation note:** the method already `.ToListAsync()`s every one of the caller's current-season standings across all rounds and picks the latest in-memory (`LeagueStandingsService.cs:214-226`), so `prior` is already loaded — **no extra query**. The work is reshaping `latestByLeague` from `Dictionary<leagueId, single standing>` into per-league groups that expose both `current` and `prior`; a real restructure of that grouping, not a one-liner.
- `web/src/contracts/MyLeagueStanding.ts` — add `positionChange: number | null` and `isPrivate: boolean`.
- `web/src/components/Home/Home.tsx` — rebuild the league row from the current 3/5-column grid to `grid-cols-[1fr_auto]`. Left cell: league name (truncate) over a `{entry.isPrivate ? 'Private' : 'Public'} · Total teams: {totalTeams}` meta line (`text-muted-foreground`, smaller). Right cell: the position number then the change indicator to its right (`{entry.position ?? EM_DASH}{hasChange && <PositionDelta value={entry.positionChange} variant="inline" />}`), where `hasChange = entry.positionChange != null && entry.positionChange !== 0`. Drop the points column, the Move column, the chevron column, and both the mobile and desktop column-header rows (a two-column league/position list reads without headers). Update the `rowBase` grid template to `grid-cols-[1fr_auto]` and fix up the `aria-label`. Keep the `rowChrome` responsive card/table treatment as-is (it's column-count-agnostic) and the empty-state guard (`standings.length === 0` renders nothing).
  - **Why gate the indicator instead of letting `PositionDelta` render its flat state** — `PositionDelta`'s flat/null branch renders an en-dash `–` (`PositionDelta.tsx:19-30`). That's right for Leaderboard, where every row has a Move column to fill, but here we want no-change rows to stay quiet. Gate the render in `Home.tsx`; don't change `PositionDelta` (Leaderboard still depends on the dash).

### Tests

- `api/F1CompanionApi.UnitTests/Api/Mappers/MyLeagueStandingResponseMapperTests.cs` (new) — owns the delta arithmetic + null-guard, the lowest layer that sees them. Follow `TeamSummaryResponseMapperTests.cs`: feed the mapper pre-selected `latestStanding`/`priorStanding` and assert `PositionChange` is `prior.Position - current.Position` when both present, null when `priorStanding` is null, and null when `latestStanding` is null. Pure, no DB.
- `api/F1CompanionApi.IntegrationTests/Scenarios/MeStandingsTests.cs` — this layer owns the **selection**, not the arithmetic (the mapper unit test covers that). Extend the existing `GetMyStandings_LeagueWithScoredRounds_*` case (or add a sibling) to seed **three** consecutive rounds for the caller — two rounds can't distinguish "prior = round N-1" from "prior = oldest" or "prior = N-2", so they can't catch a mis-selection. Assert the returned `PositionChange` reflects round N vs N-1 (i.e. the second-newest standing, not the third). For extra confidence that the season filter holds, seed a standing in a different season and confirm it's ignored. Add a case asserting `PositionChange` is null when the team has only one scored round in the league — this proves the *service* yields a null prior (a selection concern), distinct from the mapper's null→null mapping. Assert `IsPrivate` reflects the seeded league's privacy on one existing case — one assertion is enough; it's a straight field passthrough that also confirms the `League` Include is loaded.
- `web/src/components/Home/Home.test.tsx` (**already exists, from Commit 4**) — the existing fixture must be updated. The leagues-list case builds a `MyLeagueStanding[]` literal; adding the required `positionChange` and `isPrivate` fields to the contract makes that literal a TS2741 error. `web:build` runs `tsc -b`, and `tsconfig.app.json` `include`s `src` (test files are type-checked) — so the **build fails** until the fixture carries both fields. Replace the points assertion (no longer rendered) with assertions for the new shape: the `{Public|Private} · Total teams: N` meta line renders (cover both privacy values across the fixture's rows); a non-zero `positionChange` renders the indicator (assert by its `aria-label`, e.g. `Up 2 positions`); a `positionChange` of `0` or `null` renders **no** indicator (assert the `No position change` label is absent). Per `web/CLAUDE.md` the leaf is the right home for these render concerns.
- Other frontend tests: no change. `root-routing.integration.test.tsx` keeps passing — its `/me/standings` handler returns `[]`, so no literal needs the new field; the row shape is a render concern, not a routing assertion.

### Design notes

- **`design-handoff.md` is stale for this list — follow the code, not the doc.** The handoff (`design-handoff.md:36`) describes a separate `components/Home/MyLeaguesList.tsx` and a points-bearing grid that keeps a Move column. This commit takes the list a different way: a two-column league/position layout with the change folded into the position cell. Build to this plan, not the handoff.
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
