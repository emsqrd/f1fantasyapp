# F1 Fantasy App - MVP Feature Prioritization

## Current State Summary

**What Works:**

- Team creation (one per user, 5 driver slots, 2 constructor slots)
- League creation and joining (public/private with invite links)
- Basic leaderboard (lists teams but no real scoring)
- Driver/constructor selection interface
- Team ownership tracking in backend

**What's Missing:**

- All scoring-related functionality (hardcoded UI placeholders)
- Race schedule system (hardcoded rounds)
- Budget/salary cap system
- Team roster locks before races
- Differentiation between "my team" (edit mode) vs "viewing other teams" (read-only)

## MVP Definition

**Goal:** A functional fantasy F1 game playable with friends for the 2026 season starting March 6, 2026.

**Timeline:** 5-6 weeks (late January to early March 2026)

**Core Gameplay Loop:**

1. User creates a team with constrained driver/constructor selection (budget limit)
2. User submits lineup before race deadline (with 3 free transfers per race week)
3. Race results are entered manually by admin → points calculated automatically
4. Leaderboard updates with scores
5. User can make changes before next race (within budget/trade limits)

**Confirmed Requirements:**

- **Scoring System:** Custom (finishing position + qualifying bonus + position gained/lost)
- **Budget System:** Need to research and assign realistic driver/constructor costs
- **Transfers:** 3 free transfers per race week (must track usage)
- **Race Results:** Manual admin entry interface

## Feature Prioritization

### 🔴 CRITICAL (Must Have for MVP) - Blocking Launch

These features are required for basic gameplay. Without them, there's no functioning game.

#### 1. Race Schedule System ⭐ **START HERE**

**Why Critical:** Need to know what races exist and when they happen for scoring.

**Scope:**

- Create `Race` entity (round number, name, location, date, status: upcoming/in-progress/completed)
- Import 2026 F1 calendar (24 races)
- UI to display race schedule
- Replace hardcoded race selector with real data

**Backend Tasks:**

- Database migration for `Race` table
- API endpoints: GET races, GET race by ID
- Seed 2026 race schedule

**Frontend Tasks:**

- Create race service
- Update Team component to use real race data
- Add race schedule page (optional but nice)

**Priority:** Do this FIRST - everything else depends on it.

---

#### 2. Scoring Engine ⭐ **CRITICAL**

**Why Critical:** This IS the game. Without scoring, there's no competition or purpose.

**Scope:**

- Race results data model (driver finishing positions, constructor points)
- Points calculation system (define scoring rules)
- Automated score calculation after race completion
- Display team points on leaderboard

**Backend Tasks:**

- Database migration for `RaceResult` and `TeamScore` tables
- API endpoint to submit race results (admin only)
- Points calculation service
- Update league leaderboard endpoint to include scores sorted by rank

**Frontend Tasks:**

- Update Leaderboard to show points column
- Update Team page to show actual points (not hardcoded)
- Admin interface to enter race results (can be basic for MVP)

**Custom Scoring Rules (Confirmed):**

- **Finishing Position:** Base points for race finish (standard F1: 25-18-15-12-10-8-6-4-2-1)
- **Qualifying Bonus:** Extra points for strong qualifying performance (e.g., +3 pole, +2 P2, +1 P3)
- **Position Gained/Lost:** Points for overtaking (+2 per position), penalty for losing positions (-1 per position)

**Open Question:** Do constructors score based on their drivers' combined performance, or do we track constructor-specific results separately?

**Priority:** Implement immediately after race schedule.

---

#### 3. Team Roster Locks/Deadlines ⭐ **CRITICAL**

**Why Critical:** Users must not be able to change lineups after race starts. This is fundamental to fantasy sports integrity.

**Scope:**

- Add `lockDeadline` field to Race table
- Backend validation: prevent team changes after deadline
- Frontend: disable editing after deadline
- Show countdown to deadline on Team page

**Backend Tasks:**

- Update team modification endpoints to check lock status
- Return `isLocked` status with team data

**Frontend Tasks:**

- Display lock status on Team page
- Disable add/remove buttons when locked
- Show countdown timer to deadline
- Show "Locked" state clearly

**Priority:** Must have before first real race.

---

#### 4. Driver/Constructor Budget System ⭐ **CRITICAL**

**Why Critical:** Without budget constraints, everyone will pick the same top drivers. No strategy = boring game.

**Scope:**

- Add `salary`/`cost` field to Drivers and Constructors
- Define total team budget (e.g., $100M)
- Backend validation: enforce budget cap
- Frontend: show remaining budget, prevent over-budget selections

**Backend Tasks:**

- Database migration to add cost fields
- **Research and assign realistic costs** to all drivers/constructors based on:
  - 2025 season performance (race wins, podiums, points)
  - Team tier (top team vs midfield vs backmarker)
  - Driver reputation/experience
