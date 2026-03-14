# Game Engine Rules Redesign Plan

## Context

You've been spiraling on pricing for over a week. Format (5D+3C) and scoring are validated. PPM is committed for in-season pricing. The current folder structure (`own-rules/` with 13 flat files) mixes decisions with research, making it impossible to tell what's signal vs. noise. You need a clean workspace before making progress on pricing.

**Decisions entering this plan:**

- Format: 5D+3C, captain mechanic — **likely decided, needs re-verification**
- Budget cap: value to be derived from composition intent + scoring + pricing parameters (Step 9), not carried forward as a fixed number
- Scoring: 9 driver events + constructor = sum of drivers — **likely decided, needs re-verification** (potential additions like overtakes to explore, pending data availability)
- In-season pricing: PPM direction-based model as approach — **decided**; specific parameters (neutral points, band width, step type/sizes, window) — **all open**

---

## Current Status

**Step 5 complete.** `decisions/format.md` reviewed and cleaned up. Removed out-of-scope content (constructor role, format comparison, options considered, decisions checklist). Split game rules into a new `decisions/rules.md` (captain, mid-season joining, setup window). Added teams per user, budget cap, and composition intent (no more than 3 elite assets across drivers and constructors combined). Verified 5D+3C format and no-roster-constraints decision still stand.

Ready for Step 6: Re-verify scoring.

_(Updated after each step completion so any new session can pick up where we left off.)_

---

## Pacing

**Gate every step.** After completing each step, stop and present the output for review before moving to the next. This applies to all steps — mechanical ones (file moves, glossary) and decision ones (format, scoring, pricing). No step is skipped or batched without explicit approval.

**The gate is the commit moment.** Nothing is written to `decisions/` until a gate is approved. Working analysis, simulations, and intermediate conclusions live in the conversation only. Upon approval, write the decision to the appropriate `decisions/` file immediately — before moving on.

---

## Multi-session continuity

- **This plan file** (at `docs/plans/game-engine-redesign.md`) is the primary progress tracker.
- **`decisions/`** is the ground truth for what has been approved and committed. If a decision is in there, it is done. If it is not in there, it is not decided.
- **Current Status** is updated whenever a gate is approved — not just at step completion. For multi-gate steps (Step 10), it records which parameters have been committed so far, e.g. "Step 10 in progress — neutral points and band width committed, working on step type."
- **Starting a new session:** Read this plan file. Check Current Status. Read the relevant `decisions/` files to load committed decisions. Continue from where Current Status says.
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
│   ├── format.md                 ← team shape: slot count, constructor role, constraints
│   ├── rules.md                  ← how play operates: captain, replacements, transfers, etc.
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

## Step 1: Build shared vocabulary ✅

Create two reference documents.

**Keywords** (`reference/glossary-keywords.md`):
Precise terms — PPM, drift %, swing %, step size, budget cap, band width, neutral point, rolling window, correction speed, floor, ceiling, REF_MAX, shape parameter, tightness ratio, etc.

**Concepts** (`reference/glossary-concepts.md`):
Higher-level ideas — tiered pricing, inflation/deflation, direction-based vs. target-based pricing, power curves, price compression, ceiling pinning, dummy seeding, constructor-context pricing, self-limiting feedback loops, etc.

**Process:** Gather keyword and concept lists first for your validation, then define each after approval.

---

## Step 2: Document F1-specific context ✅

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
- What floor compression means in practice and why some compression is intentional

---

## Step 4: Review and update foundational design goals

Review `decisions/design-goals.md` and confirm that the existing goals are still valid in light of what was learned from the first pricing attempt (reference `lessons-learned.md`).

Key questions:

- Do the existing goals accurately describe what the game should achieve?
- Are there goals that were implicit during the first attempt but never written down?
- Did the first attempt reveal any goals to be wrong, incomplete, or in conflict with each other?
- Do the goals adequately cover pricing behavior, budget mechanics, and team composition?

Update `decisions/design-goals.md` with any changes. This document is the foundation that Steps 5–11 build on — decisions in format, scoring, and pricing must all trace back to goals written here.

---

## Step 5: Re-verify format

Review `decisions/format.md` against design goals and competitor analysis. The 5D+3C format and captain mechanic are likely staying, but this is the gate to confirm or adjust before building pricing on top.

