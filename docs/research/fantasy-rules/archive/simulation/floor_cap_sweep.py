"""
floor_cap_sweep.py — Find the cap/floor combination where the optimal team
                     transitions to at most 4 top-end picks (≥$10M).

Sweeps:
  - Budget cap:         $100M – $115M in $1M steps
  - Driver floor:       $4M – $9M in $1M steps
  - Constructor floor:  $3M – $8M in $1M steps

For each combo: enumerate all feasible teams, record the best team's top-end count.
Reports the threshold combinations and a summary table.
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
TOP_END_THRESHOLD = 10_000_000  # $10M


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


def apply_floors(
    driver_prices_raw: dict[str, int],
    constructor_prices_raw: dict[str, int],
    driver_floor: int,
    constructor_floor: int,
) -> tuple[dict[str, int], dict[str, int]]:
    return (
        {k: max(v, driver_floor) for k, v in driver_prices_raw.items()},
        {k: max(v, constructor_floor) for k, v in constructor_prices_raw.items()},
    )


def best_team(
    driver_prices: dict[str, int],
    constructor_prices: dict[str, int],
    driver_scores: dict[str, int],
    constructor_scores: dict[str, int],
    budget_cap: int,
) -> dict:
    """Return the best-scoring feasible team and its top-end count."""
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

    best_score = -1
    best_d_combo: tuple | None = None
    best_c_idx: int | None = None
    best_cost = 0
    feasible = 0

    for d_combo in itertools.combinations(range(len(d_names)), TEAM_DRIVERS):
        d_cost = sum(d_costs[i] for i in d_combo)
        remaining = budget_cap - d_cost
        if remaining < min_c_cost:
            continue
        d_score = sum(d_scores_list[i] for i in d_combo)
        for ci, c_cost in enumerate(c_combo_costs):
            if c_cost <= remaining:
                feasible += 1
                total = d_score + c_combo_scores[ci]
                if total > best_score:
                    best_score = total
                    best_d_combo = d_combo
                    best_c_idx = ci
                    best_cost = d_cost + c_cost

    if best_d_combo is None:
        return {"feasible": 0, "best_score": 0, "top_end": 0,
                "drivers": [], "constructors": [], "cost": 0}

    drivers = [d_names[i] for i in best_d_combo]
    constructors = [c_names[i] for i in c_combos[best_c_idx]]
    top_end = (
        sum(1 for d in drivers if driver_prices.get(d, 0) >= TOP_END_THRESHOLD)
        + sum(1 for c in constructors if constructor_prices.get(c, 0) >= TOP_END_THRESHOLD)
    )
    return {
        "feasible": feasible,
        "best_score": best_score,
        "top_end": top_end,
        "drivers": drivers,
        "constructors": constructors,
        "cost": best_cost,
    }


def fmt_m(x: int) -> str:
    return f"${x//1_000_000}M"


def main() -> None:
    driver_prices_raw, constructor_prices_raw = load_preseason_prices(
        PRICING_DIR / "preseason_prices_2025.csv"
    )

    driver_scores: dict[str, int] = {}
    constructor_scores: dict[str, int] = {}
    with open(DATA_2025_DIR / "season_totals.csv") as f:
        for row in csv.DictReader(f):
            driver_scores[row["driver"]] = int(row["season_total"])
    with open(DATA_2025_DIR / "season_constructor_totals.csv") as f:
        for row in csv.DictReader(f):
            constructor_scores[row["constructor"]] = int(row["season_total"])

    caps = range(100_000_000, 116_000_000, 1_000_000)   # $100M–$115M
    d_floors = range(4_000_000, 10_000_000, 1_000_000)  # $4M–$9M
    c_floors = range(3_000_000, 9_000_000, 1_000_000)   # $3M–$8M

    total = len(list(caps)) * len(list(d_floors)) * len(list(c_floors))
    print(f"Sweeping {total} combinations...\n")

    # Results: (cap, d_floor, c_floor) → top_end_count
    results: list[tuple[int, int, int, int, dict]] = []

    done = 0
    for cap in caps:
        for df in d_floors:
            for cf in c_floors:
                dp, cp = apply_floors(driver_prices_raw, constructor_prices_raw, df, cf)
                r = best_team(dp, cp, driver_scores, constructor_scores, cap)
                results.append((cap, df, cf, r["top_end"], r))
                done += 1
                if done % 50 == 0:
                    print(f"  {done}/{total}...", flush=True)

    # ── Find the boundary: combos where top_end <= 4 ────────────────────────
    at_most_4 = [(cap, df, cf, te, r) for cap, df, cf, te, r in results if te <= 4]
    at_5 = [(cap, df, cf, te, r) for cap, df, cf, te, r in results if te == 5]
    at_6_plus = [(cap, df, cf, te, r) for cap, df, cf, te, r in results if te >= 6]

    print(f"\n{'═'*70}")
    print(f"  SWEEP RESULTS")
    print(f"{'═'*70}")
    print(f"  ≥6 top-end combos: {len(at_6_plus)}")
    print(f"  =5 top-end combos: {len(at_5)}")
    print(f"  ≤4 top-end combos: {len(at_most_4)}")

    # ── "Least restrictive" at-most-4 combos (highest cap + loosest floors) ──
    # Sort by: cap desc, d_floor asc, c_floor asc (most permissive first)
    at_most_4.sort(key=lambda x: (-x[0], x[1], x[2]))

    print(f"\n  Top 15 most permissive ≤4 top-end combinations:")
    print(f"  {'Cap':>6}  {'D-floor':>8}  {'C-floor':>8}  {'Top-end':>8}  {'Score':>7}  Team")
    print(f"  {'-'*6}  {'-'*8}  {'-'*8}  {'-'*8}  {'-'*7}  ----")
    for cap, df, cf, te, r in at_most_4[:15]:
        drivers_str = "+".join(r["drivers"])
        constrs_str = "+".join(r["constructors"])
        print(f"  {fmt_m(cap):>6}  {fmt_m(df):>8}  {fmt_m(cf):>8}  {te:>8}  {r['best_score']:>7}  {drivers_str} | {constrs_str}")

    # ── Boundary: what's just above $110M that achieves ≤4? ─────────────────
    above_110_at_most_4 = [(cap, df, cf, te, r) for cap, df, cf, te, r in at_most_4 if cap >= 108_000_000]
    above_110_at_most_4.sort(key=lambda x: (-x[0], x[1], x[2]))

    if above_110_at_most_4:
        print(f"\n  ≤4 top-end combos with cap ≥ $108M (most permissive near $110M):")
        print(f"  {'Cap':>6}  {'D-floor':>8}  {'C-floor':>8}  {'Top-end':>8}  {'Score':>7}  {'Cost':>7}  Team")
        print(f"  {'-'*6}  {'-'*8}  {'-'*8}  {'-'*8}  {'-'*7}  {'-'*7}  ----")
        for cap, df, cf, te, r in above_110_at_most_4[:20]:
            drivers_str = "+".join(r["drivers"])
            constrs_str = "+".join(r["constructors"])
            cost = r["cost"]
            print(f"  {fmt_m(cap):>6}  {fmt_m(df):>8}  {fmt_m(cf):>8}  {te:>8}  {r['best_score']:>7}  {fmt_m(cost):>7}  {drivers_str} | {constrs_str}")
    else:
        print("\n  No ≤4 top-end combos found with cap ≥ $108M in this sweep range.")

    # ── Summary table: at each cap, what floors produce ≤4? ─────────────────
    print(f"\n  Summary: highest cap that achieves ≤4 top-end for each floor pair")
    print(f"  {'D-floor':>8}  {'C-floor':>8}  {'Max cap for ≤4':>15}  Best team")
    print(f"  {'-'*8}  {'-'*8}  {'-'*15}  ---------")

    floor_pairs: dict[tuple[int, int], list] = {}
    for cap, df, cf, te, r in at_most_4:
        floor_pairs.setdefault((df, cf), []).append((cap, r))

    for (df, cf), entries in sorted(floor_pairs.items(), key=lambda x: (-max(e[0] for e in x[1]), x[0][0], x[0][1])):
        max_cap_entry = max(entries, key=lambda x: x[0])
        max_cap, r = max_cap_entry
        drivers_str = "+".join(r["drivers"])
        constrs_str = "+".join(r["constructors"])
        print(f"  {fmt_m(df):>8}  {fmt_m(cf):>8}  {fmt_m(max_cap):>15}  {drivers_str} | {constrs_str}")


if __name__ == "__main__":
    main()
