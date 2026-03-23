"""
team_archetypes.py — Build representative team archetypes under a given
formula config and show their cost, expected points, and budget usage.

Usage:
    python3 team_archetypes.py
"""

import pandas as pd

BUDGET_CAP = 100.0
PRICE_FLOOR = 5.0
ROUND_INCREMENT = 0.1
N_DRIVERS = 5
N_CONSTRUCTORS = 2

# Formula configs to compare
CONFIGS = [
    (26.0, 30.0, 1.0),
    (26.0, 35.0, 1.0),
]


def round_price(price: float) -> float:
    return round(price / ROUND_INCREMENT) * ROUND_INCREMENT


def price_fn(avg: float, ref_max: float, ceil: float, shape: float = 1.0) -> float:
    norm = max(0.0, min(avg / ref_max, 1.0))
    return max(PRICE_FLOOR, round_price(PRICE_FLOOR + (ceil - PRICE_FLOOR) * norm ** shape))


def load_priced(drivers_df: pd.DataFrame, constructors_df: pd.DataFrame,
                d_ceil: float, c_ceil: float, shape: float) -> tuple[list, list]:
    d_max = drivers_df["per_race_avg"].max()
    c_max = constructors_df["per_race_avg"].max()

    d = []
    for _, r in drivers_df.iterrows():
        d.append({
            "name": r["driver"],
            "team": r["team"],
            "avg": r["per_race_avg"],
            "price": price_fn(r["per_race_avg"], d_max, d_ceil, shape),
        })

    c = []
    for _, r in constructors_df.iterrows():
        c.append({
            "name": r["constructor"],
            "avg": r["per_race_avg"],
            "price": price_fn(r["per_race_avg"], c_max, c_ceil, shape),
        })

    return d, c


def team_cost(drivers: list, constructors: list) -> float:
    return sum(d["price"] for d in drivers) + sum(c["price"] for c in constructors)


def team_avg(drivers: list, constructors: list) -> float:
    return sum(d["avg"] for d in drivers) + sum(c["avg"] for c in constructors)


def best_fill_drivers(all_drivers: list, exclude: list, n: int) -> list:
    available = [d for d in all_drivers if d["name"] not in {e["name"] for e in exclude}]
    return sorted(available, key=lambda x: x["price"])[:n]


def best_fill_constructors(all_constructors: list, exclude: list, n: int) -> list:
    available = [c for c in all_constructors if c["name"] not in {e["name"] for e in exclude}]
    return sorted(available, key=lambda x: x["price"])[:n]


def upgrade_fill(drivers: list, constructors: list, all_d: list, all_c: list,
                 locked_d: list, locked_c: list) -> tuple[list, list]:
    """
    Given a team with some locked elite picks and cheap fill, spend remaining
    budget by upgrading fill slots to the best available (by avg) that fit.
    Locked picks are not changed.
    """
    budget_remaining = BUDGET_CAP - team_cost(drivers, constructors)
    locked_d_names = {d["name"] for d in locked_d}
    locked_c_names = {c["name"] for c in locked_c}

    fill_d = [d for d in drivers if d["name"] not in locked_d_names]
    fill_c = [c for c in constructors if c["name"] not in locked_c_names]

    # Available upgrades (not already on team)
    on_team = {d["name"] for d in drivers} | {c["name"] for c in constructors}
    avail_d = sorted([d for d in all_d if d["name"] not in on_team],
                     key=lambda x: x["avg"], reverse=True)
    avail_c = sorted([c for c in all_c if c["name"] not in on_team],
                     key=lambda x: x["avg"], reverse=True)

    # Greedily upgrade fill slots: try swapping each fill slot for the best
    # available upgrade that fits in remaining budget
    improved = True
    while improved:
        improved = False
        # Try upgrading driver fill slots
        for i, slot in enumerate(fill_d):
            for candidate in avail_d:
                gain = candidate["price"] - slot["price"]
                if gain > 0 and gain <= budget_remaining and candidate["avg"] > slot["avg"]:
                    fill_d[i] = candidate
                    avail_d = [d for d in avail_d if d["name"] != candidate["name"]]
                    avail_d.append(slot)
                    avail_d.sort(key=lambda x: x["avg"], reverse=True)
                    budget_remaining -= gain
                    improved = True
                    break
        # Try upgrading constructor fill slots
        for i, slot in enumerate(fill_c):
            for candidate in avail_c:
                gain = candidate["price"] - slot["price"]
                if gain > 0 and gain <= budget_remaining and candidate["avg"] > slot["avg"]:
                    fill_c[i] = candidate
                    avail_c = [c for c in avail_c if c["name"] != candidate["name"]]
                    avail_c.append(slot)
                    avail_c.sort(key=lambda x: x["avg"], reverse=True)
                    budget_remaining -= gain
                    improved = True
                    break

    return locked_d + fill_d, locked_c + fill_c


