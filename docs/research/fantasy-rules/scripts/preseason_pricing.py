"""
preseason_pricing.py — Analyze the 2025 scoring distribution and derive
what price distribution is needed to enforce composition intent.

Approach: start from the constraints, not from a formula.

1. Show the scoring distribution — gaps between entities.
2. For each formula config (ceiling, shape), price all entities and test:
   - Can the top N most expensive assets fit in a team? For which N?
   - How many entities land at the price floor?
   - What's the price spread across the grid?
3. The composition intent (max 3 elite assets) constrains which configs work.
"""

import pandas as pd

BUDGET_CAP = 100.0
PRICE_FLOOR = 5.0
ROUND_INCREMENT = 0.1
N_DRIVERS = 5
N_CONSTRUCTORS = 2
MAX_ELITE = 3  # composition intent: max this many top assets affordable


def round_price(price: float) -> float:
    return round(price / ROUND_INCREMENT) * ROUND_INCREMENT


def price_fn(avg: float, ref_max: float, ceil: float, shape: float = 1.0) -> float:
    """Apply formula: FLOOR + (CEIL - FLOOR) * (avg/ref_max)^shape"""
    norm = max(0.0, min(avg / ref_max, 1.0))
    return max(PRICE_FLOOR, round_price(PRICE_FLOOR + (ceil - PRICE_FLOOR) * norm ** shape))


def print_scoring_distribution(drivers: pd.DataFrame, constructors: pd.DataFrame):
    """Show the scoring distribution with gaps between consecutive entities."""
    print("=" * 70)
    print("STEP 1: 2025 SCORING DISTRIBUTION")
    print("=" * 70)

    for label, df, avg_col, name_col, team_col in [
        ("Drivers", drivers, "per_race_avg", "driver", "team"),
        ("Constructors", constructors, "per_race_avg", "constructor", None),
    ]:
        print(f"\n{label} (sorted by per-race avg):")
        print("-" * 60)
        prev = None
        for _, row in df.iterrows():
            avg = row[avg_col]
            if prev is not None:
                gap = prev - avg
                gap_str = f"  (gap: {gap:.2f})"
            else:
                gap_str = ""
            team_str = f"  ({row[team_col]})" if team_col else ""
            print(f"  {row[name_col]:>16s}  {avg:>7.2f} pts/race{team_str}{gap_str}")
            prev = avg


def price_all(drivers: pd.DataFrame, constructors: pd.DataFrame,
              d_ceil: float, c_ceil: float, shape: float) -> tuple[list, list]:
    """Price all entities and return (driver_prices, constructor_prices) as lists of (name, avg, price)."""
    d_max = drivers["per_race_avg"].max()
    c_max = constructors["per_race_avg"].max()

    d_prices = []
    for _, r in drivers.iterrows():
        p = price_fn(r["per_race_avg"], d_max, d_ceil, shape)
        d_prices.append((r["driver"], r["per_race_avg"], p))

    c_prices = []
    for _, r in constructors.iterrows():
        p = price_fn(r["per_race_avg"], c_max, c_ceil, shape)
        c_prices.append((r["constructor"], r["per_race_avg"], p))

    return d_prices, c_prices


