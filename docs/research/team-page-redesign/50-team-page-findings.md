# Team Page Redesign — Research Findings

## 1. Codebase Observations

### Layout Structure

The team page (`Team.tsx`) uses `AppContainer` with `maxWidth="md"` (max-w-4xl / 896px), which is narrower than most other pages. The layout has three vertical sections:

1. **Header row** — A 2-column grid (`sm:grid-cols-2`) containing:
   - **Team info card**: Team name (centered, bold 3xl), remaining budget + hardcoded trades counter ("3/3") in a 2-column sub-grid, and a lock countdown or "Lineup Locked" indicator separated by a border-top.
   - **Race selector + round results**: A `Select` dropdown (round + location) and a `Card` with hardcoded placeholder data ("1st", "679 pts"). These are stacked vertically in a flex column.

2. **Tab bar** — Full-width `Tabs` with two triggers: "Drivers" and "Constructors".

3. **Tab content** — Each tab wraps a `Card` containing the respective Picker component. Both tabs are force-mounted with `forceMount` and toggled via `display: none`, preserving picker state across tab switches.

### Component Boundaries

- **DriverCard / ConstructorCard** — Leaf presentational components. Each renders inside a `Card` with `bg-secondary`. They share an identical visual pattern: 56px circle with abbreviation, name + country, a divider, then price + points footer. DriverCard adds a captain toggle button; ConstructorCard does not.
- **DriverPicker / ConstructorPicker** — Container components managing a 4-slot lineup grid (`grid-cols-1 sm:grid-cols-2`). Each owns a `Sheet` (bottom sheet) for the selection UI. The grid uses `auto-rows-fr` so filled and empty slots are the same height.
- **DriverListItem / ConstructorListItem** — Picker list rows showing a smaller 40px abbreviation circle, name, country, price, placeholder points, and an add button. Items exceeding remaining budget are disabled via `opacity-40`.

### Data Shapes

**Available per driver in lineup (`TeamDriver`):** slotPosition, id, firstName, lastName, abbreviation, countryAbbreviation, price, isCaptain.

**Available per constructor in lineup (`TeamConstructor`):** slotPosition, id, name, fullName, abbreviation, countryAbbreviation, price.

**Available per race (`Race`):** id, seasonId, round, name, location, circuit, country, raceDate, lockDeadline, isCurrent.

**Not available anywhere in the data model:** team/constructor colors, driver headshots/images, points totals, price history/trends, form data. The `Driver` and `Constructor` base contracts (in `Role.ts`) are identical to their `Team*` counterparts minus `slotPosition` and `isCaptain`.

### Token Usage

- **Primary blue** (`#1447e6`) is used as `--primary` in both light and dark mode. Currently used only on the CirclePlus icon in empty slots and the loading spinner border. It has almost no presence on the team page.
- **Card backgrounds**: Light mode uses `#ffffff` (card) / `#f4f4f5` (secondary). Dark mode uses `#18181b` (card) / `#27272a` (secondary). The secondary color is applied to lineup cards, creating a slight contrast against the card container.
- **Border radius** is set to `0.65rem` — slightly tighter than the shadcn default, giving the app a subtly compact feel.
- **Captain highlight** uses `border-yellow-500` on the card and a coin-flip animation between a muted "C" badge and a filled yellow "x2" badge. This is the only color accent on any lineup card.

### Notable Observations

- The lock countdown computes days/hours/minutes and updates every second via `setInterval`. It handles visibility change events to stay accurate when the tab is backgrounded. This logic is solid but lives entirely in `Team.tsx` rather than a custom hook.
- The `readOnly` prop controls both "viewing someone else's team" and "locked lineup" states. These are functionally identical today, but may diverge if locked teams need different visual treatment (e.g., showing a lock icon per card).
- Points display is hardcoded as `"-- pts"` on every card and list item. There's no plumbing for actual points data.
- The race selector `Select` has an unusually tall trigger (`min-h-[60px] py-8`) that dominates the right column. The round results card shows fully fabricated data with no conditional rendering or empty state.

## 2. Competitor Analysis

> **Note:** Both competitor sites are JavaScript-rendered SPAs and could not be fully inspected via static fetch. Analysis is synthesized from app store listings, gameplay guides, community tools, and third-party references (f1fantasytools.com, FanAmp, Motor Sport Magazine, Athlon Sports). Where visual details could not be directly confirmed, this is noted.

### Official F1 Fantasy (fantasy.formula1.com)

**Team composition:** 5 drivers + 2 constructors within a $100M budget cap.

**Team view structure:**