- Update team modification endpoints to validate budget
- Return budget info with team data

**Cost Assignment Strategy:**

- Tier 1 (Championship contenders): $25-30M (Verstappen, Norris, Leclerc)
- Tier 2 (Strong midfield): $15-20M (Russell, Piastri, Sainz)
- Tier 3 (Experienced midfield): $10-15M (Hamilton, Alonso, Gasly)
- Tier 4 (New/backmarker): $5-10M (rookies, lower teams)
- Constructors: Top teams $20-25M, Midfield $12-18M, Backmarkers $8-12M
- **Total budget:** $100M (enough for mix of tier 1/2 drivers + constructors)

**Frontend Tasks:**

- Update Driver/Constructor drawers to show costs
- Update Team page to show actual remaining budget (not hardcoded $200k)
- Prevent selections that exceed budget
- Show visual feedback for budget status

**Priority:** Implement before or alongside scoring engine.

---

#### 5. My Team vs Other Team Views ⭐ **HIGH PRIORITY**

**Why Critical:** Users need to edit their own team but only view others. Currently all teams show same editable interface.

**Scope:**

- Create separate routes: `/my-team` (edit mode) and `/team/$teamId` (read-only)
- Backend already validates ownership - just need frontend separation
- Different UI states based on ownership

**Implementation Options:**

- **Option A:** Two separate routes (`/my-team` and `/team/$teamId`)
- **Option B:** Single route with conditional rendering based on ownership check
- **Recommendation:** Option A is clearer UX

**Frontend Tasks:**

- Create `/my-team` route (redirects to create team if none exists)
- Make `/team/$teamId` read-only (remove add/remove controls)
- Update navigation to show "My Team" link
- Update leaderboard links to point to read-only view

**Priority:** High - needed for security and UX clarity.

---

### 🟡 IMPORTANT (Should Have for MVP) - Enhances Experience

These features significantly improve the game but you could technically launch without them.

#### 6. Weekly Trade/Transfer System ⭐ **REQUIRED FOR MVP**

**Why Important:** Confirmed requirement. Users get 3 free transfers per race week to adjust lineup.

**Confirmed Rules:**

- **3 free transfers per race week** (can change up to 3 drivers/constructors)
- Transfers reset each race week
- Transfers consumed when swapping a player in/out
- Must stay within budget when making transfers

**Scope:**

- Track transfers used per team per race
- Backend validation: prevent more than 3 transfers per race
- Update Team page to show actual transfer count (replace hardcoded "3/3")
- Reset transfer count when new race week starts

**Backend Tasks:**

- Database table: `TeamRaceTransfers` (teamId, raceId, transfersUsed)
- API endpoint: Check remaining transfers before allowing add/remove
- Automatically reset transfers when race status changes to completed

**Frontend Tasks:**

- Display "Transfers: X/3" with real data
- Show warning when using last transfer
- Prevent changes when 3 transfers exhausted
- Show transfer history (optional: which transfers were made)

---

#### 7. Commissioner Tools - Expanded

**Why Important:** League owners need control, especially for private leagues with friends.

**Scope:**

- Edit league details (name, description)
- Remove teams from league
- Lock/unlock league (prevent new joins)
- View league settings

**Current State:** Can create leagues and generate invite links.

**MVP Scope:** Just add ability to remove teams (for bad actors).

**Post-MVP:** Full admin dashboard with settings.

---

### 🟢 NICE TO HAVE (Post-MVP) - Polish & Enhancements

These can wait until after initial launch.

#### 8. Email Invite System

**Current State:** Shareable invite links work well.

**Recommendation:** Skip for MVP. Links are sufficient for playing with friends.

---

#### 9. General Layout Improvements (League & Team pages)

**Recommendation:** Functional layouts exist. Polish after launch based on user feedback.

---

#### 10. Driver/Constructor Drawer UX Improvements

**Recommendation:** Current drawers work. Show cost when budget system is added. Save major redesign for post-MVP.

---

## Missing Features Not Mentioned

### 🔴 CRITICAL ADDITIONS:

#### Points History/Past Results

**Why Needed:** Users need to see how they scored in previous races.

**Scope:**

- View past race results
- See points breakdown by race
- Historical leaderboard snapshots

**Priority:** Add after core scoring works. Not needed for race 1 but needed by race 3-4.

---

#### Admin/Commissioner Race Result Entry

**Why Needed:** Someone needs to enter race results to trigger scoring.

**Scope:**

- Secure admin interface
- Form to enter finishing positions
- Trigger scoring calculation

**Priority:** Build alongside scoring engine.

---

### 🟡 NICE TO HAVE ADDITIONS:

#### Notifications

- Race starting soon
- Lineup deadline approaching
- Scores updated

**Recommendation:** Post-MVP. Manual checks are fine for friends league.

---