def test_composition(d_prices: list, c_prices: list) -> dict:
    """
    Test how many of the most expensive assets can fit in a team.

    For N = 1..8 (full team), pick the N most expensive assets (respecting
    5D/3C limits), fill remaining slots with the cheapest available, and
    check if total <= budget cap.
    """
    d_by_price = sorted(d_prices, key=lambda x: x[2], reverse=True)
    c_by_price = sorted(c_prices, key=lambda x: x[2], reverse=True)

    results = {}
    for n in range(1, N_DRIVERS + N_CONSTRUCTORS + 1):
        # Try all valid splits of n expensive picks across drivers/constructors
        best_cost = None
        best_split = None
        for n_d in range(max(0, n - N_CONSTRUCTORS), min(n, N_DRIVERS) + 1):
            n_c = n - n_d
            if n_c > N_CONSTRUCTORS:
                continue

            expensive_d = d_by_price[:n_d]
            expensive_c = c_by_price[:n_c]

            # Fill remaining slots with cheapest available (excluding already picked)
            remaining_d = [x for x in d_by_price if x not in expensive_d]
            remaining_c = [x for x in c_by_price if x not in expensive_c]
            fill_d = sorted(remaining_d, key=lambda x: x[2])[:N_DRIVERS - n_d]
            fill_c = sorted(remaining_c, key=lambda x: x[2])[:N_CONSTRUCTORS - n_c]

            total = (sum(x[2] for x in expensive_d) + sum(x[2] for x in expensive_c) +
                     sum(x[2] for x in fill_d) + sum(x[2] for x in fill_c))

            if best_cost is None or total < best_cost:
                best_cost = total
                best_split = (n_d, n_c)
                best_expensive = expensive_d + expensive_c

        fits = best_cost <= BUDGET_CAP
        results[n] = {
            "n": n,
            "cost": best_cost,
            "fits": fits,
            "split": best_split,
            "names": [x[0] for x in best_expensive],
        }

    # Find the max N that fits
    max_affordable = 0
    for n, r in results.items():
        if r["fits"]:
            max_affordable = n

    return {"scenarios": results, "max_affordable": max_affordable}


def evaluate_config(drivers: pd.DataFrame, constructors: pd.DataFrame,
                    d_ceil: float, c_ceil: float, shape: float) -> dict:
    """Evaluate a single formula config."""
    d_prices, c_prices = price_all(drivers, constructors, d_ceil, c_ceil, shape)

    comp = test_composition(d_prices, c_prices)

    floor_d = sum(1 for _, _, p in d_prices if p == PRICE_FLOOR)
    floor_c = sum(1 for _, _, p in c_prices if p == PRICE_FLOOR)

    return {
        "d_ceil": d_ceil, "c_ceil": c_ceil, "shape": shape,
        "d_prices": d_prices, "c_prices": c_prices,
        "max_affordable": comp["max_affordable"],
        "scenarios": comp["scenarios"],
        "passes": comp["max_affordable"] == MAX_ELITE,
        "floor_d": floor_d, "floor_c": floor_c,
    }


def sweep_formulas(drivers: pd.DataFrame, constructors: pd.DataFrame):
    """Sweep formula configs and show which ones satisfy the composition intent."""
    print("\n" + "=" * 70)
    print("STEP 2: FORMULA SWEEP — COMPOSITION CHECK")
    print("=" * 70)
    print(f"\nComposition intent: max {MAX_ELITE} most expensive assets affordable")
    print(f"Budget: ${BUDGET_CAP:.0f}M | Floor: ${PRICE_FLOOR:.0f}M | "
          f"Team: {N_DRIVERS}D + {N_CONSTRUCTORS}C\n")

    # Header
    print(f"{'D_ceil':>6} {'C_ceil':>6} {'shape':>5} │ "
          f"{'maxN':>4} │ "
          f"{'N=3 cost':>8} {'N=4 cost':>8} │ "
          f"{'flrD':>4} {'flrC':>4} │ result")
    print("-" * 75)

    passing = []
    for d_ceil in [22.0, 24.0, 26.0, 28.0, 30.0]:
        for c_ceil in [25.0, 30.0, 35.0, 40.0, 45.0]:
            for shape in [1.0]:
                r = evaluate_config(drivers, constructors, d_ceil, c_ceil, shape)
                n3 = r["scenarios"][3]
                n4 = r["scenarios"][4]
                status = "PASS" if r["passes"] else f"max={r['max_affordable']}"
                print(f"  ${d_ceil:>4.0f} ${c_ceil:>5.0f} {shape:>5.1f} │ "
                      f"  {r['max_affordable']:>2d} │ "
                      f"${n3['cost']:>7.1f} ${n4['cost']:>7.1f} │ "
                      f"  {r['floor_d']:>2d}   {r['floor_c']:>2d} │ {status}")
                if r["passes"]:
                    passing.append(r)

    print(f"\n{len(passing)} configs pass (max affordable = {MAX_ELITE}).")

    if not passing:
        print("\nNo linear config passes. Testing shapes...")
        for d_ceil in [18.0, 20.0, 22.0, 24.0]:
            for c_ceil in [22.0, 25.0, 28.0, 30.0]:
                for shape in [0.8, 0.9, 1.1, 1.2, 1.3, 1.5]:
                    r = evaluate_config(drivers, constructors, d_ceil, c_ceil, shape)
                    if r["passes"]:
                        passing.append(r)
                        print(f"  PASS: D=${d_ceil}, C=${c_ceil}, shape={shape}")

    return passing


