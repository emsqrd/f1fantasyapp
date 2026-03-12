"""
pricing_bakeoff.py — Compare 4 pricing approaches for the F1 Fantasy simulation.

No FastF1 dependency. Reads 2024/2025 season totals CSVs, sweeps parameters
across all four approaches, and produces comparison output files.

Usage:
    cd docs/research/fantasy-rules/own-rules/simulation
    source .venv/bin/activate
    python pricing_bakeoff.py
"""

import csv
import itertools
import math
import statistics
from pathlib import Path

# ── Constants ─────────────────────────────────────────────────────────────

DRIVER_FLOOR = 2_000_000       # $2M
CONSTRUCTOR_FLOOR = 3_000_000  # $3M
TEAM_DRIVERS = 5
TEAM_CONSTRUCTORS = 3
MIN_RACES_ELIGIBLE = 10
TOTAL_RACES_2024 = 24

# Budget caps to sweep: $100M–$130M in $5M steps
BUDGET_CAPS = list(range(100_000_000, 135_000_000, 5_000_000))
TARGET_TIGHTNESS = 1.30  # dream team should cost 130% of cap (midpoint of 125–140%)

# ── Paths ─────────────────────────────────────────────────────────────────

SIM_DIR = Path(__file__).parent
OUTPUT_DIR = SIM_DIR / "output"
DATA_2024_DIR = OUTPUT_DIR / "2024"
DATA_2025_DIR = OUTPUT_DIR / "2025"
BAKEOFF_DIR = OUTPUT_DIR / "pricing_bakeoff"

# 2024 constructor names → 2025 constructor names (where they differ)
CONSTRUCTOR_NAME_MAP_2024_TO_2025 = {
    "RB": "Racing Bulls",
}

# ── Helpers ───────────────────────────────────────────────────────────────


def round_100k(x: float) -> int:
    """Round to nearest $100,000."""
    return round(x / 100_000) * 100_000


def gini(values: list[int]) -> float:
    """Gini coefficient — 0 = perfect equality, 1 = maximum inequality."""
    n = len(values)
    if n == 0:
        return 0.0
    total = sum(values)
    if total == 0:
        return 0.0
    s = sorted(values)
    numerator = sum((2 * (i + 1) - n - 1) * v for i, v in enumerate(s))
    return numerator / (n * total)


def fmt_m(cents: int) -> str:
    """Format integer cents as '$XM' or '$X.XM'."""
    m = cents / 1_000_000
    if m == int(m):
        return f"${int(m)}M"
    return f"${m:.1f}M"


# ── Data loading ──────────────────────────────────────────────────────────


def load_driver_data(path: Path) -> list[dict]:
    rows = []
    with open(path) as f:
        for row in csv.DictReader(f):
            rows.append({
                "driver": row["driver"],
                "season_total": int(row["season_total"]),
                "races_entered": int(row["races_entered"]),
            })
    return rows


def load_constructor_data(path: Path) -> list[dict]:
    rows = []
    with open(path) as f:
        for row in csv.DictReader(f):
            rows.append({
                "constructor": row["constructor"],
                "season_total": int(row["season_total"]),
            })
    return rows


def build_avgs(driver_rows: list[dict]) -> list[tuple[str, float | None]]:
    """
    Return (driver_name, per_race_avg_or_None) for each driver.
    Drivers with <MIN_RACES_ELIGIBLE races get None (→ floor price).
    """
    result = []
    for row in driver_rows:
        if row["races_entered"] < MIN_RACES_ELIGIBLE:
            result.append((row["driver"], None))
        else:
            result.append((row["driver"], row["season_total"] / row["races_entered"]))
    return result


def build_constructor_avgs(constructor_rows: list[dict]) -> list[tuple[str, float]]:
    """All constructors are eligible; normalize by TOTAL_RACES_2024."""
    return [
        (row["constructor"], row["season_total"] / TOTAL_RACES_2024)
        for row in constructor_rows
    ]


# ── Pricing approach 1: Linear (Share-of-Pool) ────────────────────────────


def price_linear(
    avgs: list[tuple[str, float | None]],
    pool_size: int,
    floor: int,
) -> dict[str, int]:
    """
    price = max(FLOOR, round_100K(per_race_avg / mean_eligible_avg * base_price))
    where base_price = pool_size / n_eligible.

    POOL_SIZE ≈ total dollars allocated to eligible entities.
    """
    eligible = [(name, avg) for name, avg in avgs if avg is not None]
    if not eligible:
        return {name: floor for name, _ in avgs}

    n_eligible = len(eligible)
    mean_avg = sum(avg for _, avg in eligible) / n_eligible
    base_price = pool_size / n_eligible

    prices: dict[str, int] = {}
    for name, avg in avgs:
        if avg is None:
            prices[name] = floor
        else:
            raw = (avg / mean_avg) * base_price
            prices[name] = max(floor, round_100k(raw))
    return prices


# ── Pricing approach 2: Power Curve ───────────────────────────────────────


