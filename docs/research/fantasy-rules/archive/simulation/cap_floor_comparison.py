"""
cap_floor_comparison.py — Quick comparison of team feasibility under two budget regimes.

Baseline:  $115M cap, $2M rookie/driver floor  (current)
New:       $110M cap, $6M rookie/driver floor

Uses preseason_prices_2025.csv (power curve) and 2025 season totals.
Reports:
  - How many teams are feasible under each regime
  - Teams within 80% of best
  - Best team composition (drivers + constructors)
  - Dream team tightness
  - "Top-end" pick breakdown for the best teams
"""

import csv
import itertools
from pathlib import Path

SIM_DIR = Path(__file__).parent
OUTPUT_DIR = SIM_DIR / "output"
PRICING_DIR = OUTPUT_DIR / "pricing"
DATA_2025_DIR = OUTPUT_DIR / "2025"

TEAM_DRIVERS = 5
TEAM_CONSTRUCTORS = 3
CONSTRUCTOR_FLOOR = 6_000_000

# "Top-end" threshold: entities priced significantly above the new $6M floor
TOP_END_THRESHOLD = 10_000_000  # $10M+


def load_preseason_prices(path: Path) -> tuple[dict[str, int], dict[str, int]]:
    driver_prices: dict[str, int] = {}
    constructor_prices: dict[str, int] = {}
    with open(path) as f:
        for row in csv.DictReader(f):
            price = int(row["preseason_price"])
            if row["type"] == "driver":
                driver_prices[row["entity"]] = price
            else:
                constructor_prices[row["entity"]] = price
    return driver_prices, constructor_prices


def load_season_totals(path: Path) -> dict[str, int]:
    totals: dict[str, int] = {}
    with open(path) as f:
        for row in csv.DictReader(f):
            if "driver" in row:
                totals[row["driver"]] = int(row["season_total"])
            elif "constructor" in row:
                totals[row["constructor"]] = int(row["season_total"])
    return totals


def apply_floor(prices: dict[str, int], new_floor: int) -> dict[str, int]:
    """Raise any price below new_floor to new_floor."""
    return {k: max(v, new_floor) for k, v in prices.items()}


def enumerate_teams(
    driver_prices: dict[str, int],
    constructor_prices: dict[str, int],
    driver_scores: dict[str, int],
    constructor_scores: dict[str, int],
    budget_cap: int,
) -> dict:
    d_names = sorted(driver_prices)
    c_names = sorted(constructor_prices)
    d_costs = [driver_prices[d] for d in d_names]
    c_costs = [constructor_prices[c] for c in c_names]
    d_scores_list = [driver_scores.get(d, 0) for d in d_names]
    c_scores_list = [constructor_scores.get(c, 0) for c in c_names]

    c_combos = list(itertools.combinations(range(len(c_names)), TEAM_CONSTRUCTORS))
    c_combo_costs = [sum(c_costs[i] for i in combo) for combo in c_combos]
    c_combo_scores = [sum(c_scores_list[i] for i in combo) for combo in c_combos]
    min_c_cost = min(c_combo_costs) if c_combo_costs else 0

    feasible_scores: list[int] = []
    best_score = -1
    best_d_combo: tuple | None = None
    best_c_idx: int | None = None
    best_cost = 0

    for d_combo in itertools.combinations(range(len(d_names)), TEAM_DRIVERS):
        d_cost = sum(d_costs[i] for i in d_combo)
        remaining = budget_cap - d_cost
        if remaining < min_c_cost:
            continue
        d_score = sum(d_scores_list[i] for i in d_combo)
        for ci, c_cost in enumerate(c_combo_costs):
            if c_cost <= remaining:
                total = d_score + c_combo_scores[ci]
                feasible_scores.append(total)
                if total > best_score:
                    best_score = total
                    best_d_combo = d_combo
                    best_c_idx = ci
                    best_cost = d_cost + c_cost

    if not feasible_scores:
        return {"feasible": 0, "best_score": 0, "within_80pct": 0,
                "best_drivers": [], "best_constructors": [], "best_cost": 0}

    within_80 = sum(1 for s in feasible_scores if s >= 0.8 * best_score)
    best_drivers = [d_names[i] for i in best_d_combo]
    best_constructors = [c_names[i] for i in c_combos[best_c_idx]]

    return {
        "feasible": len(feasible_scores),
        "best_score": best_score,
        "within_80pct": within_80,
        "best_drivers": best_drivers,
        "best_constructors": best_constructors,
        "best_cost": best_cost,
    }


def dream_team_cost(
    driver_prices: dict[str, int],
    constructor_prices: dict[str, int],
    driver_scores: dict[str, int],
    constructor_scores: dict[str, int],
) -> tuple[int, list[str], list[str]]:
    top_d = sorted(driver_scores, key=lambda d: -driver_scores[d])[:TEAM_DRIVERS]
    top_c = sorted(constructor_scores, key=lambda c: -constructor_scores[c])[:TEAM_CONSTRUCTORS]
    cost = (sum(driver_prices.get(d, 0) for d in top_d)
            + sum(constructor_prices.get(c, 0) for c in top_c))
    return cost, top_d, top_c


def top_end_count(
    drivers: list[str],
    constructors: list[str],
    driver_prices: dict[str, int],
    constructor_prices: dict[str, int],
    threshold: int,
) -> int:
    return (sum(1 for d in drivers if driver_prices.get(d, 0) >= threshold)
            + sum(1 for c in constructors if constructor_prices.get(c, 0) >= threshold))


