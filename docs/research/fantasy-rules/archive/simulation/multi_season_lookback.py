"""
multi_season_lookback.py — Evaluate multi-season weighted lookback for preseason pricing.

Hypothesis: Using a weighted average of 2-3 prior seasons (instead of just the most
recent) produces more accurate preseason prices, especially for midfield drivers
who may have one outlier season in a poor car.

Approach:
  - Load per-race averages from 2022, 2023, 2024, 2025
  - For each "target season" (2024, 2025), compute preseason prices using:
    1. Single-season (current model): most recent year only
    2. 2-year lookback: w1 × year-1 + w2 × year-2 (renormalized)
    3. 3-year lookback: w1 × year-1 + w2 × year-2 + w3 × year-3
  - Sweep weight combinations and measure total grid mispricing
  - "Fair price" = power curve applied to actual target-season per-race average

Uses constructor-context pricing (α=0.5) for team changers and rookies.

Data: output/{2022,2023,2024,2025}/season_totals.csv
"""

import csv
import itertools
import statistics
from pathlib import Path

SIM_DIR = Path(__file__).parent
OUTPUT_DIR = SIM_DIR / "output"

# ── Model parameters (from unified pricing model) ──────────────────────────

DRIVER_FLOOR = 6_000_000
DRIVER_CEILING = 19_000_000
CONSTRUCTOR_FLOOR = 6_000_000
CONSTRUCTOR_CEILING = 25_000_000
SHAPE = 1.0
DRIVER_REF_MAX = 29.29   # VER 2024 baseline
CONSTRUCTOR_REF_MAX = 45.25  # McLaren 2024 baseline


def round_100k(x: float) -> int:
    return round(x / 100_000) * 100_000


def power_curve_price(avg: float, entity_type: str, ref_max: float | None = None) -> int:
    floor = DRIVER_FLOOR if entity_type == "driver" else CONSTRUCTOR_FLOOR
    ceiling = DRIVER_CEILING if entity_type == "driver" else CONSTRUCTOR_CEILING
    if ref_max is None:
        ref_max = DRIVER_REF_MAX if entity_type == "driver" else CONSTRUCTOR_REF_MAX
    if avg is None or avg <= 0:
        return floor
    norm = max(0.0, min(1.0, avg / ref_max))
    return max(floor, round_100k(floor + (ceiling - floor) * norm ** SHAPE))


def fmt_m(x: int) -> str:
    return f"${x / 1e6:.1f}M"


# ── Load season data ───────────────────────────────────────────────────────

def load_season(year: int) -> tuple[dict[str, dict], dict[str, dict]]:
    """
    Load season totals and return (drivers, constructors).
    Each is {name: {"total": int, "races": int, "avg": float, "team": str}}.
    """
    drivers = {}
    path = OUTPUT_DIR / str(year) / "season_totals.csv"
    with open(path) as f:
        for row in csv.DictReader(f):
            total = int(row["season_total"])
            races = int(row["races_entered"])
            drivers[row["driver"]] = {
                "total": total,
                "races": races,
                "avg": total / races if races > 0 else 0,
                "team": row["team"],
            }

    constructors = {}
    path = OUTPUT_DIR / str(year) / "season_constructor_totals.csv"
    with open(path) as f:
        for row in csv.DictReader(f):
            constructors[row["constructor"]] = {
                "total": int(row["season_total"]),
            }

    return drivers, constructors


# Load all seasons
SEASONS = {}
CONSTRUCTORS = {}
for year in [2022, 2023, 2024, 2025]:
    SEASONS[year], CONSTRUCTORS[year] = load_season(year)

# Compute per-race averages per season
DRIVER_AVGS: dict[int, dict[str, float]] = {}
for year, drivers in SEASONS.items():
    DRIVER_AVGS[year] = {d: info["avg"] for d, info in drivers.items()}


# ── Team assignments per season (for constructor-context pricing) ──────────

def get_team_assignments(year: int) -> dict[str, str]:
    """Get driver → team mapping for a given season."""
    return {d: info["team"] for d, info in SEASONS[year].items()}


def get_constructor_per_driver_avg(year: int) -> dict[str, float]:
    """
    For each constructor, compute the average of its drivers' per-race averages.
    This is the per-driver average for that car.
    """
    teams = get_team_assignments(year)
    # Group drivers by team
    team_drivers: dict[str, list[float]] = {}
    for driver, team in teams.items():
        avg = DRIVER_AVGS[year].get(driver, 0)
        team_drivers.setdefault(team, []).append(avg)

    return {team: statistics.mean(avgs) for team, avgs in team_drivers.items()}