def show_passing_details(passing: list, drivers: pd.DataFrame, constructors: pd.DataFrame):
    """For passing configs, show full price lists and shape comparison."""
    if not passing:
        return

    print("\n" + "=" * 70)
    print("STEP 3: PRICE DETAILS FOR PASSING CONFIGS")
    print("=" * 70)

    driver_names = drivers["driver"].tolist()

    # Show up to 3 passing configs
    for r in passing[:3]:
        d_ceil = r["d_ceil"]
        c_ceil = r["c_ceil"]
        shape = r["shape"]

        print(f"\n--- D_ceil=${d_ceil:.0f}M, C_ceil=${c_ceil:.0f}M, shape={shape} ---")

        # Driver prices
        print(f"\n  {'Driver':>8} {'Avg':>7} {'Price':>7}")
        print(f"  {'-'*24}")
        for name, avg, price in r["d_prices"]:
            floor_mark = " *" if price == PRICE_FLOOR else ""
            print(f"  {name:>8} {avg:>7.2f} ${price:>5.1f}M{floor_mark}")

        # Constructor prices
        print(f"\n  {'Constructor':>16} {'Avg':>7} {'Price':>7}")
        print(f"  {'-'*32}")
        for name, avg, price in r["c_prices"]:
            floor_mark = " *" if price == PRICE_FLOOR else ""
            print(f"  {name:>16} {avg:>7.2f} ${price:>5.1f}M{floor_mark}")

        # Composition detail
        print(f"\n  Composition scenarios:")
        for n in range(1, min(6, N_DRIVERS + N_CONSTRUCTORS + 1)):
            s = r["scenarios"][n]
            fit = "fits" if s["fits"] else "BUSTS"
            names = ", ".join(s["names"])
            print(f"    Top {n}: ${s['cost']:.1f}M — {fit}  ({names})")

    # Shape comparison for first passing config
    if passing:
        r = passing[0]
        d_ceil = r["d_ceil"]
        c_ceil = r["c_ceil"]

        print(f"\n--- Shape comparison for D=${d_ceil:.0f}M, C=${c_ceil:.0f}M ---")
        print(f"  {'shape':>5} │ ", end="")
        for name in driver_names:
            print(f" {name:>6}", end="")
        print(f" │ {'flr':>3} {'maxN':>4}")
        print(f"  {'-' * (8 + 7 * len(driver_names) + 12)}")

        for shape in [0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.5]:
            ev = evaluate_config(drivers, constructors, d_ceil, c_ceil, shape)
            print(f"  {shape:>5.1f} │ ", end="")
            for _, _, p in ev["d_prices"]:
                print(f" ${p:>5.1f}", end="")
            status = "PASS" if ev["passes"] else "FAIL"
            print(f" │  {ev['floor_d']:>2d}   {ev['max_affordable']:>2d} {status}")


def main():
    drivers = pd.read_csv("output/2025/season_driver_totals.csv")
    constructors = pd.read_csv("output/2025/season_constructor_totals.csv")

    # Step 1: Show the scoring distribution
    print_scoring_distribution(drivers, constructors)

    # Step 2: Sweep formula configs and check composition
    passing = sweep_formulas(drivers, constructors)

    # Step 3: Show details for passing configs
    show_passing_details(passing, drivers, constructors)


if __name__ == "__main__":
    main()
