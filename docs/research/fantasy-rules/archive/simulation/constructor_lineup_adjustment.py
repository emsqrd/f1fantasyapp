"""
constructor_lineup_adjustment.py — Quantify constructor preseason mispricing
caused by lineup changes between 2024 and 2025.

The hypothesis: constructor preseason prices are based on 2024 constructor avg,
which includes contributions from drivers who have since departed. When a strong
driver leaves and a weaker/rookie arrives (or vice versa), the constructor price
doesn't reflect the known lineup change.

This script:
1. Maps all 2024→2025 lineup changes per constructor
2. Computes the unadjusted constructor preseason price (current model)
3. Computes lineup-adjusted constructor preseason prices under several
   estimation approaches for incoming drivers
4. Compares both to the "fair" price based on actual 2025 constructor performance
5. Summarises total mispricing improvement (or lack thereof)
"""

import csv
from pathlib import Path

SIM_DIR = Path(__file__).parent
OUTPUT_DIR = SIM_DIR / "output"

# ── Pricing parameters (from pricing.py) ─────────────────────────────────

CONSTRUCTOR_FLOOR = 6_000_000
CONSTRUCTOR_CEILING = 25_000_000
CONSTRUCTOR_REF_MAX = 45.25
SHAPE = 1.0
TOTAL_RACES = 24
MIN_RACES_ELIGIBLE = 10


def round_100k(x: float) -> int:
    return round(x / 100_000) * 100_000


def power_curve_price(avg: float | None, ref_max: float, floor: int, ceiling: int) -> int:
    if avg is None or avg <= 0:
        return floor
    norm = max(0.0, min(1.0, avg / ref_max))
    return max(floor, round_100k(floor + (ceiling - floor) * norm ** SHAPE))


def constructor_price(avg: float | None) -> int:
    return power_curve_price(avg, CONSTRUCTOR_REF_MAX, CONSTRUCTOR_FLOOR, CONSTRUCTOR_CEILING)


def fmt_m(x: int | float) -> str:
    return f"${x / 1e6:.1f}M"


def fmt_avg(x: float | None) -> str:
    return f"{x:.2f}" if x is not None else "—"


# ── Load 2024 data ───────────────────────────────────────────────────────

# Driver season totals (2024)
driver_2024: dict[str, dict] = {}
with open(OUTPUT_DIR / "2024/season_totals.csv") as f:
    for row in csv.DictReader(f):
        races = int(row["races_entered"])
        total = int(row["season_total"])
        avg = total / races if races >= MIN_RACES_ELIGIBLE else None
        driver_2024[row["driver"]] = {
            "team": row["team"],
            "total": total,
            "races": races,
            "avg": avg,
        }

# Constructor season totals (2024)
constructor_2024: dict[str, dict] = {}
with open(OUTPUT_DIR / "2024/season_constructor_totals.csv") as f:
    for row in csv.DictReader(f):
        total = int(row["season_total"])
        avg = total / TOTAL_RACES
        constructor_2024[row["constructor"]] = {
            "total": total,
            "avg": avg,
        }

# ── Load 2025 data ───────────────────────────────────────────────────────

# Driver season totals (2025) — for actual team assignments and fair price calc
driver_2025: dict[str, dict] = {}
with open(OUTPUT_DIR / "2025/season_totals.csv") as f:
    for row in csv.DictReader(f):
        races = int(row["races_entered"])
        total = int(row["season_total"])
        driver_2025[row["driver"]] = {
            "team": row["team"],
            "total": total,
            "races": races,
            "avg": total / races if races > 0 else 0,
        }

# Constructor season totals (2025) — for fair price calc
constructor_2025: dict[str, dict] = {}
with open(OUTPUT_DIR / "2025/season_constructor_totals.csv") as f:
    for row in csv.DictReader(f):
        total = int(row["season_total"])
        avg = total / TOTAL_RACES
        constructor_2025[row["constructor"]] = {
            "total": total,
            "avg": avg,
        }

# ── Map constructor name changes ─────────────────────────────────────────

# RB → Racing Bulls, same physical team
NAME_MAP_2024_TO_2025 = {
    "RB": "Racing Bulls",
}


def normalise_name(name: str) -> str:
    return NAME_MAP_2024_TO_2025.get(name, name)


# ── Build 2024 and 2025 rosters per constructor ─────────────────────────

def build_roster(driver_data: dict, label: str) -> dict[str, list[str]]:
    """Build {constructor: [driver, ...]} from driver data."""
    rosters: dict[str, list[str]] = {}
    for driver, info in driver_data.items():
        team = normalise_name(info["team"])
        rosters.setdefault(team, []).append(driver)
    return rosters