#### Mobile Responsive Design

**Current State:** Check if existing UI works on mobile.

**Recommendation:** Test and fix major issues before launch but don't need perfect mobile UX for MVP.

---

## Recommended Implementation Order

**Timeline:** 5-6 weeks to March 6, 2026 (Round 1: Australia)

### Phase 1: Core Data Foundation (Week 1-2)

1. ✅ Race schedule system (database + API + seed 2026 calendar)
2. ✅ Driver/constructor cost assignment (research 2025 performance + assign realistic costs)
3. ✅ Budget enforcement (backend validation + frontend display)
4. ✅ Roster locks/deadlines (prevent changes after race starts)

### Phase 2: Gameplay Mechanics (Week 2-3)

5. ✅ Scoring engine with custom rules (finish position + qualifying + position change)
6. ✅ Admin race result entry interface (manual input of results)
7. ✅ Points calculation service
8. ✅ Leaderboard scoring display (sort by cumulative points)

### Phase 3: Transfers & UX (Week 3-4)

9. ✅ Transfer system (3 free per race, tracking, validation)
10. ✅ My Team vs Other Team routes (separate edit/view modes)
11. ✅ Team page real data (remove all hardcoded placeholders)
12. ✅ Points history view (see past race breakdowns)

### Phase 4: Polish & Launch Prep (Week 4-5)

13. ✅ Basic commissioner tools (remove teams from league)
14. ✅ End-to-end testing with sample races
15. ✅ Mobile responsiveness fixes
16. ✅ Load complete 2026 calendar with lock deadlines
17. ✅ User acceptance testing with friends
18. ✅ Final production deployment

---

## Remaining Open Questions

### 1. Constructor Scoring Logic

**Question:** How should constructors score points?

**Options:**

- **Option A:** Constructors score based on their drivers' combined performance
  - Example: Mercedes scores = Hamilton points + Russell points
  - Simple to implement, mirrors real F1 constructor standings
- **Option B:** Track constructor-specific results separately
  - Example: Constructors have their own finishing positions in race
  - More complex, not sure how this would work in reality

**Recommendation:** Use Option A (sum of drivers' points) as it aligns with real F1 and is simpler to implement and understand.

---

### 2. Roster Lock Timing

**Question:** When should lineups lock before each race?

**Options:**

- Lock at race start time (lights out)
- Lock 1 hour before race
- Lock at qualifying start (Saturday)
- Lock Friday before FP3 (early deadline, more strategic)

**Recommendation:** Lock 1 hour before race start to give users flexibility but prevent last-second changes based on grid positions.

---

### 3. Exact Point Values for Custom Scoring

**Question:** What are the exact point values for each scoring category?

**Proposed Values (for review):**

- **Finishing Position:** 25-18-15-12-10-8-6-4-2-1 (standard F1)
- **Qualifying Bonus:** +3 (pole), +2 (P2), +1 (P3)
- **Position Change:** +2 per position gained, -1 per position lost
- **DNF Penalty:** -5 points (didn't finish race)

**Need Confirmation:** Do these values feel balanced?

---

## What Can Be Deferred to Post-MVP

- Email invites (links work fine)
- Advanced commissioner tools (full admin dashboard)
- Layout redesigns
- Drawer UX overhaul
- Weekly transfer limits (can start unlimited)
- Notifications
- Historical season data
- Mobile app
- Real-time race updates
- Social features (comments, trash talk)

---

## Final Summary & Next Steps

### Critical Path to MVP (Must Complete)

**Phase 1 - Foundation (Weeks 1-2):**

1. ✅ Race schedule system + seed 2026 calendar
2. ✅ Driver/constructor cost assignment (research + implement)
3. ✅ Budget system with $100M cap + validation
4. ✅ Roster lock system (1hr before race start)

**Phase 2 - Core Gameplay (Weeks 2-3):** 5. ✅ Custom scoring engine (finish + qualifying + position change) 6. ✅ Admin race result entry interface 7. ✅ Points calculation + leaderboard updates 8. ✅ Transfer system (3 free per race)

**Phase 3 - UX & Polish (Weeks 3-5):** 9. ✅ My Team vs Other Team views 10. ✅ Remove hardcoded data from Team page 11. ✅ Points history view 12. ✅ Basic commissioner tools 13. ✅ Testing + launch prep

### Scope Confirmed

- **Timeline:** 5-6 weeks to March 6, 2026
- **Scoring:** Custom (finish position + qualifying bonus + position gained/lost)
- **Budget:** $100M total, tiered driver/constructor costs
- **Transfers:** 3 free per race week
- **Admin:** Manual race result entry

### Features Explicitly Deferred Post-MVP

- Email invites (shareable links sufficient)
- Advanced commissioner dashboard
- Layout/design overhauls
- Notification system
- Mobile app
- Unlimited transfers option
