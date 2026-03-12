"""
context_pricing_comparison.py — Compare constructor-context preseason pricing
against the current power curve, and model early-season price correction.

Part 1: Constructor-context preseason pricing
  - For rookies: use new team's per-driver avg instead of floor
  - For team changers: blend individual avg with new team's per-driver avg
  - Compare at different α values (0 = pure car, 1 = pure individual)

Part 2: Faster correction
  - Current: frozen 3 races, then 3-race rolling window with ±10% cap
  - Proposed: expanding window (1→2→3 races), correction starts after race 1
  - Measure how quickly prices converge to "fair value"

Uses 2024 inputs → 2025 preseason prices, validated against 2025 race-by-race data.
"""

import csv
import statistics
from pathlib import Path

SIM_DIR = Path(__file__).parent
OUTPUT_DIR = SIM_DIR / "output"

TEAM_DRIVERS = 5
TEAM_CONSTRUCTORS = 3
TOTAL_RACES = 24

# ── Power curve parameters ───────────────────────────────────────────────

DRIVER_FLOOR = 6_000_000
DRIVER_CEILING = 19_000_000
CONSTRUCTOR_FLOOR = 6_000_000
CONSTRUCTOR_CEILING = 25_000_000
SHAPE = 1.0
DRIVER_REF_MAX = 29.29
CONSTRUCTOR_REF_MAX = 45.25
BUDGET_CAP = 100_000_000
PRICE_CHANGE_CAP_FRACTION = 0.10


def round_100k(x: float) -> int:
    return round(x / 100_000) * 100_000


def power_curve_price(avg: float, entity_type: str) -> int:
    floor = DRIVER_FLOOR if entity_type == "driver" else CONSTRUCTOR_FLOOR
    ceiling = DRIVER_CEILING if entity_type == "driver" else CONSTRUCTOR_CEILING
    ref_max = DRIVER_REF_MAX if entity_type == "driver" else CONSTRUCTOR_REF_MAX
    if avg is None or avg <= 0:
        return floor
    norm = max(0.0, min(1.0, avg / ref_max))
    return max(floor, round_100k(floor + (ceiling - floor) * norm ** SHAPE))


# ── Load data ────────────────────────────────────────────────────────────

# 2024 per-race averages (from preseason pricing)
DRIVER_AVG_2024: dict[str, float | None] = {}
CONSTRUCTOR_AVG_2024: dict[str, float | None] = {}

with open(OUTPUT_DIR / "pricing/preseason_prices_2025.csv") as f:
    for row in csv.DictReader(f):
        avg_str = row["avg_2024"]
        if row["type"] == "driver":
            DRIVER_AVG_2024[row["entity"]] = None if avg_str == "rookie" else float(avg_str)
        else:
            CONSTRUCTOR_AVG_2024[row["entity"]] = None if avg_str == "rookie" else float(avg_str)

# 2025 season totals
DRIVER_SCORES: dict[str, int] = {}
DRIVER_TEAMS_2025: dict[str, str] = {}
with open(OUTPUT_DIR / "2025/season_totals.csv") as f:
    for row in csv.DictReader(f):
        DRIVER_SCORES[row["driver"]] = int(row["season_total"])
        DRIVER_TEAMS_2025[row["driver"]] = row["team"]

CONSTRUCTOR_SCORES: dict[str, int] = {}
with open(OUTPUT_DIR / "2025/season_constructor_totals.csv") as f:
    for row in csv.DictReader(f):
        CONSTRUCTOR_SCORES[row["constructor"]] = int(row["season_total"])

# 2025 race-by-race scores
RACE_SCORES: dict[str, list[int]] = {}  # driver → [race1_score, race2_score, ...]
with open(OUTPUT_DIR / "2025/driver_scores.csv") as f:
    for row in csv.DictReader(f):
        driver = row["driver"]
        rnd = int(row["round"])
        pts = int(row["total_pts"])
        if driver not in RACE_SCORES:
            RACE_SCORES[driver] = []
        # Ensure list is long enough
        while len(RACE_SCORES[driver]) < rnd:
            RACE_SCORES[driver].append(0)
        RACE_SCORES[driver][rnd - 1] = pts

# ── Team assignments ─────────────────────────────────────────────────────