roster_2024 = build_roster(driver_2024, "2024")
roster_2025 = build_roster(driver_2025, "2025")

# ── Identify lineup changes ─────────────────────────────────────────────

print("=" * 90)
print("  CONSTRUCTOR LINEUP-CHANGE ADJUSTMENT — MISPRICING QUANTIFICATION")
print("=" * 90)

print(f"\n  ── 2024 → 2025 Lineup Changes ─────────────────────────────────────────")

# All constructors present in 2025
all_constructors = sorted(constructor_2025.keys())

lineup_changes: dict[str, dict] = {}

for constructor in all_constructors:
    # Normalise: find the 2024 name for this constructor
    c2024_name = constructor
    for old, new in NAME_MAP_2024_TO_2025.items():
        if new == constructor:
            c2024_name = old
            break

    drivers_2024 = set(roster_2024.get(c2024_name, []))
    drivers_2025 = set(roster_2025.get(constructor, []))

    departed = drivers_2024 - drivers_2025
    arrived = drivers_2025 - drivers_2024
    stayed = drivers_2024 & drivers_2025

    if departed or arrived:
        lineup_changes[constructor] = {
            "c2024_name": c2024_name,
            "departed": departed,
            "arrived": arrived,
            "stayed": stayed,
        }

for c, changes in sorted(lineup_changes.items()):
    departed_str = ", ".join(
        f"{d} ({fmt_avg(driver_2024[d]['avg'])} avg)" if d in driver_2024 else f"{d} (no 2024 data)"
        for d in sorted(changes["departed"])
    )
    arrived_str = ", ".join(
        f"{d} ({fmt_avg(driver_2024[d]['avg'])} avg)" if d in driver_2024 and driver_2024[d]["avg"] is not None
        else f"{d} (rookie/no data)"
        for d in sorted(changes["arrived"])
    )
    stayed_str = ", ".join(sorted(changes["stayed"]))
    print(f"\n  {c}:")
    print(f"    Departed: {departed_str}")
    print(f"    Arrived:  {arrived_str}")
    print(f"    Stayed:   {stayed_str}")

# ── Compute adjusted constructor averages ────────────────────────────────

print(f"\n\n  ── Constructor Average Decomposition (2024) ─────────────────────────")
print(f"  {'Constructor':<22} {'Constr avg':>11} {'Driver sum':>11} {'Penalty δ':>10}")

for c in all_constructors:
    c2024_name = c
    for old, new in NAME_MAP_2024_TO_2025.items():
        if new == c:
            c2024_name = old
            break

    if c2024_name not in constructor_2024:
        continue

    c_avg = constructor_2024[c2024_name]["avg"]
    drivers = roster_2024.get(c2024_name, [])

    # Sum individual driver per-race avgs (using per_race = total / TOTAL_RACES
    # to match how constructor avg is computed — over all 24 rounds)
    driver_sum = sum(driver_2024[d]["total"] / TOTAL_RACES for d in drivers if d in driver_2024)
    penalty_delta = c_avg - driver_sum

    print(f"  {c:<22} {c_avg:>10.2f} {driver_sum:>11.2f} {penalty_delta:>10.2f}")


# ── Compute lineup-adjusted prices ───────────────────────────────────────

print(f"\n\n  ── Lineup-Adjusted Constructor Pricing ───────────────────────────────")
print(f"\n  Approach: Replace departed driver's per-race avg with incoming driver's")
print(f"  expected avg in the constructor's overall average, then reprice.")
print(f"\n  For incoming drivers' expected avg:")
print(f"    Scenario A: Individual 2024 avg (rookies → staying driver's avg)")
print(f"    Scenario B: Individual 2024 avg (rookies → team per-driver avg)")
print(f"    Scenario C: Context-blended avg (α=0.5 for team changers, team avg for rookies)")
print()


def compute_adjusted_constructor_avg(
    constructor: str,
    changes: dict,
    incoming_avg_fn,
) -> float:
    """
    Compute the lineup-adjusted constructor average.

    Takes the 2024 constructor avg, subtracts departed drivers' per-race
    contributions (total / TOTAL_RACES), adds incoming drivers' expected avgs.
    """
    c2024_name = changes["c2024_name"]
    base_avg = constructor_2024[c2024_name]["avg"]

    # Subtract departed drivers' per-race contribution to the constructor
    for d in changes["departed"]:
        if d in driver_2024:
            # Use total/24 (not per_race avg which excludes <10 race drivers)
            d_contribution = driver_2024[d]["total"] / TOTAL_RACES
            base_avg -= d_contribution

    # Add incoming drivers' expected contribution
    for d in changes["arrived"]:
        expected = incoming_avg_fn(d, constructor, changes)
        base_avg += expected

    return base_avg