def price_power_curve(
    avgs: list[tuple[str, float | None]],
    ceiling: int,
    shape: float,
    floor: int,
) -> dict[str, int]:
    """
    normalized = (avg - min_avg) / (max_avg - min_avg)   [0→1 over eligible]
    price = max(FLOOR, round_100K(FLOOR + (CEILING - FLOOR) * normalized^SHAPE))

    shape > 1 → top-heavy premium; shape < 1 → compressed top.
    """
    eligible_avgs = [avg for _, avg in avgs if avg is not None]
    if not eligible_avgs:
        return {name: floor for name, _ in avgs}

    min_avg = min(eligible_avgs)
    max_avg = max(eligible_avgs)

    prices: dict[str, int] = {}
    for name, avg in avgs:
        if avg is None:
            prices[name] = floor
        elif max_avg == min_avg:
            prices[name] = floor
        else:
            normalized = (avg - min_avg) / (max_avg - min_avg)
            raw = floor + (ceiling - floor) * (normalized ** shape)
            prices[name] = max(floor, round_100k(raw))
    return prices


# ── Pricing approach 3: Rank-Based Interpolation ─────────────────────────


def price_rank_based(
    avgs: list[tuple[str, float | None]],
    ceiling: int,
    floor: int,
) -> dict[str, int]:
    """
    Rank eligible entities by avg (highest = rank 1).
    price = round_100K(CEILING - (CEILING - FLOOR) * (rank - 1) / (N - 1))
    Rookies/limited-race entities get floor.
    """
    eligible = sorted(
        [(name, avg) for name, avg in avgs if avg is not None],
        key=lambda x: -x[1],
    )
    n = len(eligible)

    prices: dict[str, int] = {}
    for rank_0, (name, _) in enumerate(eligible):
        if n <= 1:
            prices[name] = ceiling
        else:
            raw = ceiling - (ceiling - floor) * rank_0 / (n - 1)
            prices[name] = max(floor, round_100k(raw))

    for name, avg in avgs:
        if avg is None:
            prices[name] = floor

    return prices


# ── Pricing approach 4: Tier-Based ────────────────────────────────────────


def price_tier_based(
    avgs: list[tuple[str, float | None]],
    tier_config: list[tuple[int, int]],
    floor: int,
) -> dict[str, int]:
    """
    Sort eligible entities by avg descending. Assign tier prices in order.
    tier_config: [(count, price), ...] — best to worst; remaining get floor.
    """
    eligible = sorted(
        [(name, avg) for name, avg in avgs if avg is not None],
        key=lambda x: -x[1],
    )
    prices: dict[str, int] = {}
    idx = 0
    for count, price in tier_config:
        for _ in range(count):
            if idx < len(eligible):
                prices[eligible[idx][0]] = max(floor, price)
                idx += 1
    # Remaining eligible get floor
    while idx < len(eligible):
        prices[eligible[idx][0]] = floor
        idx += 1

    for name, avg in avgs:
        if avg is None:
            prices[name] = floor

    return prices


# ── Dream team & cost ─────────────────────────────────────────────────────


def identify_dream_team(
    driver_rows_2025: list[dict],
    constructor_rows_2025: list[dict],
) -> tuple[list[str], list[str]]:
    """Top 5 drivers + top 3 constructors by 2025 season total."""
    top_drivers = sorted(driver_rows_2025, key=lambda x: -x["season_total"])[:TEAM_DRIVERS]
    top_constructors = sorted(constructor_rows_2025, key=lambda x: -x["season_total"])[:TEAM_CONSTRUCTORS]
    return (
        [d["driver"] for d in top_drivers],
        [c["constructor"] for c in top_constructors],
    )


def dream_team_cost(
    driver_prices: dict[str, int],
    constructor_prices: dict[str, int],
    dream_drivers: list[str],
    dream_constructors: list[str],
    driver_name_map: dict[str, str] | None = None,
    constructor_name_map: dict[str, str] | None = None,
) -> int:
    """
    Sum of dream team member prices. Name maps translate 2025 names → 2024 price keys.
    driver_name_map: 2025 driver name → 2024 driver name
    constructor_name_map: 2025 constructor name → 2024 constructor name
    """
    reverse_d = {v: k for k, v in (driver_name_map or {}).items()}
    reverse_c = {v: k for k, v in (constructor_name_map or {}).items()}

    total = 0
    for d in dream_drivers:
        key = reverse_d.get(d, d)
        total += driver_prices.get(key, DRIVER_FLOOR)
    for c in dream_constructors:
        key = reverse_c.get(c, c)
        total += constructor_prices.get(key, CONSTRUCTOR_FLOOR)
    return total


# ── Team diversity analysis ───────────────────────────────────────────────