# 2024 team assignments (which team each driver raced for in 2024)
TEAM_2024: dict[str, str | None] = {
    "VER": "Red Bull Racing",
    "NOR": "McLaren",
    "LEC": "Ferrari",
    "PIA": "McLaren",
    "SAI": "Ferrari",
    "RUS": "Mercedes",
    "HAM": "Mercedes",
    "ALO": "Aston Martin",
    "GAS": "Alpine",
    "HUL": "Haas F1 Team",
    "OCO": "Alpine",
    "TSU": "Racing Bulls",
    "STR": "Aston Martin",
    "ALB": "Williams",
    # Rookies / partial season (< 10 races → avg_2024 is None)
    "COL": "Williams",
    "LAW": "Racing Bulls",
    "BEA": "Haas F1 Team",
    "BOR": None,
    "HAD": None,
    "DOO": "Alpine",
    "ANT": None,
}

# Constructor per-driver avg (2024): what a typical driver in this car scores
CONSTRUCTOR_PER_DRIVER_AVG: dict[str, float] = {}
for name, avg in CONSTRUCTOR_AVG_2024.items():
    if avg is not None:
        CONSTRUCTOR_PER_DRIVER_AVG[name] = avg / 2.0

# Classify drivers
IS_ROOKIE: dict[str, bool] = {d: DRIVER_AVG_2024[d] is None for d in DRIVER_AVG_2024}
CHANGED_TEAM: dict[str, bool] = {}
for d in DRIVER_AVG_2024:
    if IS_ROOKIE[d]:
        CHANGED_TEAM[d] = False  # rookies handled separately
    else:
        old_team = TEAM_2024.get(d)
        new_team = DRIVER_TEAMS_2025.get(d)
        CHANGED_TEAM[d] = old_team is not None and new_team is not None and old_team != new_team


def fmt_m(x: int) -> str:
    return f"${x / 1e6:.1f}M"


# ══════════════════════════════════════════════════════════════════════════
# PART 1: Constructor-Context Preseason Pricing
# ══════════════════════════════════════════════════════════════════════════

def compute_context_prices(alpha: float) -> dict[str, int]:
    """
    Compute preseason driver prices with constructor context.

    - Rookies: use new team's per-driver avg (alpha ignored)
    - Team changers: blend α × individual + (1-α) × new team per-driver avg
    - Same-team drivers: use individual avg unchanged
    """
    prices: dict[str, int] = {}
    for driver in DRIVER_AVG_2024:
        new_team = DRIVER_TEAMS_2025.get(driver)
        team_avg = CONSTRUCTOR_PER_DRIVER_AVG.get(new_team, 0) if new_team else 0

        if IS_ROOKIE[driver]:
            # Use new team's per-driver avg
            adj_avg = max(0, team_avg)
            prices[driver] = power_curve_price(adj_avg, "driver")
        elif CHANGED_TEAM[driver]:
            # Blend individual with new team
            individual = DRIVER_AVG_2024[driver]
            adj_avg = alpha * individual + (1 - alpha) * team_avg
            adj_avg = max(0, adj_avg)
            prices[driver] = power_curve_price(adj_avg, "driver")
        else:
            # Same team — use individual avg as-is
            prices[driver] = power_curve_price(DRIVER_AVG_2024[driver], "driver")

    return prices


def ppm(score: int, price: int) -> float:
    if price <= 0:
        return 0.0
    return (score / TOTAL_RACES) / (price / 1_000_000)


print("=" * 80)
print("  PART 1: CONSTRUCTOR-CONTEXT PRESEASON PRICING")
print("=" * 80)

# Current (no context) prices
current_prices = {d: power_curve_price(DRIVER_AVG_2024[d], "driver") for d in DRIVER_AVG_2024}
constructor_prices = {c: power_curve_price(CONSTRUCTOR_AVG_2024[c], "constructor") for c in CONSTRUCTOR_AVG_2024}

# Test different alpha values
alphas = [1.0, 0.7, 0.5, 0.3, 0.0]

print(f"\n  Alpha controls the blend for team-changers:")
print(f"  α=1.0 = pure individual (current behavior)")
print(f"  α=0.0 = pure car (ignore individual performance)")
print(f"  Rookies always use team avg regardless of α")

