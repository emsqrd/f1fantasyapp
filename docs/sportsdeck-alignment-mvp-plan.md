# Re-Prioritized MVP Plan: SportsDeck Grand Prix Alignment

## Context

The original MVP plan targeted a fully custom scoring/rules system for Race 1 (March 6, 2026). With ~4 weeks remaining and significant features still unbuilt, the strategy is shifting to match SportsDeck Grand Prix's existing rules, scoring, and budgeting. This lets friends eventually migrate from SportsDeck to this site with familiar gameplay.

**Launch target:** As soon as possible. No hard deadline — Race 1 will be missed, and earlier race results can be entered retroactively.

**Key pivot:** Replace all custom rule design with SportsDeck's rules. Less design work, same implementation work.

---

## Phase 0: Data Collection (Before Any Coding)

Gather SportsDeck's exact rules and values. **This blocks everything else.**

- [ ] Document the exact scoring formula (race finish points, qualifying points, position change points, DNF penalties, etc.)
- [ ] Record every driver's current price/valuation
- [ ] Record every constructor's current price/valuation
- [ ] Confirm total budget cap amount
- [ ] Confirm transfer rules (how many free per race week? cost for extras?)
- [ ] Confirm lock timing (when does SportsDeck lock lineups relative to race?)
- [ ] Confirm constructor scoring (sum of drivers? separate?)
- [ ] Note how price changes work every 3 races (as much as you can observe)

---

## Phase 1: Driver/Constructor Selection UX Redesign

**Goal:** Redesign the picker experience so users have the data they need to make strategic decisions. This must be mobile-first since that's the primary way users will interact.

### Current State

- DriverListItem / ConstructorListItem: only show name + add button (no stats, no price, no performance data)
- DriverCard / ConstructorCard: name + placeholder avatar circle
- Sheet is 320px on desktop, 75% viewport on mobile
- All data-rich fields (`countryAbbreviation`, `fullName`) exist in the API response but aren't displayed

### What Users Need in the Selection Flow

- **Price/cost** (coming in Phase 2 with budget system)
- **Past performance** (results from previous races, once scoring exists)
- **Team affiliation** (which constructor a driver races for)
- **Enough context to compare options** and make strategic transfer decisions

### Approach (TBD - needs design exploration)

The current sheet (320px / 75% mobile) may be too cramped for the data users need. Options to explore:

- **Full-page picker:** A dedicated route/page for browsing drivers/constructors with room for stats, comparisons, and filtering
- **Enhanced bottom sheet:** Keep the sheet pattern but make it taller/wider with expandable rows or tabs for detail
- **Hybrid:** Keep quick-pick sheet for simple adds, link to a full market/browse page for deeper research

### Scope for This Phase

- Decide on the right picker pattern (consider prototyping with placeholder data)
- Redesign DriverListItem / ConstructorListItem to show more data
- Redesign DriverCard / ConstructorCard on the Team page (show relevant info, not just name)
- Ensure mobile-first: whatever pattern is chosen must work well on phone screens
- Build the UX shell that Phase 2 (budget) and Phase 4 (scoring/stats) will populate with real data

**Files:** `web/src/components/DriverPicker/DriverPicker.tsx`, `web/src/components/ConstructorPicker/ConstructorPicker.tsx`, `web/src/components/DriverCard/DriverCard.tsx`, `web/src/components/ConstructorCard/ConstructorCard.tsx`, `web/src/components/DriverListItem/DriverListItem.tsx`, `web/src/components/ConstructorListItem/ConstructorListItem.tsx`, `web/src/hooks/useLineupPicker.ts`

---

## Phase 2: Team Composition Constraints

**Goal:** Let friends draft real teams with meaningful budget constraints.

### 2a. Allow Duplicate Constructors

SportsDeck allows up to 2 of the same constructor on a team. Currently blocked by `TeamService.cs:246-251`.

- Remove the duplicate constructor check in `TeamService.AddConstructorToTeamAsync()`
- Add a "max 2 of same constructor" limit instead
- Update frontend `ConstructorPicker` to allow re-selection of already-picked constructors
- Update `useLineupPicker` pool filtering to allow duplicate constructors

**Files:** `api/.../Domain/Services/TeamService.cs`, `web/src/components/ConstructorPicker/`, `web/src/hooks/useLineupPicker.ts`

### 2b. Budget System

- Add `Price` (decimal) field to `Driver` and `Constructor` entities (migration)
- Seed all driver and constructor prices to match SportsDeck values
- Define budget cap constant (match SportsDeck)
- Backend: validate total team cost on add driver/constructor in `TeamService`
- Frontend: display prices in the redesigned picker (from Phase 1)
- Frontend: show remaining budget on Team page (replace hardcoded "$200k")
- Frontend: prevent over-budget selections (disable or warn)

**Files:** `api/.../Data/Entities/Driver.cs`, `api/.../Data/Entities/Constructor.cs`, `api/.../Domain/Services/TeamService.cs`, `web/src/components/Team/Team.tsx`, picker components from Phase 1

---

## Phase 3: Roster Locks + Lineup Snapshots

**Goal:** Lock teams before races and capture lineups for scoring and historical views.

### 3a. Roster Lock Enforcement

The `Race` entity already has a `LockDeadline` field. Need to enforce it.