def analyze_team_diversity(
    driver_prices: dict[str, int],
    constructor_prices: dict[str, int],
    driver_scores_2025: dict[str, int],
    constructor_scores_2025: dict[str, int],
    budget_cap: int,
) -> dict:
    """
    Enumerate all C(N_d,5) × C(N_c,3) teams. For each that fits under budget,
    record its 2025 score. Returns feasible count and 80%-of-best count.
    """
    d_names = list(driver_prices.keys())
    c_names = list(constructor_prices.keys())

    # Pre-compute constructor combo costs and scores
    c_combos = list(itertools.combinations(range(len(c_names)), TEAM_CONSTRUCTORS))
    c_combo_costs = [sum(constructor_prices[c_names[i]] for i in combo) for combo in c_combos]
    c_combo_scores = [sum(constructor_scores_2025.get(c_names[i], 0) for i in combo) for combo in c_combos]

    feasible_scores: list[int] = []

    for d_combo in itertools.combinations(range(len(d_names)), TEAM_DRIVERS):
        d_cost = sum(driver_prices[d_names[i]] for i in d_combo)
        remaining = budget_cap - d_cost
        if remaining < 0:
            continue
        d_score = sum(driver_scores_2025.get(d_names[i], 0) for i in d_combo)
        for ci, c_cost in enumerate(c_combo_costs):
            if c_cost <= remaining:
                feasible_scores.append(d_score + c_combo_scores[ci])

    if not feasible_scores:
        return {"feasible_count": 0, "best_score": 0, "teams_within_80pct": 0}

    best = max(feasible_scores)
    within_80 = sum(1 for s in feasible_scores if s >= 0.8 * best)
    return {
        "feasible_count": len(feasible_scores),
        "best_score": best,
        "teams_within_80pct": within_80,
    }


# ── Parameter definitions ─────────────────────────────────────────────────


def linear_param_grid() -> list[dict]:
    """Sweep driver_pool and constructor_pool each $100M–$300M in $10M steps."""
    params = []
    for dp in range(100_000_000, 310_000_000, 10_000_000):
        for cp in range(100_000_000, 310_000_000, 10_000_000):
            params.append({"driver_pool": dp, "constructor_pool": cp})
    return params


def power_curve_param_grid() -> list[dict]:
    """Sweep driver/constructor ceiling ($15M–$30M, $1M steps) × shape (0.5–3.0, 0.25 steps)."""
    params = []
    for d_ceil in range(15_000_000, 31_000_000, 1_000_000):
        for c_ceil in range(15_000_000, 51_000_000, 5_000_000):
            for shape_x10 in range(5, 31, 5):  # 0.5 to 3.0 in 0.5 steps
                shape = shape_x10 / 10.0
                params.append({
                    "driver_ceiling": d_ceil,
                    "constructor_ceiling": c_ceil,
                    "shape": shape,
                })
    return params


def rank_based_param_grid() -> list[dict]:
    """Sweep driver/constructor ceiling $15M–$30M in $1M steps."""
    params = []
    for d_ceil in range(15_000_000, 31_000_000, 1_000_000):
        for c_ceil in range(15_000_000, 51_000_000, 5_000_000):
            params.append({"driver_ceiling": d_ceil, "constructor_ceiling": c_ceil})
    return params


# Tier configs: (driver_tiers, constructor_tiers) — 4 named configurations
TIER_CONFIGS = {
    "equal_quarts": (
        # Drivers: 4 tiers of 5 (equal size)
        [(5, 20_000_000), (5, 12_000_000), (5, 6_000_000), (5, 2_000_000)],
        # Constructors: 3 tiers ~equal size
        [(3, 26_000_000), (4, 15_000_000), (3, 5_000_000)],
    ),
    "top_heavy": (
        # Drivers: small elite tier, larger mid/lower tiers
        [(3, 26_000_000), (5, 15_000_000), (6, 7_000_000), (6, 2_000_000)],
        # Constructors: tiny elite, medium, large lower
        [(2, 34_000_000), (4, 18_000_000), (4, 6_000_000)],
    ),
    "compressed": (
        # Drivers: moderate spread — 5-5-5-5 with narrower range
        [(5, 17_000_000), (5, 11_000_000), (5, 6_000_000), (5, 2_000_000)],
        # Constructors: moderate spread
        [(3, 22_000_000), (3, 14_000_000), (4, 5_000_000)],
    ),
    "wide_spread": (
        # Drivers: large price spread, 4 tiers
        [(4, 28_000_000), (4, 16_000_000), (6, 7_000_000), (6, 2_000_000)],
        # Constructors: large spread
        [(2, 40_000_000), (3, 20_000_000), (5, 5_000_000)],
    ),
}


def tier_param_grid() -> list[dict]:
    return [{"config_name": name} for name in TIER_CONFIGS]


# ── Sweep runners ──────────────────────────────────────────────────────────