def scenario_a_avg(driver: str, constructor: str, changes: dict) -> float:
    """Individual 2024 avg; rookies → staying driver's avg."""
    if driver in driver_2024 and driver_2024[driver]["avg"] is not None:
        return driver_2024[driver]["avg"]
    # Rookie: use average of staying drivers' per-race avgs
    stayed_avgs = []
    for d in changes["stayed"]:
        if d in driver_2024 and driver_2024[d]["avg"] is not None:
            stayed_avgs.append(driver_2024[d]["avg"])
    return sum(stayed_avgs) / len(stayed_avgs) if stayed_avgs else 0


def scenario_b_avg(driver: str, constructor: str, changes: dict) -> float:
    """Individual 2024 avg; rookies → team per-driver avg (includes departed)."""
    if driver in driver_2024 and driver_2024[driver]["avg"] is not None:
        return driver_2024[driver]["avg"]
    # Rookie: use team per-driver avg from 2024 constructor
    c2024_name = changes["c2024_name"]
    if c2024_name in constructor_2024:
        return constructor_2024[c2024_name]["avg"] / 2.0
    return 0


def scenario_c_avg(driver: str, constructor: str, changes: dict) -> float:
    """Context-blended: α=0.5 blend for team changers; team avg for rookies."""
    alpha = 0.5
    c2024_name = changes["c2024_name"]
    team_per_driver = constructor_2024[c2024_name]["avg"] / 2.0 if c2024_name in constructor_2024 else 0

    if driver in driver_2024 and driver_2024[driver]["avg"] is not None:
        individual = driver_2024[driver]["avg"]
        old_team = normalise_name(driver_2024[driver]["team"])
        if old_team != constructor:
            # Team changer — blend
            return max(0, alpha * individual + (1 - alpha) * team_per_driver)
        else:
            return individual
    # Rookie: team per-driver avg
    return max(0, team_per_driver)


scenarios = {
    "A (rookie→staying drv)": scenario_a_avg,
    "B (rookie→team avg)": scenario_b_avg,
    "C (context α=0.5)": scenario_c_avg,
}

# ── Results table ────────────────────────────────────────────────────────

print(f"  {'Constructor':<22} {'2024 avg':>9} {'Fair avg':>9} {'Fair $':>9} {'Current $':>10} "
      f"{'Curr err':>9}", end="")
for label in scenarios:
    print(f" {'Adj $':>9} {'Adj err':>8}", end="")
print()

print(f"  {'-'*22} {'-'*9} {'-'*9} {'-'*9} {'-'*10} {'-'*9}", end="")
for _ in scenarios:
    print(f" {'-'*9} {'-'*8}", end="")
print()

total_current_error = 0
total_scenario_errors = {label: 0 for label in scenarios}
changed_current_error = 0
changed_scenario_errors = {label: 0 for label in scenarios}

for c in all_constructors:
    c2024_name = c
    for old, new in NAME_MAP_2024_TO_2025.items():
        if new == c:
            c2024_name = old
            break

    if c2024_name not in constructor_2024:
        continue

    c2024_avg = constructor_2024[c2024_name]["avg"]
    c2025_avg = constructor_2025[c]["avg"] if c in constructor_2025 else 0

    fair_price = constructor_price(c2025_avg)
    current_price = constructor_price(c2024_avg)
    current_err = abs(current_price - fair_price)
    total_current_error += current_err

    has_changes = c in lineup_changes

    row = f"  {c:<22} {c2024_avg:>9.2f} {c2025_avg:>9.2f} {fmt_m(fair_price):>9} {fmt_m(current_price):>10} "
    row += f"{fmt_m(current_err):>9}"

    if has_changes:
        changed_current_error += current_err

    for label, avg_fn in scenarios.items():
        if has_changes:
            adj_avg = compute_adjusted_constructor_avg(c, lineup_changes[c], avg_fn)
            adj_price = constructor_price(adj_avg)
            adj_err = abs(adj_price - fair_price)
            total_scenario_errors[label] += adj_err
            changed_scenario_errors[label] += adj_err
            row += f" {fmt_m(adj_price):>9} {fmt_m(adj_err):>8}"
        else:
            # No lineup change — price is the same as current
            total_scenario_errors[label] += current_err
            row += f" {'—':>9} {'—':>8}"

    if has_changes:
        row += "  ← changed"
    print(row)


# ── Summary ──────────────────────────────────────────────────────────────

