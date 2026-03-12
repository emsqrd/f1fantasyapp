# Game Engine Rules Redesign Plan

## Context

You've been spiraling on pricing for over a week. Format (5D+3C) and scoring are validated. PPM is committed for in-season pricing. The current folder structure (`own-rules/` with 13 flat files) mixes decisions with research, making it impossible to tell what's signal vs. noise. You need a clean workspace before making progress on pricing.

**Decisions entering this plan:**
- Format: 5D+3C, $100M budget cap, captain mechanic — **likely decided, needs re-verification**
- Scoring: 9 driver events + constructor = sum of drivers — **likely decided, needs re-verification** (potential additions like overtakes to explore, pending data availability)
- In-season pricing: PPM direction-based model as approach — **decided**; specific parameters (neutral points, band width, step type/sizes, window) — **all open**

---

## Current Status

**Step 0 complete.** File restructure done — `decisions/`, `reference/`, `archive/` created; `own-rules/` deleted. Awaiting approval to proceed to Step 1.

*(Updated after each step completion so any new session can pick up where we left off.)*

---

## Pacing

**Gate every step.** After completing each step, stop and present the output for review before moving to the next. This applies to all steps — mechanical ones (file moves, glossary) and decision ones (format, scoring, pricing). No step is skipped or batched without explicit approval.

---

## Multi-session continuity

- **This plan file** (at `docs/plans/game-engine-redesign.md`) is the primary progress tracker. The "Current Status" section above is updated after each step.
- **The folder structure** (`decisions/`, `reference/`) is the ground truth — if the file exists with content, that step is done.
- **Starting a new session:** Read this plan file. Check the Current Status section. Check which files exist in `decisions/` and `reference/`. Continue from the next incomplete step.
- **Do not write anything about this plan to MEMORY.md.**

---

## Step 0: Restructure the files ✅

Move from the flat `own-rules/` folder to a structure with clear purpose-driven folders.

### New structure

```
fantasy-rules/
│
├── decisions/                    ← THE source of truth. If it's here, it's decided.
│   ├── design-goals.md
│   ├── format.md
│   ├── scoring.md
│   └── pricing.md
│
├── reference/                    ← Support material you consult while deciding
│   ├── design-framework.md
│   ├── glossary-keywords.md      ← NEW (Step 1)
│   ├── glossary-concepts.md      ← NEW (Step 1)
│   ├── f1-context.md             ← NEW (Step 2)
│   └── lessons-learned.md        ← NEW (Step 3)
│
├── competitors/                  ← Stays as-is
│
├── competitor-analysis.md        ← Stays at root
│
└── archive/                      ← Out of sight. Only opened when explicitly needed.
    ├── pricing-model.md
    ├── pricing-model-unified.md
    ├── pricing-model-direction-based.md
    ├── pricing-model-direction-based-simulation.md
    ├── pricing-model-open-questions.md
    ├── pricing-tier-system-analysis.md
    ├── 2025-price-change-algorithm-updates.md
    ├── own-rules-README.md
    ├── rules-redesign.md
    └── simulation/
```

---

## Step 1: Build shared vocabulary

Create two reference documents.

**Keywords** (`reference/glossary-keywords.md`):
Precise terms — PPM, drift %, swing %, step size, budget cap, band width, neutral point, rolling window, correction speed, floor, ceiling, REF_MAX, shape parameter, tightness ratio, etc.

**Concepts** (`reference/glossary-concepts.md`):
Higher-level ideas — tiered pricing, inflation/deflation, direction-based vs. target-based pricing, power curves, price compression, ceiling pinning, dummy seeding, constructor-context pricing, self-limiting feedback loops, etc.

**Process:** Gather keyword and concept lists first for your validation, then define each after approval.

---

## Step 2: Document F1-specific context