Questions to confirm:

- Is 5D+3C still the right balance?
- Are driver replacement rules and setup window rules still right?
- Any format elements to add or remove?
- **What does the intended optimal team composition look like?** Specifically: how many of the top-tier drivers should a valid team be able to hold? This is the anchor that budget cap and floor values will be derived from in Step 9 — it must be decided here as a design intent statement, not a number.

The budget cap value is NOT decided in this step. It is derived in Step 9 once the composition intent, scoring model, and pricing parameters are understood.

If changes are made, update `decisions/format.md`.

---

## Step 6: Re-verify scoring

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

If changes are made, update `decisions/scoring.md`. If scoring changes materially, pricing calibration (Step 10) must account for the new point distribution.

---

## Step 7: Write pricing-specific design goals

Extend `decisions/design-goals.md` with explicit statements.

**Already resolved entering this step:**

- Floor compression within the bottom tier is intentional by design. Backmarker entities are considered interchangeable; zero price signal within the floor tier is acceptable. The floor value itself — which determines how much compression occurs and how many entities land there — is a decision deferred to Step 9.

**Inputs from prior steps:**

- Composition intent from Step 5 (how many elites should a valid team hold) — pricing design goals must be consistent with this constraint.
- Confirmed scoring model from Step 6 — goals must reflect the actual point distribution the model produces.

**Questions to answer:**

1. Should prices be predictable or surprising?
2. How much should the optimal team change over a season?
3. How much budget upside should active management earn vs. set-and-forget?
4. Should expensive entities be harder to dislodge from top prices?

These are design philosophy questions, not simulation questions. Must be answered before calibrating pricing.

---

## Step 8: Decide the budget management mechanics

Update `decisions/rules.md` with the transfer mechanic and budget uplift decision.

**Why this comes before pricing:** These two rules together define the budget management metagame. PPM calibration (Step 10) needs both as fixed inputs.

**Transfer mechanic:**

Transfer frequency × price movement speed = how much budget management matters as a skill.

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

**Budget uplift mechanic:**

When an owned asset rises in price, does the owning team's cap increase by the same amount? The official F1 Fantasy game does this — it prevents teams from becoming over-cap through no fault of their own and creates a metagame where rising assets generate spendable headroom.

This must be decided before PPM calibration because it changes what "good" pricing behavior looks like: with uplift, holding a rising asset is actively rewarded; without it, price rises above purchase price create a forced sell or over-cap violation.

---

## Step 9: Decide preseason pricing approach and derive cap + floor

**Inputs from prior steps:**

- Composition intent from Step 5 (how many elites should a valid team hold) — this is the anchor
- Confirmed scoring model from Step 6 — determines actual point output of elite vs. backmarker entities
- Pricing design goals from Step 7 — constrains what acceptable price distributions look like

**Derive the budget cap and floor values here.** Do not choose them independently. The process:

1. Using the confirmed scoring model, establish what elite entities will likely cost under the chosen preseason approach
2. Using composition intent ("at most N elites in a valid team"), find the floor + cap combination that produces that outcome
3. Validate against pricing design goals from Step 7

**Then decide the preseason pricing approach** for `decisions/pricing.md`:

**Option A: Editorial/manual pricing**

- Set 33 prices manually once per year using judgment
- Can incorporate team changes, rookies, regulation shifts
- Most competitors do this; only 33 entities, not burdensome
- PPM in-season mechanism corrects mispricing within 2-3 races anyway

**Option B: Formula as baseline + editorial adjustments**

- Formula (e.g. constructor-context power curve) generates a starting point; manual adjustments for known factors (team changes, rookies, regulation shifts)
- More systematic but still requires judgment overlay
- Constructor-context pricing (α blend for team changers, team per-driver avg for rookies) is a useful input, not a complete answer

Key insight: preseason prices only need to be "close enough" since the in-season PPM mechanism self-corrects.

---

## Step 10: Calibrate PPM parameters

PPM as the in-season pricing approach is decided. The specific parameters are NOT — they need to be worked through from scratch. Previous research (now in `archive/`) can inform direction but conclusions are not pre-accepted.

**Each parameter is its own gate.** Decide, present, get approval, write to `decisions/pricing.md`, update Current Status — then move to the next. Do not batch parameters.

**Parameters, in dependency order:**