# Show the affected drivers
print(f"\n  AFFECTED DRIVERS:")
print(f"  {'Driver':<6} {'Status':<15} {'Old team':<20} {'New team':<20} "
      f"{'Indiv avg':>10} {'New team avg':>12}")
print(f"  {'-'*6} {'-'*15} {'-'*20} {'-'*20} {'-'*10} {'-'*12}")

for driver in sorted(DRIVER_AVG_2024.keys()):
    if IS_ROOKIE[driver] or CHANGED_TEAM[driver]:
        status = "ROOKIE" if IS_ROOKIE[driver] else "TEAM CHANGE"
        old = TEAM_2024.get(driver, "—") or "—"
        new = DRIVER_TEAMS_2025.get(driver, "?")
        indiv = f"{DRIVER_AVG_2024[driver]:.2f}" if DRIVER_AVG_2024[driver] else "—"
        team_avg = CONSTRUCTOR_PER_DRIVER_AVG.get(new, 0)
        actual_per_race = DRIVER_SCORES.get(driver, 0) / TOTAL_RACES
        print(f"  {driver:<6} {status:<15} {old:<20} {new:<20} "
              f"{indiv:>10} {team_avg:>11.2f}")

# Price comparison table
print(f"\n  PRICE COMPARISON (affected drivers only):")
header = f"  {'Driver':<6} {'Actual':>8} {'2025/race':>10}"
for a in alphas:
    label = "current" if a == 1.0 else f"α={a}"
    header += f"  {label:>10}"
header += f"  {'Best α':>8}"
print(header)
print(f"  {'-' * (len(header) - 2)}")

alpha_prices = {a: compute_context_prices(a) for a in alphas}

for driver in sorted(DRIVER_AVG_2024.keys()):
    if not (IS_ROOKIE[driver] or CHANGED_TEAM[driver]):
        continue
    actual = DRIVER_SCORES.get(driver, 0)
    actual_per_race = actual / TOTAL_RACES
    # "Fair" price = what power curve would give for actual 2025 per-race avg
    fair_price = power_curve_price(actual_per_race, "driver")

    row = f"  {driver:<6} {fmt_m(fair_price):>8} {actual_per_race:>9.1f}"
    best_alpha = None
    best_diff = float("inf")
    for a in alphas:
        p = alpha_prices[a][driver]
        row += f"  {fmt_m(p):>10}"
        diff = abs(p - fair_price)
        if diff < best_diff:
            best_diff = diff
            best_alpha = a
    best_label = "current" if best_alpha == 1.0 else f"α={best_alpha}"
    row += f"  {best_label:>8}"
    print(row)

# PPM analysis for each alpha
print(f"\n  PPM ANALYSIS (all drivers, lower variance = better pricing):")
print(f"  {'Scenario':<20} {'Avg PPM':>8} {'PPM σ':>8} {'Max PPM':>9} {'Min PPM':>9} "
      f"{'Max misp.':>10}")

for a in alphas:
    label = "current" if a == 1.0 else f"α={a}"
    prices = alpha_prices[a]
    ppms = []
    max_misprice = ("", 0)
    for d in DRIVER_AVG_2024:
        score = DRIVER_SCORES.get(d, 0)
        price = prices[d]
        p = ppm(score, price)
        ppms.append(p)
        fair = power_curve_price(score / TOTAL_RACES, "driver")
        misprice = abs(price - fair)
        if misprice > max_misprice[1]:
            max_misprice = (d, misprice)

    avg_p = statistics.mean(ppms)
    std_p = statistics.stdev(ppms)
    print(f"  {label:<20} {avg_p:>7.2f} {std_p:>8.2f} {max(ppms):>8.2f} {min(ppms):>9.2f} "
          f" {max_misprice[0]} ({fmt_m(max_misprice[1])})")


# ══════════════════════════════════════════════════════════════════════════
# PART 2: Early-Season Price Correction
# ══════════════════════════════════════════════════════════════════════════

print(f"\n{'=' * 80}")
print(f"  PART 2: EARLY-SEASON PRICE CORRECTION (first 8 races)")
print(f"{'=' * 80}")