# ── Compute blended average ────────────────────────────────────────────────

MIN_RACES_FOR_INCLUSION = 10  # must have raced 10+ races in a season to count


def blended_avg(
    driver: str,
    target_year: int,
    weights: tuple[float, ...],
) -> float | None:
    """
    Compute a weighted multi-season average for a driver.

    weights[0] = weight for (target_year - 1)
    weights[1] = weight for (target_year - 2)
    weights[2] = weight for (target_year - 3) (if 3-year lookback)

    Returns None if the driver has no qualifying data in any lookback year.
    Renormalizes weights if only some years have data.
    """
    available = []
    for i, w in enumerate(weights):
        if w == 0:
            continue
        year = target_year - 1 - i
        if year in SEASONS and driver in SEASONS[year]:
            races = SEASONS[year][driver]["races"]
            if races >= MIN_RACES_FOR_INCLUSION:
                available.append((w, DRIVER_AVGS[year][driver]))

    if not available:
        return None

    total_weight = sum(w for w, _ in available)
    return sum(w * avg / total_weight for w, avg in available)


# ── Compute preseason prices ──────────────────────────────────────────────

def compute_preseason_prices(
    target_year: int,
    weights: tuple[float, ...],
    alpha: float = 0.5,
    use_blended_ref_max: bool = False,
) -> dict[str, int]:
    """
    Compute preseason driver prices for target_year using multi-season lookback.

    - Drivers with data: use blended multi-season average
    - Rookies (no data in any lookback year): use constructor-context pricing
    - Team changers: blend individual avg with new team's per-driver avg at α

    If use_blended_ref_max is True, REF_MAX is derived from the top driver's
    blended average (same formula), rather than using the fixed constant.
    """
    # Get driver → team for the target season (who they'll be driving for)
    if target_year in SEASONS:
        target_teams = get_team_assignments(target_year)
    else:
        # Can't determine — skip constructor context
        target_teams = {}

    # Get constructor per-driver averages from the most recent prior year
    prior_year = target_year - 1
    constructor_avg = get_constructor_per_driver_avg(prior_year)

    # Determine which team each driver was on in the prior year
    prior_teams = get_team_assignments(prior_year)

    # Compute blended averages for all drivers who appear in the target season
    drivers_in_target = set(SEASONS[target_year].keys()) if target_year in SEASONS else set()

    blended_avgs: dict[str, float | None] = {}
    for driver in drivers_in_target:
        blended_avgs[driver] = blended_avg(driver, target_year, weights)

    # Optionally compute REF_MAX from blended data
    ref_max = DRIVER_REF_MAX
    if use_blended_ref_max:
        valid_avgs = [a for a in blended_avgs.values() if a is not None and a > 0]
        if valid_avgs:
            ref_max = max(valid_avgs)

    # Compute prices
    prices: dict[str, int] = {}
    for driver in drivers_in_target:
        avg = blended_avgs[driver]
        new_team = target_teams.get(driver)
        old_team = prior_teams.get(driver)
        team_avg = constructor_avg.get(new_team, 0) if new_team else 0

        if avg is None:
            # Rookie / no qualifying data — use constructor context
            adj_avg = max(0, team_avg)
            prices[driver] = power_curve_price(adj_avg, "driver", ref_max)
        elif new_team and old_team and new_team != old_team:
            # Team changer — blend individual with new team
            adj_avg = alpha * avg + (1 - alpha) * team_avg
            adj_avg = max(0, adj_avg)
            prices[driver] = power_curve_price(adj_avg, "driver", ref_max)
        else:
            # Same team — use blended individual avg
            prices[driver] = power_curve_price(max(0, avg), "driver", ref_max)

    return prices


# ── Mispricing metric ─────────────────────────────────────────────────────

def compute_mispricing(
    prices: dict[str, int],
    target_year: int,
) -> dict[str, dict]:
    """
    Compare preseason prices against fair values.

    Fair value = power curve applied to actual target-year per-race average.
    Returns per-driver details and aggregate metrics.
    """
    fair_prices = {}
    for driver in prices:
        if driver in SEASONS[target_year]:
            actual_avg = SEASONS[target_year][driver]["avg"]
            fair_prices[driver] = power_curve_price(actual_avg, "driver")

    details = {}
    total_abs_error = 0
    for driver in prices:
        if driver not in fair_prices:
            continue
        predicted = prices[driver]
        fair = fair_prices[driver]
        error = predicted - fair
        abs_error = abs(error)
        total_abs_error += abs_error
        details[driver] = {
            "predicted": predicted,
            "fair": fair,
            "error": error,
            "abs_error": abs_error,
        }

    return {
        "details": details,
        "total_abs_error": total_abs_error,
        "avg_abs_error": total_abs_error / len(details) if details else 0,
        "max_abs_error": max((d["abs_error"] for d in details.values()), default=0),
        "max_error_driver": max(details, key=lambda d: details[d]["abs_error"], default=""),
    }