1. **Neutral points** — What PPM value represents "fair price" for drivers vs. constructors?
   - These set the boundary between "price should rise" and "price should fall"
   - Drivers and constructors need separate neutral points (constructors score higher per dollar because two drivers contribute to one price)
   - The neutral point cannot be a fixed constant — it must be calibrated each preseason against the actual PPM distribution of the new grid's expected prices
   - Previous research found D=1.00, C=1.50 across 2023-2025 data — use as a starting point only, validate fresh against the current grid

2. **Band width** — How far from neutral before price movement triggers?
   - Narrow band = more frequent price changes, more responsive but potentially noisy
   - Wide band = fewer changes, more stable but slower to correct mispricing
   - This interacts with the transfer mechanic (Step 8): if players can transfer often, faster correction may be acceptable

3. **Step type** — Per-type uniform steps vs. price-based tiered steps?
   - **Uniform:** All drivers move by the same dollar amount regardless of current price. Simpler.
   - **Tiered:** Expensive entities move by larger amounts than cheap ones. More complex but may produce better proportional signals.
   - This is a design philosophy question informed by Step 7 (should expensive entities be harder to dislodge?)

4. **Step sizes** — How many dollars per movement, inner vs. outer?
   - Inner step = movement when PPM is within the band (small or zero)
   - Outer step = movement when PPM is outside the band (the main correction force)
   - Sizes depend on all of the above (neutral point, band width, step type)

5. **Window** — How many races feed into the rolling average, and how are they weighted?
   - Shorter window = more reactive to recent performance
   - Longer window = smoother, less volatile
   - Equal weighting vs. recency weighting

**Process:** Work through each parameter sequentially using fresh simulation scripts against historical data. Evaluate each against pricing design goals from Step 7 before presenting for approval.

---

## Step 11: Validate the complete model

Once all parameters are decided, write a clean end-to-end simulation of the 2025 season using the full model (preseason approach from Step 9 + PPM in-season with decided parameters). Old scripts in `archive/simulation/` can be referenced for logic patterns, but the validation script should be written from scratch.

Evaluate against pricing design goals from Step 7.

- **Pass**: Move to Step 12
- **Fail on specific criteria**: Targeted parameter adjustment to the specific failing parameter

---

## Step 12: Write source-of-truth pricing document

Fill in `decisions/pricing.md` with:

- Preseason pricing approach and rationale
- In-season PPM mechanism with all parameters
- Transfer mechanic summary (cross-reference to `rules.md`)
- Budget cap and floor values with rationale (derived in Step 9)
- Known limitations and accepted trade-offs

---

## What NOT to do

1. **Don't try to find one formula for both preseason and in-season.** Different problems, different tools.
2. **Don't optimize for near-zero drift.** Drift from legitimate performance changes is a feature of F1, not a model flaw.
3. **Don't try to eliminate floor compression.** Some compression at the floor tier is intentional — backmarker entities are considered interchangeable. The floor value is decided in Step 9.
4. **Don't add scoring events without verifying data availability first.** A great idea with unreliable data creates more problems than it solves.
5. **Don't carry forward the $100M budget cap as a fixed input.** The cap value is derived in Step 9 from composition intent and scoring data.

---

## Verification

After completing all steps:

- [x] `own-rules/` is gone; files are in `decisions/`, `reference/`, `archive/`
- [x] `decisions/` has exactly 5 files: design-goals, format, rules, scoring, pricing
- [x] `reference/` has design-framework; glossary, F1 context, lessons learned to be added in Steps 1-3
- [x] `archive/` has all pricing research files, old simulation scripts, and rules-redesign.md
- [x] Foundational design goals reviewed and updated (Step 4)
- [x] Format re-verified; composition intent decided (Step 5)
- [ ] Scoring re-verified; any new events evaluated for data availability (Step 6)
- [ ] `decisions/design-goals.md` contains pricing-specific goals (Step 7)
- [ ] `decisions/format.md` contains budget management mechanics decision (Step 8)
- [ ] Preseason pricing approach decided; budget cap and floor values derived (Step 9)
- [ ] PPM parameters decided: neutral points, band width, step type, step sizes, window (Step 10)
- [ ] Final validation simulation passes against stated criteria (Step 11)
- [ ] `decisions/pricing.md` contains complete preseason + in-season model (Step 12)