print(f"\n\n  ── Summary: Total Constructor Mispricing ─────────────────────────────")
print(f"\n  All constructors (10 total):")
print(f"    Current model:        {fmt_m(total_current_error)}")
for label, err in total_scenario_errors.items():
    delta = err - total_current_error
    direction = "better" if delta < 0 else "worse" if delta > 0 else "same"
    print(f"    Scenario {label}: {fmt_m(err)}  ({fmt_m(abs(delta))} {direction})")

n_changed = len(lineup_changes)
print(f"\n  Constructors with lineup changes only ({n_changed} of 10):")
print(f"    Current model:        {fmt_m(changed_current_error)}")
for label, err in changed_scenario_errors.items():
    delta = err - changed_current_error
    direction = "better" if delta < 0 else "worse" if delta > 0 else "same"
    print(f"    Scenario {label}: {fmt_m(err)}  ({fmt_m(abs(delta))} {direction})")


# ── Per-constructor breakdown ────────────────────────────────────────────

print(f"\n\n  ── Per-Constructor Detail (changed constructors only) ────────────────")

for c in sorted(lineup_changes.keys()):
    changes = lineup_changes[c]
    c2024_name = changes["c2024_name"]
    c2024_avg = constructor_2024[c2024_name]["avg"]
    c2025_avg = constructor_2025[c]["avg"] if c in constructor_2025 else 0

    fair_price = constructor_price(c2025_avg)
    current_price = constructor_price(c2024_avg)
    current_err = current_price - fair_price  # signed

    print(f"\n  {c}")
    print(f"    2024 constructor avg: {c2024_avg:.2f}")
    print(f"    2025 actual avg:      {c2025_avg:.2f}")
    print(f"    Current price: {fmt_m(current_price)} → Fair: {fmt_m(fair_price)} → Error: {'+' if current_err >= 0 else ''}{fmt_m(current_err)}")

    # Show driver-level breakdown
    print(f"    Departed drivers' contributions (total_2024 / 24):")
    for d in sorted(changes["departed"]):
        if d in driver_2024:
            contrib = driver_2024[d]["total"] / TOTAL_RACES
            print(f"      {d}: {contrib:.2f} pts/race")
        else:
            print(f"      {d}: (not in 2024 data)")

    print(f"    Incoming drivers' estimated contributions:")
    for label, avg_fn in scenarios.items():
        print(f"      Scenario {label}:")
        for d in sorted(changes["arrived"]):
            expected = avg_fn(d, c, changes)
            actual_2025 = driver_2025[d]["avg"] if d in driver_2025 else 0
            print(f"        {d}: est {expected:.2f} → actual {actual_2025:.2f} pts/race")

    for label, avg_fn in scenarios.items():
        adj_avg = compute_adjusted_constructor_avg(c, changes, avg_fn)
        adj_price = constructor_price(adj_avg)
        adj_err = adj_price - fair_price  # signed
        print(f"    Scenario {label}: avg {adj_avg:.2f} → {fmt_m(adj_price)} → Error: {'+' if adj_err >= 0 else ''}{fmt_m(adj_err)}")


# ── Direction analysis ───────────────────────────────────────────────────

print(f"\n\n  ── Direction Analysis ─────────────────────────────────────────────────")
print(f"  Does the adjustment move prices in the right direction?")
print()
print(f"  {'Constructor':<22} {'Current err':>12} ", end="")
for label in scenarios:
    short = label.split("(")[0].strip()
    print(f" {short+' err':>12} {short+' dir':>8}", end="")
print()

for c in sorted(lineup_changes.keys()):
    changes = lineup_changes[c]
    c2024_name = changes["c2024_name"]
    c2024_avg = constructor_2024[c2024_name]["avg"]
    c2025_avg = constructor_2025[c]["avg"] if c in constructor_2025 else 0

    fair_price = constructor_price(c2025_avg)
    current_price = constructor_price(c2024_avg)
    current_err = current_price - fair_price

    row = f"  {c:<22} {'+' if current_err >= 0 else ''}{fmt_m(current_err):>11} "
    for label, avg_fn in scenarios.items():
        adj_avg = compute_adjusted_constructor_avg(c, changes, avg_fn)
        adj_price = constructor_price(adj_avg)
        adj_err = adj_price - fair_price
        # Direction: ✓ if |adj_err| < |current_err|, ✗ if worse, — if same
        if abs(adj_err) < abs(current_err):
            direction = "better"
        elif abs(adj_err) > abs(current_err):
            direction = "worse"
        else:
            direction = "same"
        short = label.split("(")[0].strip()
        row += f" {'+' if adj_err >= 0 else ''}{fmt_m(adj_err):>11} {direction:>8}"
    print(row)


print(f"\n{'=' * 90}")
print(f"  ANALYSIS COMPLETE")
print(f"{'=' * 90}")