# ── Weight sweep ──────────────────────────────────────────────────────────

def generate_weight_combos(n_years: int, step: float = 0.05) -> list[tuple[float, ...]]:
    """Generate all weight combinations that sum to 1.0 with given step."""
    steps = int(round(1.0 / step))
    combos = []
    if n_years == 1:
        return [(1.0,)]
    elif n_years == 2:
        for w1 in range(steps + 1):
            w2 = steps - w1
            combos.append((w1 * step, w2 * step))
    elif n_years == 3:
        for w1 in range(steps + 1):
            for w2 in range(steps - w1 + 1):
                w3 = steps - w1 - w2
                combos.append((w1 * step, w2 * step, w3 * step))
    return combos


# ══════════════════════════════════════════════════════════════════════════
# ANALYSIS
# ══════════════════════════════════════════════════════════════════════════

print("=" * 80)
print("  MULTI-SEASON LOOKBACK ANALYSIS")
print("=" * 80)

# ── Part 0: Data overview ─────────────────────────────────────────────────

print(f"\n{'─' * 80}")
print(f"  DATA OVERVIEW")
print(f"{'─' * 80}")

for year in [2022, 2023, 2024, 2025]:
    drivers = SEASONS[year]
    n = len(drivers)
    total_races = max(d["races"] for d in drivers.values())
    top_driver = max(drivers, key=lambda d: drivers[d]["avg"])
    top_avg = drivers[top_driver]["avg"]
    print(f"  {year}: {n} drivers, {total_races} races, "
          f"top: {top_driver} ({top_avg:.2f} pts/race)")


# ── Part 1: Weight sweep for 2025 preseason (3-year lookback) ─────────────

print(f"\n{'─' * 80}")
print(f"  PART 1: WEIGHT SWEEP — 2025 PRESEASON (using 2022-2024 data)")
print(f"{'─' * 80}")

# Test all weight combinations for 3-year lookback
combos_3y = generate_weight_combos(3, step=0.05)
results_3y = []

for weights in combos_3y:
    prices = compute_preseason_prices(2025, weights)
    metrics = compute_mispricing(prices, 2025)
    results_3y.append({
        "weights": weights,
        "total_error": metrics["total_abs_error"],
        "avg_error": metrics["avg_abs_error"],
        "max_error": metrics["max_abs_error"],
        "max_driver": metrics["max_error_driver"],
    })

# Sort by total error
results_3y.sort(key=lambda r: r["total_error"])

# Also compute single-season baseline
baseline_prices = compute_preseason_prices(2025, (1.0,))
baseline_metrics = compute_mispricing(baseline_prices, 2025)

print(f"\n  BASELINE (single-season, 2024 only):")
print(f"    Total mispricing: {fmt_m(baseline_metrics['total_abs_error'])}")
print(f"    Avg per driver:   {fmt_m(int(baseline_metrics['avg_abs_error']))}")
print(f"    Worst:            {baseline_metrics['max_error_driver']} "
      f"({fmt_m(baseline_metrics['max_abs_error'])})")

# 2-year lookback best
combos_2y = generate_weight_combos(2, step=0.05)
results_2y = []
for weights in combos_2y:
    prices = compute_preseason_prices(2025, weights)
    metrics = compute_mispricing(prices, 2025)
    results_2y.append({
        "weights": weights,
        "total_error": metrics["total_abs_error"],
        "avg_error": metrics["avg_abs_error"],
        "max_error": metrics["max_abs_error"],
        "max_driver": metrics["max_error_driver"],
    })
results_2y.sort(key=lambda r: r["total_error"])

print(f"\n  TOP 10 WEIGHT COMBINATIONS — 3-YEAR LOOKBACK (2025 preseason):")
print(f"  {'Rank':<5} {'w1 (2024)':>10} {'w2 (2023)':>10} {'w3 (2022)':>10} "
      f"{'Total err':>12} {'Avg err':>10} {'Worst':>8} {'Δ vs baseline':>14}")
