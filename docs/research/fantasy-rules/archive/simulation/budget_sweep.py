"""
budget_sweep.py — Show how the optimal budget-legal team changes at different cap levels.

Uses preseason 2025 prices and 2025 actual scores.
"""

import csv
import itertools
from pathlib import Path

SIM_DIR = Path(__file__).parent
OUTPUT_DIR = SIM_DIR / "output"

# ── Load data ──────────────────────────────────────────────────────────────

def load_csv(path):
    with open(path) as f:
        return list(csv.DictReader(f))

driver_prices = {}
driver_scores = {}
constructor_prices = {}
constructor_scores = {}

for row in load_csv(OUTPUT_DIR / "pricing/preseason_prices_2025.csv"):
    if row["type"] == "driver":
        driver_prices[row["entity"]] = int(row["preseason_price"])
    else:
        constructor_prices[row["entity"]] = int(row["preseason_price"])

for row in load_csv(OUTPUT_DIR / "2025/season_totals.csv"):
    driver_scores[row["driver"]] = int(row["season_total"])

for row in load_csv(OUTPUT_DIR / "2025/season_constructor_totals.csv"):
    constructor_scores[row["constructor"]] = int(row["season_total"])

drivers = list(driver_prices.keys())
constructors = list(constructor_prices.keys())

# Dream team (top 5D + top 3C by score, unlimited budget)
dream_drivers = sorted(drivers, key=lambda d: -driver_scores.get(d, 0))[:5]
dream_constructors = sorted(constructors, key=lambda c: -constructor_scores.get(c, 0))[:3]
dream_score = sum(driver_scores[d] for d in dream_drivers) + sum(constructor_scores[c] for c in dream_constructors)
dream_cost = sum(driver_prices[d] for d in dream_drivers) + sum(constructor_prices[c] for c in dream_constructors)

print(f"Dream team (no budget): {dream_drivers} + {dream_constructors}")
print(f"  Score: {dream_score:,}  Cost: ${dream_cost/1e6:.1f}M")
print()

# ── Sweep budget caps ──────────────────────────────────────────────────────

caps = [100_000_000, 105_000_000, 110_000_000, 115_000_000]

for cap in caps:
    best_score = 0
    best_team = None

    for d_combo in itertools.combinations(drivers, 5):
        d_cost = sum(driver_prices[d] for d in d_combo)
        if d_cost > cap:
            continue
        for c_combo in itertools.combinations(constructors, 3):
            c_cost = sum(constructor_prices[c] for c in c_combo)
            if d_cost + c_cost > cap:
                continue
            score = (
                sum(driver_scores.get(d, 0) for d in d_combo)
                + sum(constructor_scores.get(c, 0) for c in c_combo)
            )
            if score > best_score:
                best_score = score
                best_team = (d_combo, c_combo, d_cost + c_cost)

    d_combo, c_combo, total_cost = best_team
    tightness = total_cost / cap * 100

    # How many dream team members are included?
    dream_d_overlap = [d for d in d_combo if d in dream_drivers]
    dream_c_overlap = [c for c in c_combo if c in dream_constructors]

    print(f"── Cap: ${cap/1e6:.0f}M (tightness: {dream_cost/cap*100:.0f}%) ─────────────")
    print(f"  Drivers:      {sorted(d_combo, key=lambda d: -driver_scores[d])}")
    print(f"  Constructors: {sorted(c_combo, key=lambda c: -constructor_scores[c])}")
    print(f"  Score: {best_score:,}  Cost: ${total_cost/1e6:.1f}M  ({tightness:.0f}% of cap)")
    print(f"  Dream drivers kept:      {dream_d_overlap} ({len(dream_d_overlap)}/5)")
    print(f"  Dream constructors kept: {dream_c_overlap} ({len(dream_c_overlap)}/3)")
    dropped_d = [d for d in dream_drivers if d not in d_combo]
    dropped_c = [c for c in dream_constructors if c not in c_combo]
    if dropped_d:
        print(f"  Dropped dream drivers:   {dropped_d}")
    if dropped_c:
        print(f"  Dropped dream constr:    {dropped_c}")
    print(f"  Gap to dream score: {dream_score - best_score:,} pts ({(dream_score-best_score)/dream_score*100:.1f}%)")
    print()