def simulate_correction(
    preseason_prices: dict[str, int],
    frozen_rounds: int,
    expanding_window: bool,
    label: str,
) -> dict[str, list[int]]:
    """
    Simulate price evolution for the first 8 races.

    frozen_rounds: number of races before first price update (current = 3)
    expanding_window: if True, use min(races_completed, 3) as window size
                      if False, always require 3 races of data
    """
    price_history: dict[str, list[int]] = {}

    for driver in DRIVER_AVG_2024:
        current = preseason_prices[driver]
        history = [current]
        scores = RACE_SCORES.get(driver, [])

        for rnd in range(1, 9):  # rounds 1-8
            if rnd <= frozen_rounds:
                history.append(current)
                continue

            # Compute rolling avg
            if expanding_window:
                window = min(rnd, 3)
            else:
                window = 3

            if rnd < window:
                history.append(current)
                continue

            recent = scores[max(0, rnd - window):rnd]
            if len(recent) < window:
                history.append(current)
                continue

            rolling_avg = sum(recent) / len(recent)
            target = power_curve_price(rolling_avg, "driver")
            raw_delta = target - current
            cap = max(100_000, round_100k(current * PRICE_CHANGE_CAP_FRACTION))
            delta = max(-cap, min(cap, raw_delta))
            current = max(DRIVER_FLOOR, round_100k(current + delta))
            history.append(current)

        price_history[driver] = history

    return price_history


# Key drivers to track: the mispriced ones
KEY_DRIVERS = ["ANT", "SAI", "TSU", "BEA", "HAD", "HAM", "HUL", "OCO"]

# Compute "fair" prices (based on actual 2025 scoring)
FAIR_PRICES = {d: power_curve_price(DRIVER_SCORES[d] / TOTAL_RACES, "driver") for d in DRIVER_SCORES}

# Run scenarios
scenarios = [
    # (preseason_prices, frozen_rounds, expanding_window, label)
    (alpha_prices[1.0], 3, False, "Current (no context, frozen 3)"),
    (alpha_prices[1.0], 0, True, "Current prices + fast correction"),
    (alpha_prices[0.5], 3, False, "α=0.5 context + frozen 3"),
    (alpha_prices[0.5], 0, True, "α=0.5 context + fast correction"),
    (alpha_prices[0.3], 3, False, "α=0.3 context + frozen 3"),
    (alpha_prices[0.3], 0, True, "α=0.3 context + fast correction"),
]

for preseason, frozen, expanding, label in scenarios:
    print(f"\n  ── {label} {'─' * max(1, 60 - len(label))}")
    history = simulate_correction(preseason, frozen, expanding, label)

    # Show price evolution for key drivers
    print(f"  {'Driver':<6} {'Fair':>8} {'Pre':>8}", end="")
    for r in range(1, 9):
        print(f" {'R'+str(r):>8}", end="")
    print(f" {'R8 gap':>9}")

    for driver in KEY_DRIVERS:
        if driver not in history:
            continue
        h = history[driver]
        fair = FAIR_PRICES.get(driver, DRIVER_FLOOR)
        pre_gap = abs(h[0] - fair)
        r8_gap = abs(h[8] - fair)

        row = f"  {driver:<6} {fmt_m(fair):>8} {fmt_m(h[0]):>8}"
        for r in range(1, 9):
            row += f" {fmt_m(h[r]):>8}"
        convergence = f"{fmt_m(r8_gap)}"
        row += f" {convergence:>9}"
        print(row)

    # Overall mispricing at each round
    print(f"\n  Total grid mispricing (sum of |price - fair| for all drivers):")
    row = f"  {'':>15}"
    for r in range(0, 9):
        label_r = "Pre" if r == 0 else f"R{r}"
        row += f" {label_r:>8}"
    print(row)

    misprice_row = f"  {'Mispricing $M':>15}"
    for r in range(0, 9):
        total_misprice = 0
        for d in DRIVER_AVG_2024:
            fair = FAIR_PRICES.get(d, DRIVER_FLOOR)
            actual_price = history[d][r] if r < len(history[d]) else history[d][-1]
            total_misprice += abs(actual_price - fair)
        misprice_row += f" {total_misprice / 1e6:>7.1f}"
    print(misprice_row)


# ══════════════════════════════════════════════════════════════════════════
# PART 3: Optimal Team Comparison
# ══════════════════════════════════════════════════════════════════════════