for i, r in enumerate(results_3y[:10]):
    w = r["weights"]
    delta = r["total_error"] - baseline_metrics["total_abs_error"]
    print(f"  {i+1:<5} {w[0]:>10.2f} {w[1]:>10.2f} {w[2]:>10.2f} "
          f"{fmt_m(r['total_error']):>12} {fmt_m(int(r['avg_error'])):>10} "
          f"{r['max_driver']:>8} {fmt_m(delta):>14}")

print(f"\n  TOP 5 WEIGHT COMBINATIONS — 2-YEAR LOOKBACK (2025 preseason):")
print(f"  {'Rank':<5} {'w1 (2024)':>10} {'w2 (2023)':>10} "
      f"{'Total err':>12} {'Avg err':>10} {'Worst':>8} {'Δ vs baseline':>14}")
for i, r in enumerate(results_2y[:5]):
    w = r["weights"]
    delta = r["total_error"] - baseline_metrics["total_abs_error"]
    print(f"  {i+1:<5} {w[0]:>10.2f} {w[1]:>10.2f} "
          f"{fmt_m(r['total_error']):>12} {fmt_m(int(r['avg_error'])):>10} "
          f"{r['max_driver']:>8} {fmt_m(delta):>14}")


# ── Part 2: Weight sweep for 2024 preseason (cross-validation) ────────────

print(f"\n{'─' * 80}")
print(f"  PART 2: WEIGHT SWEEP — 2024 PRESEASON (cross-validation, using 2022-2023)")
print(f"{'─' * 80}")

# Baseline for 2024: single-season (2023 only)
baseline_2024 = compute_preseason_prices(2024, (1.0,))
baseline_2024_metrics = compute_mispricing(baseline_2024, 2024)

# 2-year lookback for 2024
results_2024_2y = []
for weights in combos_2y:
    prices = compute_preseason_prices(2024, weights)
    metrics = compute_mispricing(prices, 2024)
    results_2024_2y.append({
        "weights": weights,
        "total_error": metrics["total_abs_error"],
        "avg_error": metrics["avg_abs_error"],
        "max_error": metrics["max_abs_error"],
        "max_driver": metrics["max_error_driver"],
    })
results_2024_2y.sort(key=lambda r: r["total_error"])

print(f"\n  BASELINE (single-season, 2023 only):")
print(f"    Total mispricing: {fmt_m(baseline_2024_metrics['total_abs_error'])}")
print(f"    Avg per driver:   {fmt_m(int(baseline_2024_metrics['avg_abs_error']))}")
print(f"    Worst:            {baseline_2024_metrics['max_error_driver']} "
      f"({fmt_m(baseline_2024_metrics['max_abs_error'])})")

print(f"\n  TOP 5 WEIGHT COMBINATIONS — 2-YEAR LOOKBACK (2024 preseason):")
print(f"  {'Rank':<5} {'w1 (2023)':>10} {'w2 (2022)':>10} "
      f"{'Total err':>12} {'Avg err':>10} {'Worst':>8} {'Δ vs baseline':>14}")
for i, r in enumerate(results_2024_2y[:5]):
    w = r["weights"]
    delta = r["total_error"] - baseline_2024_metrics["total_abs_error"]
    print(f"  {i+1:<5} {w[0]:>10.2f} {w[1]:>10.2f} "
          f"{fmt_m(r['total_error']):>12} {fmt_m(int(r['avg_error'])):>10} "
          f"{r['max_driver']:>8} {fmt_m(delta):>14}")


# ── Part 3: Stable weights across both target years ──────────────────────

print(f"\n{'─' * 80}")
print(f"  PART 3: COMBINED RANKING (sum of mispricing across 2024 + 2025)")
print(f"{'─' * 80}")

# For 2-year lookback: test same weights on both target years
combined_2y = []
for weights in combos_2y:
    prices_2025 = compute_preseason_prices(2025, weights)
    m2025 = compute_mispricing(prices_2025, 2025)
    prices_2024 = compute_preseason_prices(2024, weights)
    m2024 = compute_mispricing(prices_2024, 2024)
    combined_2y.append({
        "weights": weights,
        "total_2025": m2025["total_abs_error"],
        "total_2024": m2024["total_abs_error"],
        "combined": m2025["total_abs_error"] + m2024["total_abs_error"],
    })
combined_2y.sort(key=lambda r: r["combined"])

# Single-season baseline combined
baseline_combined = baseline_metrics["total_abs_error"] + baseline_2024_metrics["total_abs_error"]

