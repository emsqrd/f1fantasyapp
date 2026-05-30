# Home Page — Design Handoff

> Drop this folder into a Claude Code session, or attach `home-page-designs.html` and this `.md` together. The HTML is a self-contained working prototype; the agent can open it, inspect the DOM, read the JSX, and lift values directly.

## What this is

The authed landing page for `/`. Unauthed users keep getting the marketing landing; authed users land here and use it as the canonical post-login destination (per the PRD, the redirect target for every flow in #199).

**This is a single responsive design**, not separate desktop and mobile components. The prototype's two artboards ("Desktop · 1280" and "Mobile · 390") render the same component at different viewport widths to demonstrate how it adapts.

> **As-built divergence (#207 / #208).** The three-component split described below — `HomeNoTeam`, `HomeNoLeagues`, and "decide in the route, render the right component" — was not built. `Home` is a single presentational component that conditionally renders different child components based on `team` / `standings`. The route component was renamed `IndexRoute` and only switches anon → `LandingPage` vs authed → `Home`. The no-team next-race card is the same unified `NextRaceCard` as the full state, not a separate compact variant. Where this handoff disagrees with the issues or code, follow the issues and code.

## Route + data

- **Path:** `/` (only when authed; existing landing page stays for anon)
- **Layout:** `Layout.tsx` (existing sidebar shell). No new layout needed.
- **New sidebar item:** `Home` with the `Home` icon from `lucide-react`, **pinned at the top** of the nav list ahead of `My Team`. Only shown when authed. Active when `currentPath === '/'`.
- **Loader data (3 parallel reads):**
  - `getMyTeam()` — `Team | null` from `teamService`. Drives the team identity heading and the partial-state branching.
  - `getCurrentSeasonRaces()` — array of `RaceWeekend`. The card finds `races.find(r => !r.isCurrent && new Date(r.raceDate) > now)` or falls back to the last one, same logic as `Team.tsx`.
  - `getSeasonSummaryForTeam(teamId)` — `{ seasonTotalPoints, racesScored }`. Cumulative points across the season (captain multiplier already applied per race).
  - `getLastRaceSummaryForTeam(teamId)` — `{ raceWeekendId, round, raceName, totalScore }`. The most recent scored race.
  - `getMyLeagues()` — existing call. Each entry needs `{ id, name, myPosition, myTotalPoints, myPositionChange, totalTeams }`. The standings service already exposes per-league standings; the home page just needs the user's row from each.
- **Partial state branching** (decide in the route, render the right component):
  - `team == null` → `<HomeNoTeam />`
  - `team != null && leagues.length === 0` → `<HomeNoLeagues />`
  - otherwise → `<Home />`

## Components to add

| File | Notes |
| --- | --- |
| `components/Home/Home.tsx` | Main authed-home composition. Single responsive layout — no separate mobile component. See "Screen anatomy" below. |
| `components/Home/HomeNoTeam.tsx` | Empty state — no team yet. |
| `components/Home/HomeNoLeagues.tsx` | Empty state — team exists, no leagues. |
| `components/Home/NextRaceCard.tsx` | Race hero with countdown. Reuse the lock-deadline logic from `Team.tsx` lines 65–95 (the `useEffect` ticker + `lockDisplay` formatting). Factor that into a `useLockCountdown(deadlineMs)` hook in `hooks/`. |
| `components/Home/ScoreCard.tsx` | Reusable card for the two score summaries. Props: `eyebrow`, `title`, `score`, `unit?`. Renders the eyebrow + title on the left and the mono tabular-nums score on the right. The two instances (Last race / Season) sit side-by-side on desktop, stacked on mobile. |
| `components/Home/MyLeaguesList.tsx` | **Reuses the layout from `Leaderboard.tsx`** — same 5-column grid header (`[52px_1fr_70px_96px_36px]`), same secondary-bg uppercase header row, same `PositionDelta` component, same mono tabular-nums treatment, same chevron. At `< md` it switches to a 4-column grid (no chevron column) and the header row is hidden — see the prototype's `LeaguesList` for the exact responsive class set. |

## Responsive approach

- **One component per state, responsive via Tailwind `md:` prefixes.** No separate `*.mobile.tsx` files.
- The prototype uses `cmd:` (container-query variant) because the design-canvas tool scales artboards with CSS transforms, so viewport media queries can't distinguish between artboards. **In the real app, replace every `cmd:` with `md:`** — your app uses actual viewports, so plain Tailwind media queries are correct.
- The `md:` breakpoint (768px) is the only one used. The layout flips between two states: ≥ 768 = desktop layout (sidebar visible, content side-by-side where applicable); < 768 = mobile layout (sidebar hidden, content stacked).

## Screens

### 1 · Full state (the happy path)

Top to bottom:

1. **Identity header** — `<p>` "Welcome back, {firstName}" at `text-[12px] md:text-[13px] text-muted-foreground`, then `<h2>` with the team name at `text-[22px] md:text-[26px] font-bold tracking-tight truncate`. No inline action button — navigation to "My Team" lives in the sidebar (and the hamburger menu at `< md`).
2. **Next-race hero** — full-width card. At `md:` it's two columns: left has the `RoundEyebrow` (`Round {round} · Next up`), the race name as `text-[22px] md:text-[32px] font-bold tracking-tight`, and the location + date in `text-muted-foreground text-[12px] md:text-[13px]` with `MapPin` and `Calendar` icons (`size-3.5`). Right column has a small uppercase "Lineup locks in" label (`text-[10px] font-medium tracking-[0.18em]`) and a `font-mono tabular-nums text-[24px] md:text-[34px] font-bold` countdown lockup of `Dd HHh MMm` (the `d`/`h`/`m` suffixes are `text-muted-foreground` and smaller). At `< md`, the layout stacks: race info on top, countdown below with a `border-t border-border` divider. **No background imagery. No gradient.**
3. **Score summary** — **two independent cards** side-by-side on desktop (`grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3`), stacked at `< md`. Each card has:
   - Small uppercase eyebrow on the left: `LAST RACE STATS` / `SEASON STATS` (`text-[10px] md:text-[11px] font-semibold tracking-[0.12em] uppercase`).
   - A title below the eyebrow: the race name (`Canadian Grand Prix`) on the Last race card, the word `Total` on the Season card. Same `text-[16px] md:text-[18px] font-bold tracking-tight` treatment.
   - Big mono tabular-nums score on the right (`text-[24px] md:text-[28px] font-bold`) with a smaller muted `pts` suffix.
   - **Two separate cards, not one divided card.** Last race (a single event) and Season totals (a cumulative summary) aren't comparable data — they're two parallel summaries. A shared divider implies "compare these"; two separate cards reads as "two informational snapshots".
4. **My leagues** — section heading `<h3>My leagues</h3>` as a real heading (`text-[16px] md:text-[18px] font-bold tracking-tight`) + "View all →" link in primary. Then the Leaderboard-style table.

### 2 · No team yet

- "Welcome, {firstName}" `<h2>` at `text-[22px] md:text-[26px] font-bold tracking-tight`. No team name to show, no eyebrow above the welcome.
- **Create-team hero** — solid border card (no dashed treatment at hero scale; dashed reads as "this card is broken" rather than "empty slot"). Stacks on mobile, two-column at `md:`: headline "You don't have a team yet" + supporting copy on the left, **Create team** primary button (`size="lg"`) on the right. Mobile: button is full-width below the copy. No icon on the button.
- **Next race info card** — same general content as the full-state hero but compact: title + location + date on the left, "Locks in" countdown (just `Dd HHh MMm` text, no decorative spans) on the right. Smaller typography throughout — race name at `text-[16px] md:text-[18px]`, countdown at `text-[20px] md:text-[22px]`. Stacks on mobile with a `border-t` separator above the countdown. **No Manage Team button** — the user can't act on this until they have a team.
- **Leagues area is gated**: dashed-border card with `Users` icon (`size-6`), `<h4>Create a team to join leagues</h4>` at `text-[18px] font-semibold`, small explanatory paragraph at `text-[13px]`.

### 3 · Team but no leagues

- Identity header (same eyebrow + team-name heading as the full state).
- Same next-race hero as the full state.
- Same two-card Score summary as the full state.
- **Leagues empty state** — dashed-bordered card with `Users` icon (`size-6`), `<h4>You're flying solo</h4>` at `text-[18px] font-semibold`, "Join a league to see how your team ranks against friends and the wider community" paragraph at `text-[13px]`, then two CTAs: **Create a league** (outline, with `Plus` icon) and **Browse public** (primary, with `Search` icon). CTAs are full-width stacked on mobile, side-by-side at `md:`.

## Design tokens — already in `src/index.css`

Nothing new required. The prototype lifts these verbatim:

- Colors: `--primary` (`#1447e6` light / `#2b7fff` dark), `--card`, `--border`, `--secondary`, `--muted-foreground`, `--accent`
- Position deltas: `--delta-up-fg`, `--delta-down-fg`, `--delta-flat-fg`
- Radius: `--radius` (`0.65rem`)

## Vocabulary lifted from existing components

- **Round eyebrow** — exact treatment from `LeaderboardHeader.tsx` line 26: `text-[12px] font-semibold tracking-[0.14em] uppercase` colored with `color-mix(in oklab, var(--primary) 70%, var(--muted-foreground))`.
- **Card eyebrow style** — small uppercase tracked labels (`text-[10px] md:text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground`). Reused for "Last race stats" and "Season stats".
- **List rows** — `Leaderboard.tsx` lines 11–18, both the grid template and the desktop header-row treatment. The home page leagues list reuses this layout exactly at `md:`, and degrades to a 4-column grid (no chevron) with the header row hidden at `< md`.
- **Empty card** — matches `Empty` / `EmptyHeader` / `EmptyTitle` / `EmptyDescription` from `ui/empty.tsx`. Dashed border + centered text + icon. The "no leagues" CTA pair uses the same composition.
- **Lock countdown logic** — replicated from `Team.tsx` lines 65–95. Factor it out into `hooks/useLockCountdown.ts` so the home page, the team page, and any future race-week surface share one implementation.

## Copy decisions

- **Identity header**: "Welcome back, {firstName}" eyebrow + team name as the h2. Greeting is friendly fluff above; team name is the actual page anchor. No action button — sidebar nav does this job.
- **Score card titles**: `Last race stats` eyebrow with the race name as the title (`Canadian Grand Prix`); `Season stats` eyebrow with `Total` as the title. The two cards are not symmetric in content (one names an event, the other doesn't) and shouldn't be forced into parallel content just because they share visual structure.
- **No-team hero**: "You don't have a team yet" / "Pick 5 drivers and 2 constructors with a $100.0M budget. Set a captain to earn 2× points on their race score." (Budget mention here is **rule-setting** for the new user, not a status readout.)
- **No-leagues hero**: "You're flying solo" / "Join a league to see how your team ranks against friends and the wider community."

## Things deliberately NOT on the page

- **Top scorers row inside each score card.** An earlier iteration showed the user's top-scoring driver and constructor (last race + season) as a credit line below each card's score number. It was cut — at the home-page glance level the team-level points already say "how did we do"; surfacing individual contributors there pushed the cards into "section within a section" territory and added visual noise without a clear next-action. The data is available (`topDriver` / `topConstructor` on the per-race scoring records) if you want to add it later — the prototype keeps the row behind a Tweaks toggle for reference.
- **Remaining budget** — not surfaced on the home dashboard. Budget is a constraint the user manages during team creation / transfers (which live on `Team.tsx`); on the home page it's noise that doesn't drive any next action.
- **Captain callout** — captain identity is only interesting in retrospect via the score it contributed; that's already implicit in the team's total race score. A dedicated callout would leak team-management vocabulary into a summary surface.
- **Roster completeness checklist** (drivers filled / constructors filled / captain set) — once a team has a scored race those three are necessarily complete. An incomplete-roster warning belongs on the team page itself, not the home page.
- **Transfers remaining** — surfaced on `Team.tsx`; not on home. Adding it would push the home toward being a mini-team-management surface, which is what we're trying to avoid.
- **Inline "Manage Team" button** — was tried, removed. The sidebar (desktop) and hamburger menu (mobile) both already navigate to the team-management page. A duplicate inline button competes with the team name for space at narrow widths and inflates a secondary action.
- **Circuit imagery** — designs are purely typographic. If you source real circuit maps later, the natural slot is the right side of the race hero (currently just the countdown); use the `<image-slot>` web component pattern or a normal `<img>` keyed by `RaceWeekend.id`.

## Files in this folder

- `home-page-designs.html` — single-file prototype; drop in browser. Open the artboards by clicking their labels in the canvas; ←/→ cycles within a section. The Tweaks panel (toolbar toggle, bottom-right) exposes a dark-mode preview and a "Show row" toggle for the top scorers row — both are preview affordances for this exploration only, not pieces of the actual product UI.
- `design-handoff.md` — this file.