def fmt_m(x: int) -> str:
    return f"${x/1e6:.1f}M"


def print_scenario(
    label: str,
    budget_cap: int,
    driver_floor: int,
    driver_prices_raw: dict[str, int],
    constructor_prices: dict[str, int],
    driver_scores: dict[str, int],
    constructor_scores: dict[str, int],
) -> None:
    driver_prices = apply_floor(driver_prices_raw, driver_floor)

    result = enumerate_teams(
        driver_prices, constructor_prices,
        driver_scores, constructor_scores,
        budget_cap,
    )

    dt_cost, dt_drivers, dt_constructors = dream_team_cost(
        driver_prices, constructor_prices, driver_scores, constructor_scores
    )
    tightness = dt_cost / budget_cap

    best_top_end = top_end_count(
        result["best_drivers"], result["best_constructors"],
        driver_prices, constructor_prices, TOP_END_THRESHOLD,
    )

    print(f"\n{'═'*60}")
    print(f"  {label}")
    print(f"{'═'*60}")
    print(f"  Budget cap:         {fmt_m(budget_cap)}")
    print(f"  Driver floor:       {fmt_m(driver_floor)}")
    print(f"  Constructor floor:  {fmt_m(CONSTRUCTOR_FLOOR)}")
    print(f"\n  Dream team cost:    {fmt_m(dt_cost)} ({tightness:.1%} of cap)  [P1 target: 125–140%]")
    print(f"    Drivers:    {', '.join(dt_drivers)}")
    print(f"    Constr.:    {', '.join(dt_constructors)}")
    print(f"\n  Feasible teams:     {result['feasible']:,}")
    print(f"  Within 80% of best: {result['within_80pct']:,}")
    print(f"\n  Best affordable team  ({fmt_m(result['best_cost'])}):")
    print(f"    Drivers:    {', '.join(result['best_drivers'])}")
    print(f"    Constr.:    {', '.join(result['best_constructors'])}")
    print(f"    Score:      {result['best_score']:,} pts")
    print(f"    Top-end (≥{fmt_m(TOP_END_THRESHOLD)}) picks: {best_top_end}/8")

    # Show price of each pick in best team
    print(f"\n  Best team price breakdown:")
    for d in result["best_drivers"]:
        tag = " ★" if driver_prices.get(d, 0) >= TOP_END_THRESHOLD else ""
        print(f"    {d:<8} {fmt_m(driver_prices.get(d, 0)):>8}{tag}")
    for c in result["best_constructors"]:
        tag = " ★" if constructor_prices.get(c, 0) >= TOP_END_THRESHOLD else ""
        print(f"    {c:<22} {fmt_m(constructor_prices.get(c, 0)):>8}{tag}")

    # Show top-5 teams (just score + composition)
    print(f"\n  Top affordable drivers by 2025 score:")
    top_drivers_scored = sorted(driver_prices, key=lambda d: -driver_scores.get(d, 0))[:8]
    for d in top_drivers_scored:
        p = driver_prices[d]
        s = driver_scores.get(d, 0)
        tag = " ★" if p >= TOP_END_THRESHOLD else ""
        print(f"    {d:<8}  {fmt_m(p):>8}  {s:>5} pts{tag}")


def main() -> None:
    # Load data
    driver_prices_raw, constructor_prices = load_preseason_prices(
        PRICING_DIR / "preseason_prices_2025.csv"
    )

    driver_scores_raw: dict[str, int] = {}
    constructor_scores_raw: dict[str, int] = {}
    with open(DATA_2025_DIR / "season_totals.csv") as f:
        for row in csv.DictReader(f):
            driver_scores_raw[row["driver"]] = int(row["season_total"])
    with open(DATA_2025_DIR / "season_constructor_totals.csv") as f:
        for row in csv.DictReader(f):
            constructor_scores_raw[row["constructor"]] = int(row["season_total"])

    print(f"\nTop-end threshold: {fmt_m(TOP_END_THRESHOLD)} (★ = top-end pick)")

    print_scenario(
        "BASELINE: $115M cap, $2M driver floor",
        budget_cap=115_000_000,
        driver_floor=2_000_000,
        driver_prices_raw=driver_prices_raw,
        constructor_prices=constructor_prices,
        driver_scores=driver_scores_raw,
        constructor_scores=constructor_scores_raw,
    )

    print_scenario(
        "NEW: $110M cap, $6M driver floor",
        budget_cap=110_000_000,
        driver_floor=6_000_000,
        driver_prices_raw=driver_prices_raw,
        constructor_prices=constructor_prices,
        driver_scores=driver_scores_raw,
        constructor_scores=constructor_scores_raw,
    )

    # Show how floor change affects specific rookie prices
    print(f"\n\n{'═'*60}")
    print("  Floor impact on rookies (driver prices that change)")
    print(f"{'═'*60}")
    for d, p in sorted(driver_prices_raw.items(), key=lambda x: x[1]):
        new_p = max(p, 6_000_000)
        if new_p != p:
            print(f"  {d:<8}  {fmt_m(p):>8}  →  {fmt_m(new_p)}")
        else:
            pass  # unchanged


if __name__ == "__main__":
    main()