print(f"\n  Baseline (single-season) combined: {fmt_m(baseline_combined)}")
print(f"    2025: {fmt_m(baseline_metrics['total_abs_error'])}  "
      f"2024: {fmt_m(baseline_2024_metrics['total_abs_error'])}")

print(f"\n  TOP 10 — 2-YEAR LOOKBACK (stable across both seasons):")
print(f"  {'Rank':<5} {'w1':>6} {'w2':>6} "
      f"{'2025 err':>10} {'2024 err':>10} {'Combined':>10} {'Δ vs base':>12}")
for i, r in enumerate(combined_2y[:10]):
    w = r["weights"]
    delta = r["combined"] - baseline_combined
    print(f"  {i+1:<5} {w[0]:>6.2f} {w[1]:>6.2f} "
          f"{fmt_m(r['total_2025']):>10} {fmt_m(r['total_2024']):>10} "
          f"{fmt_m(r['combined']):>10} {fmt_m(delta):>12}")


# ── Part 4: Per-driver impact analysis ────────────────────────────────────

print(f"\n{'─' * 80}")
print(f"  PART 4: PER-DRIVER IMPACT (best 3-year weights vs single-season, 2025)")
print(f"{'─' * 80}")

best_3y_weights = results_3y[0]["weights"]
best_3y_prices = compute_preseason_prices(2025, best_3y_weights)
best_3y_metrics = compute_mispricing(best_3y_prices, 2025)
baseline_details = compute_mispricing(baseline_prices, 2025)["details"]
best_3y_details = best_3y_metrics["details"]

print(f"\n  Best 3-year weights: {best_3y_weights}")
print(f"  Total mispricing: single={fmt_m(baseline_metrics['total_abs_error'])}, "
      f"3-year={fmt_m(best_3y_metrics['total_abs_error'])}, "
      f"Δ={fmt_m(best_3y_metrics['total_abs_error'] - baseline_metrics['total_abs_error'])}")

# Sort drivers by improvement (biggest reduction in mispricing)
drivers_impact = []
for d in best_3y_details:
    if d in baseline_details:
        old_err = baseline_details[d]["abs_error"]
        new_err = best_3y_details[d]["abs_error"]
        drivers_impact.append({
            "driver": d,
            "old_err": old_err,
            "new_err": new_err,
            "improvement": old_err - new_err,
            "old_price": baseline_details[d]["predicted"],
            "new_price": best_3y_details[d]["predicted"],
            "fair": best_3y_details[d]["fair"],
        })

drivers_impact.sort(key=lambda d: -d["improvement"])

print(f"\n  {'Driver':<6} {'Fair':>8} {'1-yr price':>10} {'3-yr price':>10} "
      f"{'1-yr err':>10} {'3-yr err':>10} {'Δ err':>10}")
for d in drivers_impact:
    print(f"  {d['driver']:<6} {fmt_m(d['fair']):>8} "
          f"{fmt_m(d['old_price']):>10} {fmt_m(d['new_price']):>10} "
          f"{fmt_m(d['old_err']):>10} {fmt_m(d['new_err']):>10} "
          f"{fmt_m(-d['improvement']):>10}")


# ── Part 5: REF_MAX sensitivity ───────────────────────────────────────────

print(f"\n{'─' * 80}")
print(f"  PART 5: REF_MAX SENSITIVITY (fixed vs blended)")
print(f"{'─' * 80}")

for label, weights in [("single-season", (1.0,)), ("best 3-year", best_3y_weights)]:
    fixed_prices = compute_preseason_prices(2025, weights, use_blended_ref_max=False)
    blended_prices = compute_preseason_prices(2025, weights, use_blended_ref_max=True)
    fixed_m = compute_mispricing(fixed_prices, 2025)
    blended_m = compute_mispricing(blended_prices, 2025)

    # Find what the blended REF_MAX would be
    all_blended = [blended_avg(d, 2025, weights) for d in SEASONS[2025]]
    valid = [a for a in all_blended if a is not None and a > 0]
    blended_ref = max(valid) if valid else DRIVER_REF_MAX

    print(f"\n  {label} weights={weights}:")
    print(f"    Fixed REF_MAX:   {DRIVER_REF_MAX:.2f} → mispricing {fmt_m(fixed_m['total_abs_error'])}")
    print(f"    Blended REF_MAX: {blended_ref:.2f} → mispricing {fmt_m(blended_m['total_abs_error'])}")
    print(f"    Δ: {fmt_m(blended_m['total_abs_error'] - fixed_m['total_abs_error'])}")


print(f"\n{'=' * 80}")
print("  ANALYSIS COMPLETE")
print(f"{'=' * 80}")