def build_archetypes(all_d: list, all_c: list) -> list[tuple[str, list, list]]:
    all_d_by_price = sorted(all_d, key=lambda x: x["price"], reverse=True)
    all_c_by_price = sorted(all_c, key=lambda x: x["price"], reverse=True)
    all_d_by_avg   = sorted(all_d, key=lambda x: x["avg"],   reverse=True)
    all_c_by_avg   = sorted(all_c, key=lambda x: x["avg"],   reverse=True)

    # A: Top 3 drivers + cheapest constructors, then upgrade fill
    elite_d3 = all_d_by_price[:3]
    fill_d_a = best_fill_drivers(all_d, elite_d3, N_DRIVERS - 3)
    fill_c_a = best_fill_constructors(all_c, [], N_CONSTRUCTORS)
    opt_d_a, opt_c_a = upgrade_fill(elite_d3 + fill_d_a, fill_c_a,
                                     all_d, all_c, elite_d3, [])
    a = ("A: Top 3 drivers + best fill", opt_d_a, opt_c_a)

    # B: Top 2 drivers + top constructor, then upgrade fill
    elite_d2 = all_d_by_price[:2]
    elite_c1 = all_c_by_price[:1]
    fill_d_b = best_fill_drivers(all_d, elite_d2, N_DRIVERS - 2)
    fill_c_b = best_fill_constructors(all_c, elite_c1, N_CONSTRUCTORS - 1)
    opt_d_b, opt_c_b = upgrade_fill(elite_d2 + fill_d_b, elite_c1 + fill_c_b,
                                     all_d, all_c, elite_d2, elite_c1)
    b = ("B: Top 2 drivers + top constructor + best fill", opt_d_b, opt_c_b)

    # C: Top driver + top 2 constructors, then upgrade fill
    elite_d1 = all_d_by_price[:1]
    elite_c2 = all_c_by_price[:2]
    fill_d_c = best_fill_drivers(all_d, elite_d1, N_DRIVERS - 1)
    fill_c_c = best_fill_constructors(all_c, elite_c2, N_CONSTRUCTORS - 2)
    opt_d_c, opt_c_c = upgrade_fill(elite_d1 + fill_d_c, elite_c2 + fill_c_c,
                                     all_d, all_c, elite_d1, elite_c2)
    c = ("C: Top driver + top 2 constructors + best fill", opt_d_c, opt_c_c)

    # D: Top 2 constructors + best driver fill
    elite_c2_d = all_c_by_price[:2]
    fill_d_d = best_fill_drivers(all_d, [], N_DRIVERS)
    opt_d_d, opt_c_d = upgrade_fill(fill_d_d, elite_c2_d,
                                     all_d, all_c, [], elite_c2_d)
    d = ("D: Top 2 constructors + best driver fill", opt_d_d, opt_c_d)

    # E: Genuinely balanced — mid-range picks, no elite anchors
    n_d = len(all_d_by_avg)
    n_c = len(all_c_by_avg)
    mid_d_start = (n_d - N_DRIVERS) // 2
    mid_c_start = (n_c - N_CONSTRUCTORS) // 2
    e = ("E: Balanced mid-range",
         all_d_by_avg[mid_d_start:mid_d_start + N_DRIVERS],
         all_c_by_avg[mid_c_start:mid_c_start + N_CONSTRUCTORS])

    return [a, b, c, d, e]


def main():
    drivers_df = pd.read_csv("output/2025/season_driver_totals.csv")
    constructors_df = pd.read_csv("output/2025/season_constructor_totals.csv")

    # Summary across configs
    print(f"{'═' * 80}")
    print(f"  ARCHETYPE COMPARISON ACROSS FORMULA CONFIGS")
    print(f"  Budget: ${BUDGET_CAP:.0f}M | Team: {N_DRIVERS}D + {N_CONSTRUCTORS}C")
    print(f"{'═' * 80}")

    header = f"  {'Archetype':<42}"
    for d_ceil, c_ceil, shape in CONFIGS:
        header += f"  D${d_ceil:.0f}/C${c_ceil:.0f}"
    print(header)
    print(f"  {'─' * 78}")

    # Build archetypes for each config and collect results
    all_results = []
    for d_ceil, c_ceil, shape in CONFIGS:
        all_d, all_c = load_priced(drivers_df, constructors_df, d_ceil, c_ceil, shape)
        all_results.append(build_archetypes(all_d, all_c))

    # Print each archetype row
    archetype_names = [r[0] for r in all_results[0]]
    for i, name in enumerate(archetype_names):
        row = f"  {name:<42}"
        for config_results in all_results:
            label, d_list, c_list = config_results[i]
            cost = team_cost(d_list, c_list)
            avg = team_avg(d_list, c_list)
            fits = "" if cost <= BUDGET_CAP else " OVER"
            row += f"  {avg:>5.0f}pts ${cost:.0f}M{fits}"
        print(row)

    # Detail view for each config
    for cfg_idx, (d_ceil, c_ceil, shape) in enumerate(CONFIGS):
        all_d, all_c = load_priced(drivers_df, constructors_df, d_ceil, c_ceil, shape)
        archetypes = all_results[cfg_idx]

        print(f"\n{'═' * 80}")
        print(f"  D_ceil=${d_ceil:.0f}M  C_ceil=${c_ceil:.0f}M  shape={shape}")
        print(f"  McLaren: ${price_fn(48.46, constructors_df['per_race_avg'].max(), c_ceil, shape):.1f}M  "
              f"VER: ${price_fn(24.83, drivers_df['per_race_avg'].max(), d_ceil, shape):.1f}M")
        print(f"{'═' * 80}")

        for name, d_list, c_list in archetypes:
            cost = team_cost(d_list, c_list)
            avg = team_avg(d_list, c_list)
            fits = "OK" if cost <= BUDGET_CAP else "OVER BUDGET"
            print(f"\n  {name}  —  ${cost:.1f}M ({fits})  {avg:.1f} pts/race")
            d_str = ", ".join(f"{d['name']} ${d['price']:.0f}M" for d in d_list)
            c_str = ", ".join(f"{c['name']} ${c['price']:.0f}M" for c in c_list)
            print(f"    D: {d_str}")
            print(f"    C: {c_str}")


if __name__ == "__main__":
    main()