- Populate `LockDeadline` for all 2026 races (match SportsDeck's lock timing)
- Backend: in `TeamService` add/remove methods, determine "current race" and check if lock deadline has passed; reject changes if locked
- Frontend: check lock status, disable add/remove buttons, show lock countdown on Team page

**Files:** `api/.../Domain/Services/TeamService.cs`, `api/.../Data/Entities/Race.cs`, `web/src/components/Team/Team.tsx`, `web/src/components/DriverPicker/`, `web/src/components/ConstructorPicker/`

### 3b. Lineup Snapshots (Core Feature)

Lineup snapshots are essential for: scoring (know what team was at lock time), transfer counting (Phase 5 compares current roster to snapshot), and historical views (show "what was my team for Race 3?").

- New `TeamRaceLineup` entity (teamId, raceId, snapshot of drivers + constructors at lock time)
- Automatic or manually-triggered snapshot of all teams' lineups at lock deadline
- Scoring engine (Phase 4) reads from snapshots, not current team composition
- Transfer system (Phase 5) uses snapshot as baseline for counting net changes

**Files:** New entity + migration, new service/endpoint

---

## Phase 4: Scoring Engine

**Goal:** Calculate points from race results and update leaderboard. Race results can be seeded directly in the database — admin UI comes later (Phase 7).

### 4a. Race Results Data Model

- New entities: `DriverRaceResult` (driverId, raceId, gridPosition, finishPosition, status, fastestLap, etc.)
- Constructor results derived from their drivers (no separate entity needed if SportsDeck works that way)
- `TeamRaceScore` entity (teamId, raceId, totalPoints, optional breakdown)

### 4b. Scoring Service

- Implement SportsDeck's scoring formula
- Calculate points per driver from `DriverRaceResult`
- Calculate constructor points (sum of their drivers' points, or per SportsDeck rules)
- Calculate team score from lineup snapshot + individual results
- Store cumulative scores

### 4c. Leaderboard + Team Page Updates

- Update leaderboard query to sort by cumulative points
- Show points column on leaderboard
- Update Team page to show actual round results (replace hardcoded "1st" and "679")

**Entering results for now:** Seed `DriverRaceResult` rows directly in the database after each race. Admin UI in Phase 7.

**Files:** New entities + migrations, new `ScoringService`, update `web/src/components/Leaderboard/`, `web/src/components/Team/Team.tsx`

---

## Phase 5: Transfer System

**Goal:** Track and limit team changes between races.

- Transfers are counted as **net changes from the start-of-week roster**, not individual swap operations. If you swap Driver A for B and then swap B back for A, no transfer was used (you're back to your original lineup).
- The lineup snapshot from Phase 3b serves as the "start of week" baseline for counting transfers
- Logic to compare current roster vs snapshot and count differences
- Distinguish "initial draft" (unlimited, pre-season) from "race week transfers" (limited)
- Backend: compare current team to race-week snapshot to determine transfers used, enforce limit
- Backend: validate budget on transfers (new player must fit budget)
- Frontend: show remaining transfers (replace hardcoded "3/3") based on diff from snapshot
- Frontend: prevent changes when transfer limit reached
- Frontend: show warning on last transfer

**Files:** `api/.../Domain/Services/TeamService.cs`, `web/src/components/Team/Team.tsx`

---

## Phase 6: Price Changes

**Goal:** Update driver/constructor valuations every 3 races.

- For MVP: update `Price` field in place via database (no history tracking needed yet)
- Display price changes to users (optional for MVP — can just update silently)
- Reverse engineer SportsDeck's revaluation formula as you observe it over races

**Files:** `api/.../Data/Entities/Driver.cs`, `api/.../Data/Entities/Constructor.cs`

---

## Phase 7: Admin UI

**Goal:** Build admin interfaces so you don't have to seed data directly in the database.

- Add `IsAdmin` boolean to `UserProfile` entity; seed yourself as admin via migration
- Add authorization policy check for admin endpoints
- Admin page to enter race results (basic form: driver finishing positions, grid positions, DNF status)
- Trigger scoring calculation after results entry
- Admin endpoint/page to update driver/constructor prices
- Keep it functional, not pretty

**Files:** New admin endpoints + pages, `api/.../Data/Entities/UserProfile.cs`

---

## What's Deferred (Post-MVP)

- Points history / per-race breakdown view
- Commissioner tools (remove teams, lock leagues)
- Price change history tracking
- Notifications
- Email invites
- Layout/design polish
- Advanced transfer features (paid transfers, wildcards)

---

## Verification Plan

After each phase, verify end-to-end:

1. **Phase 1:** Verify redesigned picker works on mobile and desktop, shows relevant data, and the selection flow is intuitive
2. **Phase 2:** Create a team, confirm prices display correctly, confirm budget enforced, confirm duplicate constructors work (up to 2 same)
3. **Phase 3:** Confirm team editing disabled after lock deadline, confirm lineup snapshot captured correctly
4. **Phase 4:** Seed mock race results in DB, trigger scoring, verify leaderboard sorted by points
5. **Phase 5:** Make transfers between races, confirm net-change counting works correctly, confirm limit enforced
6. **Phase 6:** Update prices in DB, confirm reflected in picker and budget calculations
7. **Phase 7:** Enter race results via admin UI, verify scoring triggers correctly

**Run tests after each phase:** `npm run test:all`