def sweep_linear(
    driver_avgs, constructor_avgs, dream_drivers, dream_constructors
) -> list[dict]:
    rows = []
    for p in linear_param_grid():
        d_prices = price_linear(driver_avgs, p["driver_pool"], DRIVER_FLOOR)
        c_prices = price_linear(constructor_avgs, p["constructor_pool"], CONSTRUCTOR_FLOOR)
        dtc = dream_team_cost(
            d_prices, c_prices, dream_drivers, dream_constructors,
            constructor_name_map=CONSTRUCTOR_NAME_MAP_2024_TO_2025,
        )
        for cap in BUDGET_CAPS:
            rows.append({
                "approach": "linear",
                "driver_pool": p["driver_pool"],
                "constructor_pool": p["constructor_pool"],
                "driver_ceiling": None,
                "constructor_ceiling": None,
                "shape": None,
                "config_name": None,
                "budget_cap": cap,
                "dream_team_cost": dtc,
                "tightness": dtc / cap,
            })
    return rows


def sweep_power_curve(
    driver_avgs, constructor_avgs, dream_drivers, dream_constructors
) -> list[dict]:
    rows = []
    for p in power_curve_param_grid():
        d_prices = price_power_curve(driver_avgs, p["driver_ceiling"], p["shape"], DRIVER_FLOOR)
        c_prices = price_power_curve(constructor_avgs, p["constructor_ceiling"], p["shape"], CONSTRUCTOR_FLOOR)
        dtc = dream_team_cost(
            d_prices, c_prices, dream_drivers, dream_constructors,
            constructor_name_map=CONSTRUCTOR_NAME_MAP_2024_TO_2025,
        )
        for cap in BUDGET_CAPS:
            rows.append({
                "approach": "power_curve",
                "driver_pool": None,
                "constructor_pool": None,
                "driver_ceiling": p["driver_ceiling"],
                "constructor_ceiling": p["constructor_ceiling"],
                "shape": p["shape"],
                "config_name": None,
                "budget_cap": cap,
                "dream_team_cost": dtc,
                "tightness": dtc / cap,
            })
    return rows


def sweep_rank_based(
    driver_avgs, constructor_avgs, dream_drivers, dream_constructors
) -> list[dict]:
    rows = []
    for p in rank_based_param_grid():
        d_prices = price_rank_based(driver_avgs, p["driver_ceiling"], DRIVER_FLOOR)
        c_prices = price_rank_based(constructor_avgs, p["constructor_ceiling"], CONSTRUCTOR_FLOOR)
        dtc = dream_team_cost(
            d_prices, c_prices, dream_drivers, dream_constructors,
            constructor_name_map=CONSTRUCTOR_NAME_MAP_2024_TO_2025,
        )
        for cap in BUDGET_CAPS:
            rows.append({
                "approach": "rank_based",
                "driver_pool": None,
                "constructor_pool": None,
                "driver_ceiling": p["driver_ceiling"],
                "constructor_ceiling": p["constructor_ceiling"],
                "shape": None,
                "config_name": None,
                "budget_cap": cap,
                "dream_team_cost": dtc,
                "tightness": dtc / cap,
            })
    return rows


def sweep_tier_based(
    driver_avgs, constructor_avgs, dream_drivers, dream_constructors
) -> list[dict]:
    rows = []
    for p in tier_param_grid():
        name = p["config_name"]
        driver_tiers, constructor_tiers = TIER_CONFIGS[name]
        d_prices = price_tier_based(driver_avgs, driver_tiers, DRIVER_FLOOR)
        c_prices = price_tier_based(constructor_avgs, constructor_tiers, CONSTRUCTOR_FLOOR)
        dtc = dream_team_cost(
            d_prices, c_prices, dream_drivers, dream_constructors,
            constructor_name_map=CONSTRUCTOR_NAME_MAP_2024_TO_2025,
        )
        for cap in BUDGET_CAPS:
            rows.append({
                "approach": "tier_based",
                "driver_pool": None,
                "constructor_pool": None,
                "driver_ceiling": None,
                "constructor_ceiling": None,
                "shape": None,
                "config_name": name,
                "budget_cap": cap,
                "dream_team_cost": dtc,
                "tightness": dtc / cap,
            })
    return rows


# ── Best-params selection ─────────────────────────────────────────────────


def select_best_params(sweep_rows: list[dict]) -> dict:
    """Return the row closest to TARGET_TIGHTNESS."""
    return min(sweep_rows, key=lambda r: abs(r["tightness"] - TARGET_TIGHTNESS))


# ── Price distribution stats ──────────────────────────────────────────────


def price_stats(prices: dict[str, int], floor: int) -> dict:
    vals = list(prices.values())
    return {
        "min": min(vals),
        "max": max(vals),
        "mean": statistics.mean(vals),
        "stdev": statistics.stdev(vals) if len(vals) > 1 else 0,
        "gini": gini(vals),
        "top_to_floor_ratio": max(vals) / floor,
        "at_floor": sum(1 for v in vals if v <= floor),
    }


# ── ASCII bar chart ───────────────────────────────────────────────────────


def bar_chart(values: list[float], labels: list[str], width: int = 40) -> str:
    if not values:
        return ""
    max_v = max(values) or 1
    lines = []
    for label, v in zip(labels, values):
        bar_len = int(round(v / max_v * width))
        bar = "█" * bar_len
        lines.append(f"  {label:<12} {bar:<{width}} {fmt_m(int(v))}")
    return "\n".join(lines)


