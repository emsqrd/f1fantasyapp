# Before You Begin

Read the following files before producing any mockups. Do not make assumptions about how the app looks, what data is available, or how components behave — verify against the source.

- `web/src/components/Team/Team.tsx` — current team page structure and logic
- `web/src/components/DriverPicker/DriverPicker.tsx` — driver slot and picker UI
- `web/src/components/ConstructorPicker/ConstructorPicker.tsx` — constructor slot and picker UI
- `web/src/contracts/Team.ts` — team, driver, and constructor data shapes
- `web/src/contracts/Race.ts` — race data shape
- `web/src/index.css` — design tokens (colors, radius, spacing)

# References

Study the following before designing. For each, answer: how do they structure the team view, what data do they show per driver/constructor, and how do they handle visual hierarchy?

- `https://sportsdesk.com/f1/dreamteam` — most directly comparable; same sport, same fantasy format
- Official F1 Fantasy app (`https://fantasy.formula1.com`) — same domain; note how they handle driver cards, locked/unlocked states, and captain designation

# Current State

The team page (`web/src/components/Team/Team.tsx`) has the following layout:

- **Header area:** Team info card (name, remaining budget, hardcoded trades counter) + lock countdown or "Lineup Locked" indicator
- **Secondary area:** Race selector dropdown + round result card — both are unfinished placeholder UI; neither is wired to real functionality
- **Tabbed body:** Drivers and Constructors in separate tabs, each showing 4 card slots in a 2-column grid. A bottom sheet opens to select a driver or constructor for an empty slot.

**Questions the redesign should address:**

- Are cards using space efficiently, especially on mobile?
- Does the tabbed driver/constructor layout serve users well, or would a unified view be better?
- Should the race selector and round result card exist on this page at all? If so, what form should they take and where should they live? They should not drive the overall layout structure.
- The trades counter is displayed but non-functional (always shows 3/3) — should it be removed until the feature is built?
- No per-driver or per-constructor performance data exists — what, if anything, belongs on this page vs. the picker or a detail view?

# Page Purpose

The My Team page is where a user views their team and makes lineup decisions for the upcoming round. It has two modes: **editable** (the user's own team, pre-lock) and **read-only** (viewing another user's team, or after roster lock).

**What users need to make educated lineup decisions:**

**Currently supported by the app:**

- How much money they have remaining in their budget
- Which drivers/constructors they have selected and which slots are open
- The ability to add and remove drivers/constructors from their lineup
- Whether they have designated a captain and who that captain is
- Whether they have the budget to make a swap (budget validation on picker)

**Not yet supported — note these as future considerations in mockups, do not let them drive the design:**

- How many transfers they can make this round (transfers feature is planned, not yet implemented)
- Whether a driver/constructor in their lineup is worth keeping vs. swapping
- Why they might want to swap a specific driver/constructor for another option

# Data Exploration

A secondary goal of this research is to identify **what data belongs on the team page** vs. elsewhere. Not all useful data belongs here — some is better suited to the picker (when actively evaluating a swap) or a future driver detail view. The team page should focus on **status and at-a-glance health** of the current lineup, not deep evaluation.

**Data currently available per driver/constructor in lineup:**

- Name, abbreviation, country
- Price
- Captain flag (drivers only)

**Data points to consider for the team page specifically:**

| Data Point                  | Value                                                      | Currently Available                                  |
| --------------------------- | ---------------------------------------------------------- | ---------------------------------------------------- |
| Price trend (up/down delta) | Quick signal on whether a pick is gaining or losing value | No (algorithm exists, not surfaced) |
| Next race circuit/location  | Informs captain choice without leaving the page           | No (race data exists in API but not surfaced here)  |

**Data points that likely belong elsewhere (picker or driver detail view):**

- Season points total, recent form, points-per-million, league ownership % — these are evaluation metrics most useful when actively comparing options, not when reviewing an existing lineup

The research should validate or challenge this placement assumption. If a data point makes a compelling case for the team page, note it and explain why.

# UI States

Mockups should address the following distinct states:

- **Incomplete roster, pre-lock** — some slots are empty; editing is enabled
- **Full roster, pre-lock** — all slots filled; countdown visible; editing enabled
- **Locked roster** — countdown replaced with "Lineup Locked"; all editing disabled

# Design Direction

The current page feels monochromatic and flat in both light and dark mode. The redesign should feel considered and sports-adjacent — not a polished commercial product, but clearly not a default component scaffold either. Think intentional use of the primary blue (`#1447e6`) as a real accent rather than a neutral, typographic weight on key stats, and visual distinction between sections so the page has some depth.

The research should propose a visual direction and justify it. One natural starting point worth exploring is **driver and constructor colors** — F1 teams have well-established brand colors that are meaningful to users and could add vibrancy to driver/constructor cards without requiring ongoing design decisions. This is one idea, not a requirement; if a better approach exists, propose it.

**Constraints:**
- Keep the layout readable and information-dense — personality should come from color, typography, contrast, and purposeful micro-interactions, not decoration
- Must work in both light and dark mode

**On imagery:** Driver/constructor avatars would add personality and reduce the blandness of initials-only cards. This is worth exploring in mockups, but the legal feasibility of sourcing official F1 imagery is unknown. Mockups may use placeholder avatars; any image-dependent design should be noted as requiring licensing investigation.

**On animation:** Small, purposeful micro-interactions are welcome — the bar is whether an animation communicates something meaningful (e.g. a state change, a confirmation). Animations should not be decorative or pervasive. Where proposed, note the intended purpose and include a `prefers-reduced-motion` fallback.

# Business Requirements

- Mobile-first design; layout is responsive (primary breakpoint: 640px)
- Mockups should illustrate both a **mobile view** and a **desktop view**
- The UI is comprehensive, but simple — simplicity takes priority over elegance, but don't sacrifice creative solutions for the sake of simplicity
- Uses Tailwind CSS v4 and the shadcn/ui component library
- Follows existing app color tokens and radius conventions (see `web/src/index.css`)

# Deliverables

- **2–3 distinct HTML mockup options** that follow app conventions and styling
- Mockups are static and non-interactive
- Each mockup covers: mobile layout, desktop layout, and the three UI states (incomplete, full pre-lock, locked)
- Each mockup should annotate which displayed data is not yet available from the API
- The driver and constructor pickers (bottom sheets) are out of scope — mockups show the team view only
