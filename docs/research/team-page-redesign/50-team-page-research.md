# Team Page Redesign — Research

Your job is to research and produce findings. Do not produce mockups.

## Before You Begin

Read the following files before producing any findings. Do not make assumptions about how the app looks, what data is available, or how components behave — verify against the source.

- `web/src/components/Team/Team.tsx` — current team page structure and logic
- `web/src/components/DriverCard/DriverCard.tsx` — driver card rendered in each lineup slot
- `web/src/components/ConstructorCard/ConstructorCard.tsx` — constructor card rendered in each lineup slot
- `web/src/components/DriverPicker/DriverPicker.tsx` — driver slot and picker UI
- `web/src/components/ConstructorPicker/ConstructorPicker.tsx` — constructor slot and picker UI
- `web/src/contracts/Team.ts` — team, driver, and constructor data shapes
- `web/src/contracts/Race.ts` — race data shape
- `web/src/index.css` — design tokens (colors, radius, spacing)

## References

Study the following before producing findings. For each, answer: how do they structure the team view, what data do they show per driver/constructor, and how do they handle visual hierarchy?

- Sportsdeck (`https://sportsdesk.com/f1/dreamteam`) — most directly comparable; same sport, same fantasy format
- Official F1 Fantasy app (`https://fantasy.formula1.com`) — same domain; note how they handle driver cards, locked/unlocked states, and captain designation

## Current State

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

## Page Purpose

The My Team page is where a user views their team and makes lineup decisions for the upcoming round. It has two modes: **editable** (the user's own team, pre-lock) and **read-only** (viewing another user's team, or after roster lock).

**What users need to make educated lineup decisions:**

**Currently supported by the app:**

- How much money they have remaining in their budget
- Which drivers/constructors they have selected and which slots are open
- The ability to add and remove drivers/constructors from their lineup
- Whether they have designated a captain and who that captain is
- Whether they have the budget to make a swap (budget validation on picker)

**Not yet supported — note these as future considerations in findings, do not let them drive recommendations:**

- How many transfers they can make this round (transfers feature is planned, not yet implemented)
- Whether a driver/constructor in their lineup is worth keeping vs. swapping
- Why they might want to swap a specific driver/constructor for another option

## Data Exploration

A secondary goal of this research is to identify **what data belongs on the team page** vs. elsewhere. Not all useful data belongs here — some is better suited to the picker (when actively evaluating a swap) or a future driver detail view. The team page should focus on **status and at-a-glance health** of the current lineup, not deep evaluation.

**Data currently available per driver/constructor in lineup:**

- Name, abbreviation, country
- Price
- Captain flag (drivers only)

**Data points to consider for the team page specifically:**

| Data Point                  | Value                                                     | Currently Available                                |
| --------------------------- | --------------------------------------------------------- | -------------------------------------------------- |
| Price trend (up/down delta) | Quick signal on whether a pick is gaining or losing value | No (algorithm exists, not surfaced)                |
| Next race circuit/location  | Informs captain choice without leaving the page           | No (race data exists in API but not surfaced here) |

**Data points that likely belong elsewhere (picker or driver detail view):**

- Season points total, recent form, points-per-million, league ownership % — these are evaluation metrics most useful when actively comparing options, not when reviewing an existing lineup

Validate or challenge this placement assumption. If a data point makes a compelling case for the team page, note it and explain why.

## Deliverables

Save your findings to `docs/research/50-team-page-findings.md`. The file must include the following sections:

### 1. Codebase Observations

What you found reading the source files. Note anything relevant to the redesign: layout structure, component boundaries, data shapes, token usage, anything unexpected.

### 2. Competitor Analysis

For each reference site: how they structure the team view, what data they surface per driver/constructor, how they handle visual hierarchy, locked/unlocked states, and captain designation. Note what translates well to this app and what doesn't.

### 3. Layout Recommendations

Answer the open questions from Current State above. For each, give a clear recommendation and brief rationale. Include a recommendation on whether the tabbed layout should stay or be replaced with a unified view.

### 4. Data Placement Recommendations

For each data point in the exploration table, give a clear recommendation: team page, picker, detail view, or defer. Include any data points from competitor research worth adding. Explain the reasoning for any placement that differs from the current assumption.

### 5. Visual Direction

Propose a visual direction for the redesign and justify it. Address: use of color (including team/constructor colors), typography weight, card structure, and how the primary blue (`#1447e6`) should be used as an accent. This section should give the mockup agent a clear, opinionated brief — not a list of options.

### 6. Open Questions

Anything that needs a decision before or during mockup production. Flag any image/licensing concerns, unresolved tradeoffs, or assumptions you had to make.