# ── Output writers ────────────────────────────────────────────────────────


def write_parameter_sweep(all_rows: list[dict], path: Path) -> None:
    fieldnames = [
        "approach", "driver_pool", "constructor_pool",
        "driver_ceiling", "constructor_ceiling", "shape", "config_name",
        "budget_cap", "dream_team_cost", "tightness",
    ]
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(all_rows)


def write_best_prices(
    best_by_approach: dict[str, dict],
    driver_avgs: list[tuple[str, float | None]],
    constructor_avgs: list[tuple[str, float]],
    path: Path,
) -> None:
    """Write side-by-side price comparison for each entity."""
    approaches = list(best_by_approach.keys())
    price_tables = {}
    for approach, best in best_by_approach.items():
        price_tables[approach] = _compute_prices_for_row(best, driver_avgs, constructor_avgs)

    d_names = [name for name, _ in driver_avgs]
    c_names = [name for name, _ in constructor_avgs]

    fieldnames = ["entity", "type"] + [f"{a}_price" for a in approaches]
    rows = []
    for name in d_names:
        row = {"entity": name, "type": "driver"}
        for a in approaches:
            row[f"{a}_price"] = price_tables[a]["drivers"].get(name, DRIVER_FLOOR)
        rows.append(row)
    for name in c_names:
        row = {"entity": name, "type": "constructor"}
        for a in approaches:
            row[f"{a}_price"] = price_tables[a]["constructors"].get(name, CONSTRUCTOR_FLOOR)
        rows.append(row)

    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)


def _compute_prices_for_row(
    best_row: dict,
    driver_avgs: list[tuple[str, float | None]],
    constructor_avgs: list[tuple[str, float]],
) -> dict:
    """Re-compute prices from a best_params row."""
    approach = best_row["approach"]
    if approach == "linear":
        d_prices = price_linear(driver_avgs, best_row["driver_pool"], DRIVER_FLOOR)
        c_prices = price_linear(constructor_avgs, best_row["constructor_pool"], CONSTRUCTOR_FLOOR)
    elif approach == "power_curve":
        d_prices = price_power_curve(driver_avgs, best_row["driver_ceiling"], best_row["shape"], DRIVER_FLOOR)
        c_prices = price_power_curve(constructor_avgs, best_row["constructor_ceiling"], best_row["shape"], CONSTRUCTOR_FLOOR)
    elif approach == "rank_based":
        d_prices = price_rank_based(driver_avgs, best_row["driver_ceiling"], DRIVER_FLOOR)
        c_prices = price_rank_based(constructor_avgs, best_row["constructor_ceiling"], CONSTRUCTOR_FLOOR)
    elif approach == "tier_based":
        driver_tiers, constructor_tiers = TIER_CONFIGS[best_row["config_name"]]
        d_prices = price_tier_based(driver_avgs, driver_tiers, DRIVER_FLOOR)
        c_prices = price_tier_based(constructor_avgs, constructor_tiers, CONSTRUCTOR_FLOOR)
    else:
        raise ValueError(f"Unknown approach: {approach}")
    return {"drivers": d_prices, "constructors": c_prices}


def params_label(row: dict) -> str:
    a = row["approach"]
    if a == "linear":
        return f"driver_pool={fmt_m(row['driver_pool'])}, constructor_pool={fmt_m(row['constructor_pool'])}"
    elif a == "power_curve":
        return (
            f"driver_ceiling={fmt_m(row['driver_ceiling'])}, "
            f"constructor_ceiling={fmt_m(row['constructor_ceiling'])}, "
            f"shape={row['shape']}"
        )
    elif a == "rank_based":
        return f"driver_ceiling={fmt_m(row['driver_ceiling'])}, constructor_ceiling={fmt_m(row['constructor_ceiling'])}"
    elif a == "tier_based":
        return f"config={row['config_name']}"
    return ""