- Uses the official F1 visual language: dark background (carbon black `#15151e`), prominent use of F1's signature red, and driver/constructor cards that lean heavily on official photography and team branding.
- Driver cards feature official headshot cutouts, team color accents (typically as a left-edge stripe or background gradient), name, price, and a DRS Boost indicator (their captain equivalent, doubling one driver's score).
- Constructors are displayed with team logos and team colors as the primary visual identifier.
- The team view appears to be a single unified view (not tabbed) — all 5 drivers and 2 constructors are visible simultaneously.

**Data per driver/constructor:**

- Name, price, price change indicator (arrow up/down with delta amount), total season points, and DRS Boost badge when selected.
- Price changes update based on performance over the last 3 GPs, giving users a trend signal directly on the card.

**Lock handling:**

- Lineups lock at the start of Qualifying (or Sprint on sprint weekends). The app shows a countdown and disables editing post-lock.
- "Finalize your team at least 5 minutes before the deadline" is advised, suggesting tight lock windows.

**Captain equivalent (DRS Boost):**

- A single driver receives the DRS Boost (2x multiplier). Selection UI appears to be a toggle on the driver card.
- Additional chips (Triple Captain, Limitless budget, Autopilot) exist as power-ups used once per season.

**What translates well to this app:**

- **Unified view** over tabs — with only 4+4 slots (8 total), a single scrollable view is feasible and eliminates a navigation step.
- **Price trend indicator** on cards — small arrow + delta provides at-a-glance health signal.
- **Team colors as card accents** — adds vibrancy and instant recognition without requiring imagery.

**What doesn't translate:**

- The heavy use of official photography and F1 brand assets is not feasible without licensing.
- The 5+2 composition means their visual grid ratio differs (more driver-heavy). This app's 4+4 is balanced and suggests equal visual weight for both sections.

### SportsDeck (sportsdeck.com/f1/dreamteam)

**Team composition:** 4 drivers + 4 constructors — identical to this app. This is the most directly comparable competitor.

**Team view structure:**

- Salary cap format with a budget display. Lineup is presented as a list or grid of selected players.
- Features include Trade Boost, Trade Update, DT.AI (auto-pick), The Optimiser, and Trade Assist — indicating a data-rich platform aimed at engaged fantasy players.
- The pricing algorithm has been reverse-engineered and documented in this project's research (R²=0.987; see `sportsdeck-pricing-formula.md`).

**Data per driver/constructor:**

- Price is the primary data point. Based on the pricing research, SportsDeck surfaces price changes after each round (calculated from a 3-race rolling average).
- Captain designation with 2x multiplier (drivers only).

**Lock handling:**

- Lineups lock before the race round. The exact UI treatment is not confirmed from external sources.

**What translates well:**

- The **4+4 team structure** is a direct match — layout decisions from SportsDeck are more applicable than F1 Fantasy's 5+2.
- **Price change visibility** — SportsDeck's model makes price trends a core gameplay decision. Since this app already has the algorithm, surfacing the delta is natural.
- **Captain with 2x multiplier** — already implemented identically in this app.

**What doesn't translate:**

- SportsDeck's advanced tools (Optimiser, Auto-Pick, Trade Assist) imply a feature-dense interface. This app should stay focused on the core lineup view and avoid premature feature creep.

### F1 Fantasy Tools (f1fantasytools.com) — Third-Party Reference

While not a competitor per se, the team calculator on this site provides a useful reference for data hierarchy:

- **Team color coding** is central to the visual identity: Ferrari red (#dc0000), Mercedes teal (#00d2be), McLaren orange (#ff9800), Alpine pink (#ff87bc), Red Bull blue (#0600ef), Williams blue (#005aff), etc.
- **Data hierarchy:** Price and ownership % are primary; performance breakdowns across race formats are secondary; trend indicators (last 2 races) are tertiary.
- **Driver abbreviations** (3-letter codes) serve as the primary identifier alongside team color.

## 3. Layout Recommendations

### Are cards using space efficiently, especially on mobile?

**No.** The current cards use a 56px abbreviation circle, full name, country abbreviation, a divider, and a price/points footer — all wrapped in a shadcn `Card` with its own padding. On mobile (single column), each card is reasonable. But the 2-column grid on wider screens creates cards that are wider than they need to be with empty horizontal space. The abbreviation circle and text layout were designed for compact widths but don't stretch gracefully.

**Recommendation:** Redesign cards to be narrower and taller (portrait-oriented on desktop), or use a more compact horizontal layout on mobile. The 56px abbreviation circle could be replaced with a smaller, color-coded identifier (e.g., a constructor color bar or dot) to reclaim horizontal space and add visual distinction.

### Does the tabbed driver/constructor layout serve users well, or would a unified view be better?

**Replace tabs with a unified view.** With only 4+4 slots (8 cards total), there is no information density problem that tabs solve. Tabs add a navigation step, hide half the lineup at all times, and prevent users from seeing their full team at a glance — which is the primary purpose of the page. Both competitors show the full lineup in a single view.

**Recommendation:** Display all 8 slots on one page, with a clear section header separating "Drivers" from "Constructors." The specific grid arrangement for each section is a decision for the mockup phase.

### Should the race selector and round result card exist on this page?

**The race selector should not exist on this page. The round result card should be removed entirely for now.**

The race selector currently controls nothing meaningful — it doesn't filter the lineup, change the data displayed, or connect to any API. It occupies prime real estate (the entire right column on desktop) and adds confusion about what the page does. The team page is about managing the _current_ lineup, not browsing historical rounds.

The round result card is entirely placeholder data ("1st", "679 pts") with no connection to real functionality. Showing fabricated data is worse than showing nothing — it sets false expectations.

**Recommendation:** Remove both. If round results are built in the future, they belong on a dedicated results/history page or as a lightweight inline element (e.g., a small "Last Round: Xth, Y pts" badge in the header area), not a card that competes with the lineup for space.

### Should the trades counter be removed until the feature is built?

**No — design for it now.** Transfers are a planned feature and the counter belongs in the header alongside budget. Designing it in from the start avoids a UI rewrite when the feature ships.

**Recommendation:** Include the trades counter in the header design using realistic figures. The mockup represents the ideal state; the current hardcoded "3/3" is an implementation problem, not a design problem.

### What data belongs on this page vs. the picker or a detail view?

See Section 4 below for the full analysis. In summary: the team page should show **status and health** — name, price, price trend, captain flag, and (when available) round points. Deep evaluation metrics belong in the picker or a future detail view.

## 4. Data Placement Recommendations

### Data currently on cards — keep or change?

| Data Point                 | Current Placement                      | Recommendation                                                                     | Rationale                                                                        |
| -------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Name (full / abbreviation) | Card — full name + abbreviation circle | **Keep, adjust** — use abbreviation as primary identifier with full name secondary | Full name is redundant when abbreviation is visible; reduces text density        |
| Country abbreviation       | Card                                   | **Deprioritize** — move to picker or detail view                                   | Country doesn't inform lineup decisions; it's reference data that takes up space |
| Price                      | Card footer                            | **Keep, promote** — make price more prominent                                      | Price is the single most important data point for budget management              |
| Captain flag               | Card (driver only)                     | **Keep** — this is critical lineup state                                           | No change needed; captain designation is a primary user action                   |
| Points (placeholder)       | Card footer ("-- pts")                 | **Remove the placeholder** — but design the card to accommodate real points when scoring is built | Showing "-- pts" adds noise with no value; but points belong on the card eventually and should not require a redesign to add |

### Data from exploration table

| Data Point                  | Research Recommendation | Placement                   | Rationale                                                                                                                                                                                                                                                                                                                            |
| --------------------------- | ----------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Price trend (up/down delta) | Team page               | **Team page — on card**     | This is a health signal, not an evaluation metric. A small arrow (green up / red down) with the delta amount tells users at a glance whether their picks are gaining or losing value. Both competitors surface this. The algorithm already exists in this project. This is the single highest-value data addition for the team page. |
| Next race circuit/location  | Team page               | **Team page — header area** | Knowing the upcoming circuit informs captain choice (e.g., a driver who excels at street circuits). This belongs as a small detail in the header area, not on individual cards. The Race data already includes `name`, `location`, and `circuit`.                                                                                    |

### Data from competitor research worth considering

| Data Point                                   | Placement                                     | Rationale                                                                                                                                                               |
| -------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Total season points (per driver/constructor) | **Defer — add to card when scoring is built** | Once scoring exists, a small points figure on each card provides health context (is this pick performing?). Until then, omit entirely rather than showing placeholders. |
| Points-per-million                           | **Picker only**                               | This is a comparison/evaluation metric. It helps when choosing between options, not when reviewing your existing lineup.                                                |
| League ownership %                           | **Picker only**                               | Useful when evaluating whether a pick is a differential or a template pick. Not relevant to lineup status.                                                              |
| Recent form (last 3 races)                   | **Picker or detail view**                     | Too granular for the team page. Useful in the picker to evaluate swap candidates.                                                                                       |

### Challenge to original placement assumptions

The research document suggested that season points total belongs "elsewhere." I partially disagree: once scoring is implemented, a **single aggregate number** (total season points) on each card is valuable as a health signal — it answers "is this pick carrying their weight?" at a glance. However, the breakdown (qualifying points, race points, bonus points) absolutely belongs in a detail view. The key distinction is **aggregate = team page, breakdown = detail view**.

## 5. Visual Direction

### Overall Direction: Structured Sport

The redesign should move from the current "component scaffold" feel toward a **structured, sport-adjacent aesthetic** — clean and data-focused, but with enough visual personality to feel purposeful. The guiding principle: **every visual element should communicate information, not decoration.**

### Color Strategy: Constructor Colors as Identity

Constructor/team colors should be the primary source of visual vibrancy on the team page. F1 team colors are instantly recognizable to the target audience and carry meaning (they identify which constructor a driver belongs to at a glance). This replaces the need for headshot imagery or decorative graphics.

**Implementation approach:**

- Each card should carry a color accent from the constructor's brand color. For drivers, this is the color of their constructor; for constructor cards, their own brand color.
- The accent should be vivid enough to be recognizable but not so dominant that it overwhelms the card content. The specific treatment (border, bar, gradient, etc.) is a decision for the mockup phase.
- The accent needs to work in both light and dark mode — dark mode's card backgrounds (#18181b / #27272a) provide a strong canvas for vivid colors, while light mode will need the accent to carry enough contrast against near-white card surfaces.

**Suggested constructor color palette** (based on F1 Fantasy Tools data and official F1 branding):

- Red Bull: #3671C6 (blue)
- Ferrari: #E8002D (red)
- McLaren: #FF8000 (orange)
- Mercedes: #27F4D2 (teal)
- Aston Martin: #229971 (green)
- Alpine: #FF87BC (pink)
- Williams: #64C4FF (blue)
- RB/VCARB: #6692FF (blue)
- Haas: #B6BABD (silver)
- Kick Sauber: #52E252 (green)

> **Note:** These colors are not currently in the data model. Implementing this requires either adding a `color` field to the Constructor entity or maintaining a frontend mapping. A frontend mapping keyed by constructor abbreviation or ID is simpler for MVP and avoids a migration.

### Typography

- **Card names:** Abbreviation should be the primary identifier; full name secondary and smaller. This matches how both competitors treat driver identity.
- **Price:** Should read as a featured stat, not a footnote. Currently rendered at `text-xs` alongside points — it deserves more visual weight than that given its role in budget decisions.
- **Labels and stats:** The current label pattern (small, muted, uppercase) is appropriate and should be carried forward. Numerical data should use tabular alignment to avoid layout shifts — the lock countdown already does this correctly.

### Card Structure

The current card layout (56px abbreviation circle + horizontal text block) was designed for compact widths but doesn't adapt gracefully when cards are wider — on desktop in a 2-column grid, cards end up with noticeable empty horizontal space. The redesign should address this.

**Content that must be present on filled cards:** constructor color accent, name, price (prominently weighted), captain badge for drivers, remove action in edit mode.

**Content to omit:** country abbreviation (reference data that doesn't inform decisions; belongs in picker), the current `"-- pts"` placeholder (meaningless noise). Cards should show points as part of the ideal design — using realistic figures, not placeholder text.

The specific layout treatment and structure of the card is for the mockup phase to determine.

### Use of Primary Blue (#1447e6)

Primary blue currently has almost no presence on the team page. The redesign should use it sparingly and intentionally as an accent — it should signal interactivity or importance, not serve as a card background, border, or fill. Where exactly it appears is a decision for the mockup phase.

### Header Area Redesign

The current header occupies roughly half the viewport on mobile before the lineup even appears, due to the two-card split (team info card + race selector/results card). The lineup is the page's primary content; the header should be compact enough to support it, not compete with it.

**Must contain:** team name, remaining budget, trades counter, lock countdown (or "Locked" state). **Should contain:** next race location, as context for captain decisions. **Should not contain:** race selector (non-functional), round results (fabricated data).

The specific layout and arrangement within the header is for the mockup phase.

### Light vs. Dark Mode

Constructor color accents need to work in both modes. In dark mode, vivid colors read strongly against dark card backgrounds. In light mode, the near-white secondary (`#f4f4f5`) provides less contrast — the mockup phase should verify that accents remain legible and that card structure doesn't rely solely on background differentiation.

### Micro-interactions

- **Captain toggle:** The existing coin-flip animation communicates the state change clearly and must be retained.

Beyond this, the mockup agent should identify any other moments in the UI where a purposeful micro-interaction would add value. The bar is whether an animation communicates something meaningful — a state change, a confirmation, feedback. Decorative or pervasive animations are out of scope. All proposed interactions must include a `prefers-reduced-motion` fallback.