print(f"\n{'=' * 80}")
print(f"  PART 3: OPTIMAL TEAM AT $100M (preseason, context pricing)")
print(f"{'=' * 80}")

import itertools

def best_team_at_cap(driver_prices, constructor_prices, cap):
    d_names = sorted(driver_prices)
    c_names = sorted(constructor_prices)
    d_costs = [driver_prices[d] for d in d_names]
    c_costs = [constructor_prices[c] for c in c_names]
    d_scores = [DRIVER_SCORES.get(d, 0) for d in d_names]
    c_scores = [CONSTRUCTOR_SCORES.get(c, 0) for c in c_names]

    c_combos = list(itertools.combinations(range(len(c_names)), TEAM_CONSTRUCTORS))
    c_combo_costs = [sum(c_costs[i] for i in combo) for combo in c_combos]
    c_combo_scores = [sum(c_scores[i] for i in combo) for combo in c_combos]
    min_c_cost = min(c_combo_costs)

    best_score = -1
    best_team = None
    feasible = 0

    for d_combo in itertools.combinations(range(len(d_names)), TEAM_DRIVERS):
        d_cost = sum(d_costs[i] for i in d_combo)
        remaining = cap - d_cost
        if remaining < min_c_cost:
            continue
        d_score = sum(d_scores[i] for i in d_combo)
        for ci, c_cost in enumerate(c_combo_costs):
            if c_cost <= remaining:
                total = d_score + c_combo_scores[ci]
                feasible += 1
                if total > best_score:
                    best_score = total
                    best_team = ([d_names[i] for i in d_combo],
                                [c_names[i] for i in c_combos[ci]],
                                d_cost + c_cost)

    return best_score, best_team, feasible


dream_d = sorted(DRIVER_SCORES, key=lambda d: -DRIVER_SCORES[d])[:5]
dream_c = sorted(CONSTRUCTOR_SCORES, key=lambda c: -CONSTRUCTOR_SCORES[c])[:3]

for a in [1.0, 0.5, 0.3]:
    label = "Current (α=1.0)" if a == 1.0 else f"Context (α={a})"
    dp = alpha_prices[a]

    dt_cost = sum(dp.get(d, 0) for d in dream_d) + sum(constructor_prices.get(c, 0) for c in dream_c)
    tightness = dt_cost / BUDGET_CAP * 100

    score, team, feasible = best_team_at_cap(dp, constructor_prices, BUDGET_CAP)
    drivers, constrs, cost = team

    # Sort by score
    drivers = sorted(drivers, key=lambda d: -DRIVER_SCORES.get(d, 0))
    constrs = sorted(constrs, key=lambda c: -CONSTRUCTOR_SCORES.get(c, 0))

    overlap_d = sum(1 for d in drivers if d in dream_d)
    overlap_c = sum(1 for c in constrs if c in dream_c)

    print(f"\n  ── {label} {'─' * max(1, 60 - len(label))}")
    print(f"  Dream team cost: {fmt_m(dt_cost)} ({tightness:.1f}% tightness)")
    print(f"  Best team @ ${BUDGET_CAP // 1_000_000}M: {', '.join(drivers)} + {', '.join(constrs)}")
    print(f"  Score: {score:,}  Cost: {fmt_m(cost)}  Dream overlap: {overlap_d + overlap_c}/8")
    print(f"  Feasible teams: {feasible:,}")

    print(f"  Breakdown:")
    for d in drivers:
        p = dp[d]
        s = DRIVER_SCORES.get(d, 0)
        pp = ppm(s, p)
        dream = " ★" if d in dream_d else ""
        print(f"    {d:<6} {fmt_m(p):>8}  {s:>5} pts  {pp:.2f} PPM{dream}")
    for c in constrs:
        p = constructor_prices[c]
        s = CONSTRUCTOR_SCORES.get(c, 0)
        pp = ppm(s, p)
        dream = " ★" if c in dream_c else ""
        print(f"    {c:<22} {fmt_m(p):>8}  {s:>5} pts  {pp:.2f} PPM{dream}")

print(f"\n{'=' * 80}")
print("  COMPARISON COMPLETE")
print(f"{'=' * 80}")