`reference/f1-context.md` — F1 characteristics that affect game design:
- Driver/team volatility between seasons
- Why performance-driven price swings are expected, not pathological
- The 2:1 driver-to-constructor pool ratio
- Sprint weekends as a variable
- Qualifying vs. race as distinct signals
- DNF frequency and distribution patterns

---

## Step 3: Document lessons learned from first attempt

`reference/lessons-learned.md` — Consolidated insights from the pricing exploration:
- Why target-based pricing led to ceiling pinning and compounding volatility
- Why ±10% percentage-based caps compound badly
- The "optimizing the wrong thing" insight (minimizing drift vs. achieving gameplay behaviors)
- What worked well (constructor-context pricing, neutral point calibration, simulation methodology)
- What floor compression means in practice

---

## Step 4: Re-verify format

Review `decisions/format.md` against design goals and competitor analysis. The 5D+3C format, $100M budget cap, and captain mechanic are likely staying, but this is the gate to confirm or adjust before building pricing on top.

Questions to confirm:
- Is 5D+3C still the right balance? (Review against design goals for constructor weight)
- Is $100M still the right budget cap? (Depends on pricing approach — may revisit after Step 8)
- Are driver replacement rules and setup window rules still right?
- Any format elements to add or remove?

If changes are made, update `decisions/format.md`.

---

## Step 5: Re-verify scoring

Review `decisions/scoring.md` against design goals. Scoring is likely staying as-is, but this is the opportunity to evaluate potential additions.

**Current scoring events:** Race finish, qualifying, sprint, position gains, fastest lap, DNF penalties (9 events total). Constructor = sum of both drivers.

**Potential additions to evaluate:**
- **Overtakes** — Investigate data availability first. Key question: is overtake data reliably and freely available per-race from official FIA sources or FastF1? If the data is hard to get or inconsistent, it's not viable regardless of whether it would improve gameplay.
- Any other scoring events that came up during the first attempt

**Evaluation criteria for new scoring events:**
- Is the data publicly verifiable? (design goal: transparency)
- Does it reward a meaningful skill signal, or just add noise?
- Does it change the driver/constructor balance in a way that aligns with design goals?
- Can a casual fan understand it in one sentence?

If changes are made, update `decisions/scoring.md`. If scoring changes materially, pricing calibration (Step 9) must account for the new point distribution.

---

## Step 6: Write pricing-specific design goals

Extend `decisions/design-goals.md` with explicit statements:

1. Should prices be predictable or surprising?
2. How much should the optimal team change over a season?
3. How much budget upside should active management earn vs. set-and-forget?
4. Is floor compression acceptable?
5. Should expensive entities be harder to dislodge from top prices?

These are design philosophy questions, not simulation questions. Must be answered before calibrating pricing.

---

## Step 7: Decide the transfer mechanic

Update `decisions/format.md` with the transfer mechanic.

