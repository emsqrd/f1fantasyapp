# Game Design Framework: Format, Scoring & Pricing

## Overview

Three interdependent systems define how the game works: **format** (what a team looks like), **scoring** (how points are earned), and **pricing** (what trade-offs are forced). The challenge is that each system affects the others, creating a design loop that needs a deliberate order of operations to navigate.

## The Dependency Chain

The three systems form a loop, but the dependencies aren't equally strong:

```
Format ──(strongly determines)──→ Scoring
  ↑                                  │
  │                                  ↓
  └───── Pricing ←──(must reflect)───┘
```

- **Format → Scoring** is the strongest link. The number and types of slots dictate what scoring needs to balance — constructors can't matter if there are only one or two slots.
- **Scoring → Pricing** is the calibration link. Price should roughly reflect expected points so the "obvious best" picks are expensive enough to force trade-offs.
- **Pricing → Format** is the weakest link. Budget cap tightness determines how constrained or flexible the format feels, but the cap is a number you can tune without redesigning the format itself.

## Recommended Approach: Anchor, Model, Calibrate

### Step 1: Define design goals (before any numbers)

Articulate what you want the *player experience* to feel like before choosing any system values. These become the rubric every format, scoring, and pricing decision is evaluated against.

Examples of the kind of questions design goals answer:
- Should every race shake up standings, or should consistency win? (volatility vs. stability)
- Should deep mid-field knowledge beat "pick the top teams" strategy? (skill ceiling)
- Should constructor picks feel as important as driver picks? (balance)
- How many meaningful decisions should players face per race? (engagement frequency)
- Should a single DNF ruin your week? (punishment severity)

Without explicit goals, these decisions will keep going in circles because there's no objective to optimize toward.

### Step 2: Anchor on format (most structural, hardest to change later)

Format is the right starting point because:
- It's the most visible to players — it defines the core interaction
- It's the hardest to change post-launch (schema, UI, historical data migration)
- It constrains the *shape* of the other two systems

The key format variables:
- Number of driver slots
- Number of constructor slots
- Team constraints (max duplicates, required captain, etc.)
- Budget cap

The competitors show the design space:

| Format | Used by | Constructor weight |
|--------|---------|-------------------|
| 5D + 2C | F1 Fantasy | Constructors are afterthoughts |
| 5D + 1C | GridRival | One constructor, high-stakes single choice |
| 3D + 3C | Fantasy GP | Balanced but roster feels thin |
| 4D + 4C | SportsDeck | Constructors carry equal weight |
| 2D + engine + chassis | GP Fantasy Game | Niche, high complexity |

The fundamental question format answers: **how important should constructor selection be?** That one design value maps almost directly to a slot configuration.

### Step 3: Design scoring using historical data

Once format is fixed, scoring becomes modelable. Pull real results data (the 2025 season is available; 2026 is the target season) and simulate:

1. Define candidate scoring rules — position points, qualifying points, position gains, overtakes, teammate comparison, etc.
2. Calculate what each driver and constructor would have scored per race using the candidate rules
3. Check results against your design goals:
   - Is the gap between the #1 and #10 driver interesting or is it a cliff?
   - Do mid-field constructors ever outscore top constructors on a given race?
   - Does scoring reward the behaviors you want to reward?

Scoring iteration is cheap at this stage — it's a spreadsheet or script, not code changes. Get it right before building.

### Step 4: Calibrate pricing last (it's the balancing lever)

Pricing exists for exactly one purpose: **make it impossible to just pick all the highest-scoring options**. It forces trade-offs, which is where the game lives.

Once you have simulated scoring, pricing calibration follows naturally:
- Price should loosely correlate with expected points
- The budget cap should be tight enough that you can't afford the "dream team" but loose enough that multiple viable strategies exist
- Validity check: can you construct five or more meaningfully different competitive teams under the cap? If yes, the balance is working.

### The Iteration Loop

After one pass through all three systems, simulate a full season with historical data and check:

1. Are there "no-brainer" always-pick players? → tighten pricing or cap
2. Are some players never a viable pick at any price point? → soften pricing floor
3. Do constructors matter enough given the slot count? → adjust constructor scoring weights
4. Does the league standings spread look interesting across a season? → adjust volatility levers
5. Does changing one or two players per race feel meaningful? → validate transfer window design

Each adjustment is small and targeted. The goal isn't to redesign the whole system — it's to tune specific parameters until simulated outcomes match design goals.

## Practical Sequencing

```
Design Goals doc
      ↓
Format decision
      ↓
Scoring simulation (historical 2025 data)
      ↓
Pricing calibration (same simulation)
      ↓
Full-season validation
      ↓
Document final rules
```

Pricing is the easiest system to adjust over time (a number in a database). Format is the hardest (schema migrations, UI rework). Scoring sits in the middle. Invest design effort proportionally.