def write_comparison_summary(
    best_by_approach: dict[str, dict],
    driver_avgs: list[tuple[str, float | None]],
    constructor_avgs: list[tuple[str, float]],
    driver_rows_2025: list[dict],
    constructor_rows_2025: list[dict],
    dream_drivers: list[str],
    dream_constructors: list[str],
    diversity_by_approach: dict[str, dict],
    path: Path,
) -> None:
    lines: list[str] = []

    dream_score = (
        sum(r["season_total"] for r in driver_rows_2025 if r["driver"] in dream_drivers)
        + sum(r["season_total"] for r in constructor_rows_2025 if r["constructor"] in dream_constructors)
    )

    lines.append("# Pricing Bake-Off: Comparison Summary\n")
    lines.append(f"**Data:** 2024 season totals (preseason pricing) → 2025 dream team validation\n")
    lines.append(f"**Dream team:** {', '.join(dream_drivers)} + {', '.join(dream_constructors)}")
    lines.append(f"**Dream team 2025 score:** {dream_score:,} pts\n")

    # ── Per-approach summaries ──────────────────────────────────────────
    lines.append("## Best Parameters per Approach\n")
    lines.append(
        f"{'Approach':<14} {'Params':<60} {'Cap':>8} {'DT Cost':>10} {'Tightness':>10}"
    )
    lines.append("-" * 106)
    for approach, best in best_by_approach.items():
        lines.append(
            f"{approach:<14} {params_label(best):<60} "
            f"{fmt_m(best['budget_cap']):>8} "
            f"{fmt_m(best['dream_team_cost']):>10} "
            f"{best['tightness']:>9.1%}"
        )

    # ── Price distribution stats ────────────────────────────────────────
    lines.append("\n## Price Distribution Statistics\n")
    lines.append(
        f"{'Metric':<22} {'Linear':>12} {'Power Curve':>12} {'Rank-Based':>12} {'Tier-Based':>12}"
    )
    lines.append("-" * 72)

    approach_names = ["linear", "power_curve", "rank_based", "tier_based"]
    price_tables = {}
    stats_d: dict[str, dict] = {}
    stats_c: dict[str, dict] = {}
    for approach, best in best_by_approach.items():
        pt = _compute_prices_for_row(best, driver_avgs, constructor_avgs)
        price_tables[approach] = pt
        stats_d[approach] = price_stats(pt["drivers"], DRIVER_FLOOR)
        stats_c[approach] = price_stats(pt["constructors"], CONSTRUCTOR_FLOOR)

    def stat_row(label: str, key: str, is_money: bool, src: str) -> str:
        vals = []
        for a in approach_names:
            s = stats_d[a] if src == "d" else stats_c[a]
            v = s.get(key, 0)
            vals.append(fmt_m(int(v)) if is_money else f"{v:.3f}")
        return f"  {label:<20} {vals[0]:>12} {vals[1]:>12} {vals[2]:>12} {vals[3]:>12}"

    lines.append("Drivers:")
    lines.append(stat_row("  Max price", "max", True, "d"))
    lines.append(stat_row("  Mean price", "mean", True, "d"))
    lines.append(stat_row("  Std dev", "stdev", True, "d"))
    lines.append(stat_row("  Gini coeff", "gini", False, "d"))
    lines.append(stat_row("  Top/floor ratio", "top_to_floor_ratio", False, "d"))
    lines.append(stat_row("  At floor ($2M)", "at_floor", False, "d"))
    lines.append("Constructors:")
    lines.append(stat_row("  Max price", "max", True, "c"))
    lines.append(stat_row("  Mean price", "mean", True, "c"))
    lines.append(stat_row("  Std dev", "stdev", True, "c"))
    lines.append(stat_row("  Gini coeff", "gini", False, "c"))
    lines.append(stat_row("  Top/floor ratio", "top_to_floor_ratio", False, "c"))
    lines.append(stat_row("  At floor ($3M)", "at_floor", False, "c"))

    # ── Full price lists side by side ───────────────────────────────────
    lines.append("\n## Driver Price Lists (sorted by 2024 per-race avg)\n")
    sorted_drivers = sorted(
        [(name, avg) for name, avg in driver_avgs],
        key=lambda x: (x[1] is None, -(x[1] or 0)),
    )
    lines.append(
        f"  {'Driver':<8} {'2024 avg':>9} {'Linear':>10} {'PowerCurve':>12} {'RankBased':>10} {'TierBased':>10}"
    )
    lines.append("  " + "-" * 62)
    for name, avg in sorted_drivers:
        avg_str = f"{avg:.1f}" if avg is not None else "rookie"
        row_vals = []
        for a in approach_names:
            row_vals.append(fmt_m(price_tables[a]["drivers"].get(name, DRIVER_FLOOR)))
        lines.append(
            f"  {name:<8} {avg_str:>9} {row_vals[0]:>10} {row_vals[1]:>12} {row_vals[2]:>10} {row_vals[3]:>10}"
        )

    lines.append("\n## Constructor Price Lists (sorted by 2024 per-race avg)\n")
    sorted_constructors = sorted(constructor_avgs, key=lambda x: -x[1])
    lines.append(
        f"  {'Constructor':<16} {'2024 avg':>9} {'Linear':>10} {'PowerCurve':>12} {'RankBased':>10} {'TierBased':>10}"
    )
    lines.append("  " + "-" * 70)
    for name, avg in sorted_constructors:
        row_vals = []
        for a in approach_names:
            row_vals.append(fmt_m(price_tables[a]["constructors"].get(name, CONSTRUCTOR_FLOOR)))
        lines.append(
            f"  {name:<16} {avg:>9.1f} {row_vals[0]:>10} {row_vals[1]:>12} {row_vals[2]:>10} {row_vals[3]:>10}"
        )

    # ── Dream team breakdown ────────────────────────────────────────────
    lines.append("\n## Dream Team Cost Breakdown\n")
    lines.append(
        f"  {'Entity':<12} {'Type':<8} {'Linear':>10} {'PowerCurve':>12} {'RankBased':>10} {'TierBased':>10}"
    )
    lines.append("  " + "-" * 65)

    reverse_c_map = {v: k for k, v in CONSTRUCTOR_NAME_MAP_2024_TO_2025.items()}
    for d in dream_drivers:
        row_vals = [fmt_m(price_tables[a]["drivers"].get(d, DRIVER_FLOOR)) for a in approach_names]
        lines.append(
            f"  {d:<12} {'driver':<8} {row_vals[0]:>10} {row_vals[1]:>12} {row_vals[2]:>10} {row_vals[3]:>10}"
        )
    for c in dream_constructors:
        key = reverse_c_map.get(c, c)
        row_vals = [fmt_m(price_tables[a]["constructors"].get(key, CONSTRUCTOR_FLOOR)) for a in approach_names]
        lines.append(
            f"  {c:<12} {'constr':<8} {row_vals[0]:>10} {row_vals[1]:>12} {row_vals[2]:>10} {row_vals[3]:>10}"
        )
    lines.append("  " + "-" * 65)
    total_vals = [fmt_m(best_by_approach[a]["dream_team_cost"]) for a in approach_names]
    cap_vals = [fmt_m(best_by_approach[a]["budget_cap"]) for a in approach_names]
    lines.append(
        f"  {'TOTAL':<12} {'':<8} {total_vals[0]:>10} {total_vals[1]:>12} {total_vals[2]:>10} {total_vals[3]:>10}"
    )
    lines.append(
        f"  {'vs cap':<12} {'':<8} {cap_vals[0]:>10} {cap_vals[1]:>12} {cap_vals[2]:>10} {cap_vals[3]:>10}"
    )
    tightness_vals = [f"{best_by_approach[a]['tightness']:.1%}" for a in approach_names]
    lines.append(
        f"  {'Tightness':<12} {'':<8} {tightness_vals[0]:>10} {tightness_vals[1]:>12} {tightness_vals[2]:>10} {tightness_vals[3]:>10}"
    )

    # ── Team diversity ──────────────────────────────────────────────────
    lines.append("\n## Team Diversity Analysis\n")
    lines.append(
        f"  {'Metric':<30} {'Linear':>10} {'PowerCurve':>12} {'RankBased':>10} {'TierBased':>10}"
    )
    lines.append("  " + "-" * 75)
    for key, label in [
        ("feasible_count", "Feasible teams"),
        ("best_score", "Best team score"),
        ("teams_within_80pct", "Teams ≥80% of best"),
    ]:
        row_vals = []
        for a in approach_names:
            div = diversity_by_approach.get(a, {})
            v = div.get(key, 0)
            row_vals.append(f"{v:,}" if key != "best_score" else f"{v:,} pts")
        lines.append(
            f"  {label:<30} {row_vals[0]:>10} {row_vals[1]:>12} {row_vals[2]:>10} {row_vals[3]:>10}"
        )

    # ── ASCII price distribution bar charts ─────────────────────────────
    lines.append("\n## Driver Price Distribution (bar chart)\n")
    for approach in approach_names:
        lines.append(f"### {approach}\n")
        sorted_d = sorted(driver_avgs, key=lambda x: (x[1] is None, -(x[1] or 0)))
        names_d = [name for name, _ in sorted_d]
        prices_d = [price_tables[approach]["drivers"][name] for name in names_d]
        lines.append(bar_chart(prices_d, names_d))
        lines.append("")

    lines.append("\n## Constructor Price Distribution (bar chart)\n")
    for approach in approach_names:
        lines.append(f"### {approach}\n")
        names_c = [name for name, _ in sorted_constructors]
        prices_c = [price_tables[approach]["constructors"][name] for name in names_c]
        lines.append(bar_chart(prices_c, names_c))
        lines.append("")

    # ── Recommendation ──────────────────────────────────────────────────
    lines.append("\n## Recommendation\n")
    lines.append(
        "**Complete this section after reviewing the output above.**\n"
    )
    lines.append("Evaluation criteria:\n")
    lines.append("- P1: Dream team costs 125–140% of budget")
    lines.append("- P2: At least 50 feasible teams score within 80% of best")
    lines.append("- Qualitative: Does the price list feel fair and intuitive?")
    lines.append("- Qualitative: Does score magnitude translate meaningfully to price?")
    lines.append("- Qualitative: Are there interesting trade-offs between picks?\n")
    lines.append("Winner: **[TBD — fill in after reviewing comparison_summary.md]**\n")

    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")