**Why this comes before pricing:** Transfer frequency × price movement speed = how much budget management matters as a skill.
- Restricted transfers + fast prices = frustrating (can't act on information)
- Liberal transfers + slow prices = exploitable (mispricing persists)
- The two must be tuned together

**Recommended baseline** (most validated by competitor convergence):
- 2 free transfers per race, bank up to 2
- -10 point penalty per extra transfer
- 1 wildcard per season
- Transfer deadline = race lock (post-qualifying, pre-race start)
- Net-change counting

Structure is well-validated; exact numbers can be tuned later.

---

## Step 8: Decide preseason pricing approach

Two options for `decisions/pricing.md`:

**Option A: Editorial/manual pricing**
- Set 33 prices manually once per year using judgment
- Can incorporate team changes, rookies, regulation shifts
- Most competitors do this; only 33 entities, not burdensome
- PPM in-season mechanism corrects mispricing within 2-3 races anyway

**Option B: Power curve as baseline + manual adjustments**
- Formula generates starting point, you manually adjust for known factors
- More systematic but still requires judgment overlay

Key insight: preseason prices only need to be "close enough" since the in-season PPM mechanism self-corrects.

---

## Step 9: Calibrate PPM parameters

PPM as the in-season pricing approach is decided. The specific parameters are NOT — they need to be worked through from scratch. Previous research (now in `archive/`) can inform direction but conclusions are not pre-accepted.

**Decisions to make, in dependency order:**

1. **Neutral points** — What PPM value represents "fair price" for drivers vs. constructors?
   - These set the boundary between "price should rise" and "price should fall"
   - Drivers and constructors need separate neutral points (constructors score higher per dollar because two drivers contribute to one price)
   - Previous research found D=1.00, C=1.50 across 2023-2025 data — to be validated fresh

2. **Band width** — How far from neutral before price movement triggers?
   - Narrow band = more frequent price changes, more responsive but potentially noisy
   - Wide band = fewer changes, more stable but slower to correct mispricing
   - This interacts with the transfer mechanic (Step 7): if players can transfer often, faster correction is fine

3. **Step type** — Per-type uniform steps vs. price-based tiered steps?
   - **Uniform:** All drivers move by the same dollar amount regardless of current price. Simpler.
   - **Tiered:** Expensive entities move by larger amounts than cheap ones. More complex but may produce better proportional signals.
   - This is a design philosophy question informed by Step 6 (should expensive entities be harder to dislodge?)

4. **Step sizes** — How many dollars per movement, inner vs. outer?
   - Inner step = movement when PPM is within the band (small or zero)
   - Outer step = movement when PPM is outside the band (the main correction force)
   - Sizes depend on all of the above (neutral point, band width, step type)

5. **Window** — How many races feed into the rolling average, and how are they weighted?
   - Shorter window = more reactive to recent performance
   - Longer window = smoother, less volatile
   - Equal weighting vs. recency weighting

**Process:** Work through each parameter sequentially, using fresh simulation scripts against historical data. Each decision should be evaluated against the pricing design goals from Step 6.

---

## Step 9b: Validate the complete model

Once all parameters are decided, write a clean end-to-end simulation of the 2025 season using the full model (preseason approach from Step 8 + PPM in-season with decided parameters). Old scripts in `archive/simulation/` can be referenced for logic patterns, but the validation script should be written from scratch.

Evaluate against pricing design goals from Step 6.

- **Pass**: Move to Step 10
- **Fail on specific criteria**: Targeted parameter adjustment to the specific failing parameter

---

## Step 10: Write source-of-truth pricing document

Fill in `decisions/pricing.md` with:
- Preseason pricing approach and rationale
- In-season PPM mechanism with all parameters
- Transfer mechanic summary (cross-reference to `format.md`)
- Budget cap rationale ($100M)
- Known limitations and accepted trade-offs

---

## What NOT to do

1. **Don't try to find one formula for both preseason and in-season.** Different problems, different tools.
2. **Don't optimize for near-zero drift.** Drift from legitimate performance changes is a feature of F1, not a model flaw.
3. **Don't solve floor compression right now** unless design goals (Step 6) explicitly require it.
4. **Don't add scoring events without verifying data availability first.** A great idea with unreliable data creates more problems than it solves.

---

## Verification

After completing all steps:
- [x] `own-rules/` is gone; files are in `decisions/`, `reference/`, `archive/`
- [x] `decisions/` has exactly 4 files: design-goals, format, scoring, pricing
- [x] `reference/` has design-framework; glossary, F1 context, lessons learned to be added in Steps 1-3
- [x] `archive/` has all pricing research files, old simulation scripts, and rules-redesign.md
- [ ] Format re-verified (Step 4)
- [ ] Scoring re-verified; any new events evaluated for data availability (Step 5)
- [ ] `decisions/design-goals.md` contains pricing-specific goals (Step 6)
- [ ] `decisions/format.md` contains transfer mechanic decision (Step 7)
- [ ] `decisions/pricing.md` contains complete preseason + in-season model (Step 10)
- [ ] Final validation simulation passes against stated criteria (Step 9b)