# ── Main ──────────────────────────────────────────────────────────────────


def main() -> None:
    # Load 2024 data (for preseason pricing)
    driver_rows_2024 = load_driver_data(DATA_2024_DIR / "season_totals.csv")
    constructor_rows_2024 = load_constructor_data(DATA_2024_DIR / "season_constructor_totals.csv")

    # Load 2025 data (for dream team identification and diversity scoring)
    driver_rows_2025 = load_driver_data(DATA_2025_DIR / "season_totals.csv")
    constructor_rows_2025 = load_constructor_data(DATA_2025_DIR / "season_constructor_totals.csv")

    # Build per-race averages from 2024
    driver_avgs = build_avgs(driver_rows_2024)
    constructor_avgs = build_constructor_avgs(constructor_rows_2024)

    # Identify 2025 dream team (top 5D + top 3C by 2025 totals)
    dream_drivers, dream_constructors = identify_dream_team(driver_rows_2025, constructor_rows_2025)
    print(f"Dream team drivers:      {dream_drivers}")
    print(f"Dream team constructors: {dream_constructors}")

    # ── Parameter sweeps ─────────────────────────────────────────────────
    print("Sweeping: linear...", flush=True)
    linear_rows = sweep_linear(driver_avgs, constructor_avgs, dream_drivers, dream_constructors)

    print("Sweeping: power curve...", flush=True)
    power_rows = sweep_power_curve(driver_avgs, constructor_avgs, dream_drivers, dream_constructors)

    print("Sweeping: rank-based...", flush=True)
    rank_rows = sweep_rank_based(driver_avgs, constructor_avgs, dream_drivers, dream_constructors)

    print("Sweeping: tier-based...", flush=True)
    tier_rows = sweep_tier_based(driver_avgs, constructor_avgs, dream_drivers, dream_constructors)

    all_rows = linear_rows + power_rows + rank_rows + tier_rows

    # ── Select best params per approach ──────────────────────────────────
    best_by_approach: dict[str, dict] = {
        "linear": select_best_params(linear_rows),
        "power_curve": select_best_params(power_rows),
        "rank_based": select_best_params(rank_rows),
        "tier_based": select_best_params(tier_rows),
    }

    for approach, best in best_by_approach.items():
        print(
            f"  {approach:<14}: {params_label(best)}, "
            f"cap={fmt_m(best['budget_cap'])}, "
            f"DT={fmt_m(best['dream_team_cost'])}, "
            f"tightness={best['tightness']:.1%}"
        )

    # ── Team diversity (best params only) ────────────────────────────────
    print("Analyzing team diversity (this may take a moment)...", flush=True)
    driver_scores_2025 = {r["driver"]: r["season_total"] for r in driver_rows_2025}
    constructor_scores_2025 = {r["constructor"]: r["season_total"] for r in constructor_rows_2025}
    # Map 2024 constructor keys → 2025 names for scoring lookup
    # (price keys are 2024 names; score lookup uses 2025 names)
    # Build a constructor score dict keyed by 2024 names:
    constructor_scores_2024_keyed: dict[str, int] = {}
    for name_2024, name_2025 in CONSTRUCTOR_NAME_MAP_2024_TO_2025.items():
        if name_2025 in constructor_scores_2025:
            constructor_scores_2024_keyed[name_2024] = constructor_scores_2025[name_2025]
    for row in constructor_rows_2025:
        c = row["constructor"]
        if c not in {v for v in CONSTRUCTOR_NAME_MAP_2024_TO_2025.values()}:
            constructor_scores_2024_keyed[c] = row["season_total"]

    diversity_by_approach: dict[str, dict] = {}
    for approach, best in best_by_approach.items():
        pt = _compute_prices_for_row(best, driver_avgs, constructor_avgs)
        cap = best["budget_cap"]
        print(f"  {approach}...", flush=True)
        diversity_by_approach[approach] = analyze_team_diversity(
            pt["drivers"],
            pt["constructors"],
            driver_scores_2025,
            constructor_scores_2024_keyed,
            cap,
        )
        div = diversity_by_approach[approach]
        print(
            f"    feasible={div['feasible_count']:,}, "
            f"best={div['best_score']:,}pts, "
            f"within80%={div['teams_within_80pct']:,}"
        )

    # ── Write outputs ─────────────────────────────────────────────────────
    BAKEOFF_DIR.mkdir(parents=True, exist_ok=True)

    sweep_path = BAKEOFF_DIR / "parameter_sweep.csv"
    print(f"Writing {sweep_path}...", flush=True)
    write_parameter_sweep(all_rows, sweep_path)

    best_prices_path = BAKEOFF_DIR / "best_prices.csv"
    print(f"Writing {best_prices_path}...", flush=True)
    write_best_prices(best_by_approach, driver_avgs, constructor_avgs, best_prices_path)

    summary_path = BAKEOFF_DIR / "comparison_summary.md"
    print(f"Writing {summary_path}...", flush=True)
    write_comparison_summary(
        best_by_approach,
        driver_avgs,
        constructor_avgs,
        driver_rows_2025,
        constructor_rows_2025,
        dream_drivers,
        dream_constructors,
        diversity_by_approach,
        summary_path,
    )

    print("\nDone. Output in:", BAKEOFF_DIR)
    print(f"  parameter_sweep.csv  ({len(all_rows):,} rows)")
    print(f"  best_prices.csv")
    print(f"  comparison_summary.md")


if __name__ == "__main__":
    main()
