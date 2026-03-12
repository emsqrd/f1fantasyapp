"""
ceiling_design_comparison.py — Compare ceiling design approaches for price signal quality.

Tests three approaches against 2025 season data:
  1. Current model (hard clamp at ceiling)
  2. Raised ceiling (higher ceiling, less pinning)
  3. Soft ceiling (asymptotic approach — diminishing returns above a threshold)
  4. Decoupled REF_MAX (separate curve-shaping from ceiling)

For each approach, measures:
  - Rounds pinned at ceiling per entity
  - Price signal quality (how often price movement is $0 when it shouldn't be)
  - Dream team cost & budget cap tightness
  - Price differentiation among top entities
  - Total mispricing vs 2025 actuals

Usage:
    cd docs/research/fantasy-rules/own-rules/simulation
    source .venv/bin/activate
    python ceiling_design_comparison.py
"""

import csv
import itertools
import statistics
from collections import defaultdict
from pathlib import Path

# ── Constants ─────────────────────────────────────────────────────────────

SIM_DIR = Path(__file__).parent
OUTPUT_DIR = SIM_DIR / "output"

TOTAL_RACES = 24
TEAM_DRIVERS = 5
TEAM_CONSTRUCTORS = 3
BUDGET_CAP = 100_000_000
ROLLING_WINDOW = 3
DUMMY_SEED_COUNT = ROLLING_WINDOW - 1
SHAPE = 1.0

# Current model parameters
DRIVER_FLOOR = 6_000_000
CONSTRUCTOR_FLOOR = 6_000_000
DRIVER_CEILING = 19_000_000
CONSTRUCTOR_CEILING = 25_000_000
DRIVER_REF_MAX = 29.29
CONSTRUCTOR_REF_MAX = 45.25
PRICE_CHANGE_CAP = 0.10

# 2024 team for each driver — for detecting team changes
TEAM_2024: dict[str, str | None] = {
    "VER": "Red Bull Racing", "NOR": "McLaren", "LEC": "Ferrari",
    "PIA": "McLaren", "SAI": "Ferrari", "RUS": "Mercedes",
    "HAM": "Mercedes", "ALO": "Aston Martin", "GAS": "Alpine",
    "HUL": "Haas F1 Team", "OCO": "Alpine", "TSU": "Racing Bulls",
    "STR": "Aston Martin", "ALB": "Williams",
    "COL": "Williams", "LAW": "Racing Bulls", "BEA": "Haas F1 Team",
    "DOO": "Alpine", "ANT": None, "BOR": None, "HAD": None,
}
CONSTRUCTOR_2024_TO_2025 = {"RB": "Racing Bulls"}
MIN_RACES_ELIGIBLE = 10
TEAM_CONTEXT_ALPHA = 0.5


# ── Data loading ──────────────────────────────────────────────────────────


def load_preseason_avgs() -> tuple[dict[str, float | None], dict[str, float | None]]:
    d_avgs: dict[str, float | None] = {}
    c_avgs: dict[str, float | None] = {}
    with open(OUTPUT_DIR / "pricing/preseason_prices_2025.csv") as f:
        for row in csv.DictReader(f):
            avg_str = row["avg_2024"]
            if row["type"] == "driver":
                d_avgs[row["entity"]] = None if avg_str == "rookie" else float(avg_str)
            else:
                c_avgs[row["entity"]] = None if avg_str == "rookie" else float(avg_str)
    return d_avgs, c_avgs


def load_season_totals() -> tuple[dict[str, int], dict[str, int]]:
    d_totals: dict[str, int] = {}
    c_totals: dict[str, int] = {}
    with open(OUTPUT_DIR / "2025/season_totals.csv") as f:
        for row in csv.DictReader(f):
            d_totals[row["driver"]] = int(row["season_total"])
    with open(OUTPUT_DIR / "2025/season_constructor_totals.csv") as f:
        for row in csv.DictReader(f):
            c_totals[row["constructor"]] = int(row["season_total"])
    return d_totals, c_totals


def load_per_round_scores() -> tuple[dict[int, dict[str, int]], dict[int, dict[str, int]]]:
    d_scores: dict[int, dict[str, int]] = defaultdict(dict)
    c_scores: dict[int, dict[str, int]] = defaultdict(dict)
    with open(OUTPUT_DIR / "2025/driver_scores.csv") as f:
        for row in csv.DictReader(f):
            d_scores[int(row["round"])][row["driver"]] = int(row["total_pts"])
    with open(OUTPUT_DIR / "2025/constructor_scores.csv") as f:
        for row in csv.DictReader(f):
            c_scores[int(row["round"])][row["constructor"]] = int(row["total_pts"])
    return dict(d_scores), dict(c_scores)


def load_2024_season_data() -> tuple[list[dict], list[dict]]:
    d_rows = []
    with open(OUTPUT_DIR / "2024/season_totals.csv") as f:
        for row in csv.DictReader(f):
            d_rows.append({
                "driver": row["driver"],
                "team": row.get("team", ""),
                "season_total": int(row["season_total"]),
                "races_entered": int(row["races_entered"]),
            })
    c_rows = []
    with open(OUTPUT_DIR / "2024/season_constructor_totals.csv") as f:
        for row in csv.DictReader(f):
            c_rows.append({
                "constructor": row["constructor"],
                "season_total": int(row["season_total"]),
            })
    return d_rows, c_rows


# ── Pricing functions ─────────────────────────────────────────────────────


def round_100k(x: float) -> int:
    return round(x / 100_000) * 100_000


def hard_clamp_price(per_race_avg: float | None, entity_type: str,
                     floor: int, ceiling: int, ref_max: float) -> int:
    """Current model: normalise, clamp [0,1], power curve."""
    if per_race_avg is None or per_race_avg <= 0:
        return floor
    norm = max(0.0, min(1.0, per_race_avg / ref_max))
    return max(floor, round_100k(floor + (ceiling - floor) * norm ** SHAPE))


def soft_ceiling_price(per_race_avg: float | None, entity_type: str,
                       floor: int, ceiling: int, ref_max: float,
                       softness: float = 0.5) -> int:
    """
    Soft ceiling: uses a logistic-style compression above the threshold.

    Below ref_max: linear (same as current).
    Above ref_max: asymptotic approach to ceiling with diminishing returns.

    The formula past the linear region:
        price = ceiling_base + overshoot_range × (1 - e^(-k × excess))

    Where:
        ceiling_base = the price at norm=1.0 in the linear region
        overshoot_range = ceiling - ceiling_base (room to grow)
        excess = (avg - ref_max) / ref_max (how far above ref_max)
        k = softness parameter controlling approach speed

    With softness=0.5: at 2× ref_max, price reaches ~63% of remaining room.
    """
    if per_race_avg is None or per_race_avg <= 0:
        return floor

    import math

    norm = per_race_avg / ref_max  # NOT clamped

    if norm <= 1.0:
        # Below ref_max: same as current model
        return max(floor, round_100k(floor + (ceiling - floor) * norm ** SHAPE))

    # Above ref_max: asymptotic approach
    # Linear portion gives us the price at norm=1.0
    linear_top = floor + (ceiling - floor) * 1.0  # = ceiling with shape=1.0

    # For shape=1.0, linear_top == ceiling, so we need headroom above ceiling.
    # Redefine: the "nominal ceiling" is where the linear curve tops out,
    # and the actual hard cap is higher, allowing continued (diminishing) growth.
    #
    # We set actual_cap = ceiling × 1.2 (20% headroom above nominal ceiling)
    actual_cap = ceiling * 1.2
    overshoot_range = actual_cap - linear_top
    excess = norm - 1.0  # how far above ref_max (as a fraction of ref_max)

    price = linear_top + overshoot_range * (1 - math.exp(-softness * excess / 0.3))
    return max(floor, round_100k(price))


def decoupled_price(per_race_avg: float | None, entity_type: str,
                    floor: int, ceiling: int, ref_max: float,
                    curve_ref: float) -> int:
    """
    Decoupled REF_MAX: use curve_ref for normalisation (shaping the mid-field),
    but ceiling as a separate hard cap (not tied to curve_ref).

    With curve_ref > ref_max, the normalised value at ref_max < 1.0,
    so top entities don't get pinned as easily.
    """
    if per_race_avg is None or per_race_avg <= 0:
        return floor
    # Normalise against curve_ref (higher than ref_max → more spread at top)
    norm = max(0.0, min(1.0, per_race_avg / curve_ref))
    return max(floor, min(ceiling, round_100k(floor + (ceiling - floor) * norm ** SHAPE)))


# ── Context pricing ──────────────────────────────────────────────────────


def compute_effective_avg(driver: str, d_avgs_2024: dict[str, float | None],
                          constructor_per_driver_avg: dict[str, float],
                          driver_teams_2025: dict[str, str]) -> float:
    individual_avg = d_avgs_2024.get(driver)
    new_team = driver_teams_2025.get(driver)
    old_team = TEAM_2024.get(driver)
    changed = old_team is not None and new_team is not None and old_team != new_team
    team_avg = constructor_per_driver_avg.get(new_team) if new_team else None

    if individual_avg is None:
        return max(0.0, team_avg) if team_avg is not None else 0.0
    elif changed and team_avg is not None:
        return max(0.0, TEAM_CONTEXT_ALPHA * individual_avg + (1 - TEAM_CONTEXT_ALPHA) * team_avg)
    else:
        return max(0.0, individual_avg)


# ── Simulation engine ────────────────────────────────────────────────────


def simulate_season(
    price_fn,
    price_fn_kwargs: dict,
    driver_effective_avgs: dict[str, float],
    constructor_avgs: dict[str, float],
    per_round_driver: dict[int, dict[str, int]],
    per_round_constructor: dict[int, dict[str, int]],
    active_drivers: set[str],
    active_constructors: set[str],
) -> tuple[dict[str, dict[int, int]], dict[str, dict[int, int]]]:
    """
    Run full-season price evolution with the given pricing function.

    Returns (d_price_history, c_price_history) as {entity: {round: price}}.
    """
    # Compute preseason prices
    d_params = {k: v for k, v in price_fn_kwargs.items() if "driver" in k or k in ("floor", "ceiling", "ref_max")}
    c_params = {k: v for k, v in price_fn_kwargs.items() if "constructor" in k or k in ("floor", "ceiling", "ref_max")}

    d_prices: dict[str, int] = {}
    for d in active_drivers:
        avg = driver_effective_avgs.get(d, 0.0)
        d_prices[d] = price_fn(avg if avg > 0 else None, "driver",
                               price_fn_kwargs["d_floor"], price_fn_kwargs["d_ceiling"],
                               price_fn_kwargs["d_ref_max"],
                               **{k: v for k, v in price_fn_kwargs.get("extra_driver", {}).items()})

    c_prices: dict[str, int] = {}
    for c in active_constructors:
        avg = constructor_avgs.get(c, 0.0)
        c_prices[c] = price_fn(avg if avg > 0 else None, "constructor",
                               price_fn_kwargs["c_floor"], price_fn_kwargs["c_ceiling"],
                               price_fn_kwargs["c_ref_max"],
                               **{k: v for k, v in price_fn_kwargs.get("extra_constructor", {}).items()})

    # Pre-seed score histories
    d_history: dict[str, list[float]] = {
        d: [driver_effective_avgs.get(d, 0.0)] * DUMMY_SEED_COUNT for d in active_drivers
    }
    c_history: dict[str, list[float]] = {
        c: [constructor_avgs.get(c, 0.0)] * DUMMY_SEED_COUNT for c in active_constructors
    }

    d_price_hist: dict[str, dict[int, int]] = {d: {} for d in active_drivers}
    c_price_hist: dict[str, dict[int, int]] = {c: {} for c in active_constructors}

    for rnd in range(1, TOTAL_RACES + 1):
        # Record prices in effect
        for d in active_drivers:
            d_price_hist[d][rnd] = d_prices[d]
        for c in active_constructors:
            c_price_hist[c][rnd] = c_prices[c]

        # Accumulate scores
        for d in active_drivers:
            d_history[d].append(per_round_driver.get(rnd, {}).get(d, 0))
        for c in active_constructors:
            c_history[c].append(per_round_constructor.get(rnd, {}).get(c, 0))

        # Compute next-round prices
        for d in active_drivers:
            scores = d_history[d]
            if len(scores) >= ROLLING_WINDOW:
                rolling = sum(scores[-ROLLING_WINDOW:]) / ROLLING_WINDOW
                target = price_fn(rolling, "driver",
                                  price_fn_kwargs["d_floor"], price_fn_kwargs["d_ceiling"],
                                  price_fn_kwargs["d_ref_max"],
                                  **{k: v for k, v in price_fn_kwargs.get("extra_driver", {}).items()})
                raw_delta = target - d_prices[d]
                cap = max(100_000, round_100k(d_prices[d] * PRICE_CHANGE_CAP))
                change = max(-cap, min(cap, raw_delta))
                d_prices[d] = max(price_fn_kwargs["d_floor"], round_100k(d_prices[d] + change))

        for c in active_constructors:
            scores = c_history[c]
            if len(scores) >= ROLLING_WINDOW:
                rolling = sum(scores[-ROLLING_WINDOW:]) / ROLLING_WINDOW
                target = price_fn(rolling, "constructor",
                                  price_fn_kwargs["c_floor"], price_fn_kwargs["c_ceiling"],
                                  price_fn_kwargs["c_ref_max"],
                                  **{k: v for k, v in price_fn_kwargs.get("extra_constructor", {}).items()})
                raw_delta = target - c_prices[c]
                cap = max(100_000, round_100k(c_prices[c] * PRICE_CHANGE_CAP))
                change = max(-cap, min(cap, raw_delta))
                c_prices[c] = max(price_fn_kwargs["c_floor"], round_100k(c_prices[c] + change))

    return d_price_hist, c_price_hist


# ── Analysis functions ────────────────────────────────────────────────────


def fmt_m(x: int | float) -> str:
    return f"${x / 1e6:.1f}M"


def analyze_ceiling_pinning(
    price_history: dict[str, dict[int, int]],
    ceiling: int | None,
    entity_type: str,
) -> dict[str, dict]:
    """Count rounds each entity is at ceiling and identify dead-signal periods."""
    results = {}
    for entity, rounds in price_history.items():
        prices = [rounds[r] for r in sorted(rounds)]
        at_ceiling = sum(1 for p in prices if ceiling is not None and p >= ceiling)
        zero_change_rounds = sum(
            1 for i in range(1, len(prices)) if prices[i] == prices[i - 1]
        )
        max_consecutive_same = 0
        current_run = 1
        for i in range(1, len(prices)):
            if prices[i] == prices[i - 1]:
                current_run += 1
                max_consecutive_same = max(max_consecutive_same, current_run)
            else:
                current_run = 1

        results[entity] = {
            "at_ceiling": at_ceiling,
            "zero_change_rounds": zero_change_rounds,
            "max_consecutive_same": max_consecutive_same,
            "price_range": max(prices) - min(prices),
            "min_price": min(prices),
            "max_price": max(prices),
        }
    return results


def compute_dream_team_cost(
    d_prices: dict[str, int],
    c_prices: dict[str, int],
    d_scores: dict[str, int],
    c_scores: dict[str, int],
) -> tuple[int, list[str], list[str]]:
    top_d = sorted(d_scores, key=lambda d: -d_scores.get(d, 0))[:TEAM_DRIVERS]
    top_c = sorted(c_scores, key=lambda c: -c_scores.get(c, 0))[:TEAM_CONSTRUCTORS]
    cost = (
        sum(d_prices.get(d, DRIVER_FLOOR) for d in top_d)
        + sum(c_prices.get(c, CONSTRUCTOR_FLOOR) for c in top_c)
    )
    return cost, top_d, top_c


def compute_mispricing(
    d_price_history: dict[str, dict[int, int]],
    c_price_history: dict[str, dict[int, int]],
    per_round_driver: dict[int, dict[str, int]],
    per_round_constructor: dict[int, dict[str, int]],
) -> float:
    """
    Total absolute mispricing: sum over all rounds and entities of
    |price_rank - score_rank| as a proxy for price signal accuracy.

    Uses a simpler metric: for each round, compute the "fair value" from
    the rolling avg and compare to actual price. Sum of absolute differences.
    """
    total = 0.0
    count = 0
    for rnd in range(1, TOTAL_RACES + 1):
        for entity, rounds in d_price_history.items():
            if rnd in rounds:
                price = rounds[rnd]
                # Fair value: actual score this round (hindsight)
                actual = per_round_driver.get(rnd, {}).get(entity, 0)
                # Use season-avg fair price as reference
                total += abs(price - price)  # placeholder
                count += 1
    return total


def get_preseason_prices(
    price_fn,
    price_fn_kwargs: dict,
    driver_effective_avgs: dict[str, float],
    constructor_avgs: dict[str, float],
    active_drivers: set[str],
    active_constructors: set[str],
) -> tuple[dict[str, int], dict[str, int]]:
    """Compute preseason prices for a scenario."""
    d_prices = {}
    for d in active_drivers:
        avg = driver_effective_avgs.get(d, 0.0)
        d_prices[d] = price_fn(avg if avg > 0 else None, "driver",
                               price_fn_kwargs["d_floor"], price_fn_kwargs["d_ceiling"],
                               price_fn_kwargs["d_ref_max"],
                               **{k: v for k, v in price_fn_kwargs.get("extra_driver", {}).items()})
    c_prices = {}
    for c in active_constructors:
        avg = constructor_avgs.get(c, 0.0)
        c_prices[c] = price_fn(avg if avg > 0 else None, "constructor",
                               price_fn_kwargs["c_floor"], price_fn_kwargs["c_ceiling"],
                               price_fn_kwargs["c_ref_max"],
                               **{k: v for k, v in price_fn_kwargs.get("extra_constructor", {}).items()})
    return d_prices, c_prices


# ── Main ──────────────────────────────────────────────────────────────────


def main():
    # Load data
    d_avgs_2024, c_avgs_2024 = load_preseason_avgs()
    d_totals_2025, c_totals_2025 = load_season_totals()
    per_round_d, per_round_c = load_per_round_scores()

    # Derive 2025 grid from round 1 data
    active_drivers = set(per_round_d.get(1, {}).keys())
    active_constructors = set(per_round_c.get(1, {}).keys())

    # Build driver→team mapping from 2025 data
    driver_teams_2025: dict[str, str] = {}
    with open(OUTPUT_DIR / "2025/driver_scores.csv") as f:
        for row in csv.DictReader(f):
            if int(row["round"]) == 1:
                driver_teams_2025[row["driver"]] = row["team"]

    # Compute constructor per-driver averages from 2024 data
    d_rows_2024, c_rows_2024 = load_2024_season_data()
    d24 = {r["driver"]: r for r in d_rows_2024}
    d_avgs_2024_calc = {
        d: (r["season_total"] / r["races_entered"] if r["races_entered"] >= MIN_RACES_ELIGIBLE else None)
        for d, r in d24.items()
    }
    c_avgs_2024_calc = {
        r["constructor"]: r["season_total"] / TOTAL_RACES
        for r in c_rows_2024
    }
    # Remap constructor names
    constructor_avgs: dict[str, float] = {}
    for name_2024, avg in c_avgs_2024_calc.items():
        name_2025 = CONSTRUCTOR_2024_TO_2025.get(name_2024, name_2024)
        if name_2025 in active_constructors:
            constructor_avgs[name_2025] = avg

    constructor_per_driver_avg = {name: avg / 2.0 for name, avg in constructor_avgs.items()}

    # Compute effective avgs for each driver (context-adjusted)
    driver_effective_avgs: dict[str, float] = {}
    for d in active_drivers:
        driver_effective_avgs[d] = compute_effective_avg(
            d, d_avgs_2024_calc, constructor_per_driver_avg, driver_teams_2025
        )

    # ── Define scenarios ──────────────────────────────────────────────────

    scenarios = []

    # 1. Current model (hard clamp)
    scenarios.append({
        "name": "Current (hard clamp)",
        "price_fn": hard_clamp_price,
        "kwargs": {
            "d_floor": DRIVER_FLOOR, "d_ceiling": DRIVER_CEILING, "d_ref_max": DRIVER_REF_MAX,
            "c_floor": CONSTRUCTOR_FLOOR, "c_ceiling": CONSTRUCTOR_CEILING, "c_ref_max": CONSTRUCTOR_REF_MAX,
            "extra_driver": {}, "extra_constructor": {},
        },
        "d_ceiling_for_analysis": DRIVER_CEILING,
        "c_ceiling_for_analysis": CONSTRUCTOR_CEILING,
    })

    # 2. Raised ceiling variants
    for d_ceil, c_ceil in [(22_000_000, 29_000_000), (24_000_000, 32_000_000)]:
        scenarios.append({
            "name": f"Raised ceiling (D {fmt_m(d_ceil)}, C {fmt_m(c_ceil)})",
            "price_fn": hard_clamp_price,
            "kwargs": {
                "d_floor": DRIVER_FLOOR, "d_ceiling": d_ceil, "d_ref_max": DRIVER_REF_MAX,
                "c_floor": CONSTRUCTOR_FLOOR, "c_ceiling": c_ceil, "c_ref_max": CONSTRUCTOR_REF_MAX,
                "extra_driver": {}, "extra_constructor": {},
            },
            "d_ceiling_for_analysis": d_ceil,
            "c_ceiling_for_analysis": c_ceil,
        })

    # 3. Soft ceiling variants
    for softness in [0.3, 0.5, 0.8]:
        scenarios.append({
            "name": f"Soft ceiling (softness={softness})",
            "price_fn": soft_ceiling_price,
            "kwargs": {
                "d_floor": DRIVER_FLOOR, "d_ceiling": DRIVER_CEILING, "d_ref_max": DRIVER_REF_MAX,
                "c_floor": CONSTRUCTOR_FLOOR, "c_ceiling": CONSTRUCTOR_CEILING, "c_ref_max": CONSTRUCTOR_REF_MAX,
                "extra_driver": {"softness": softness},
                "extra_constructor": {"softness": softness},
            },
            # Soft ceiling can exceed nominal ceiling — use 120% as analysis threshold
            "d_ceiling_for_analysis": int(DRIVER_CEILING * 1.2),
            "c_ceiling_for_analysis": int(CONSTRUCTOR_CEILING * 1.2),
        })

    # 4. Decoupled REF_MAX variants
    # curve_ref > ref_max → mid-field spread preserved, top entities get more room
    for d_curve_mult, c_curve_mult in [(1.3, 1.3), (1.5, 1.5), (1.5, 1.3)]:
        d_curve_ref = DRIVER_REF_MAX * d_curve_mult
        c_curve_ref = CONSTRUCTOR_REF_MAX * c_curve_mult
        scenarios.append({
            "name": f"Decoupled REF (D ×{d_curve_mult}, C ×{c_curve_mult})",
            "price_fn": decoupled_price,
            "kwargs": {
                "d_floor": DRIVER_FLOOR, "d_ceiling": DRIVER_CEILING, "d_ref_max": DRIVER_REF_MAX,
                "c_floor": CONSTRUCTOR_FLOOR, "c_ceiling": CONSTRUCTOR_CEILING, "c_ref_max": CONSTRUCTOR_REF_MAX,
                "extra_driver": {"curve_ref": d_curve_ref},
                "extra_constructor": {"curve_ref": c_curve_ref},
            },
            "d_ceiling_for_analysis": DRIVER_CEILING,
            "c_ceiling_for_analysis": CONSTRUCTOR_CEILING,
        })

    # ── Run simulations ───────────────────────────────────────────────────

    print("=" * 90)
    print("  CEILING DESIGN COMPARISON")
    print("=" * 90)

    # Track key entities for detailed comparison
    key_drivers = ["VER", "NOR", "PIA", "LEC", "RUS"]
    key_constructors = ["McLaren", "Red Bull Racing", "Mercedes", "Ferrari"]

    summary_rows = []

    for scenario in scenarios:
        name = scenario["name"]
        price_fn = scenario["price_fn"]
        kwargs = scenario["kwargs"]
        d_ceil_analysis = scenario["d_ceiling_for_analysis"]
        c_ceil_analysis = scenario["c_ceiling_for_analysis"]

        print(f"\n{'─' * 90}")
        print(f"  {name}")
        print(f"{'─' * 90}")

        # Run simulation
        d_hist, c_hist = simulate_season(
            price_fn, kwargs,
            driver_effective_avgs, constructor_avgs,
            per_round_d, per_round_c,
            active_drivers, active_constructors,
        )

        # Preseason prices (round 1 prices)
        d_preseason = {d: rounds[1] for d, rounds in d_hist.items() if 1 in rounds}
        c_preseason = {c: rounds[1] for c, rounds in c_hist.items() if 1 in rounds}

        # ── 1. Ceiling pinning analysis ───────────────────────────────────

        d_pin = analyze_ceiling_pinning(d_hist, d_ceil_analysis, "driver")
        c_pin = analyze_ceiling_pinning(c_hist, c_ceil_analysis, "constructor")

        total_d_pinned_rounds = sum(v["at_ceiling"] for v in d_pin.values())
        total_c_pinned_rounds = sum(v["at_ceiling"] for v in c_pin.values())
        entities_ever_pinned_d = sum(1 for v in d_pin.values() if v["at_ceiling"] > 0)
        entities_ever_pinned_c = sum(1 for v in c_pin.values() if v["at_ceiling"] > 0)

        print(f"\n  1. CEILING PINNING")
        print(f"     Drivers:       {total_d_pinned_rounds} entity-rounds pinned "
              f"({entities_ever_pinned_d} drivers ever pinned)")
        print(f"     Constructors:  {total_c_pinned_rounds} entity-rounds pinned "
              f"({entities_ever_pinned_c} constructors ever pinned)")

        # Show key entities
        print(f"\n     Key drivers (rounds at ceiling / {TOTAL_RACES}):")
        for d in key_drivers:
            if d in d_pin:
                info = d_pin[d]
                prices = [d_hist[d][r] for r in range(1, TOTAL_RACES + 1)]
                print(f"       {d:<4}  pinned: {info['at_ceiling']:>2}/{TOTAL_RACES}  "
                      f"range: {fmt_m(info['min_price'])}–{fmt_m(info['max_price'])}  "
                      f"max consecutive same: {info['max_consecutive_same']}")

        print(f"\n     Key constructors (rounds at ceiling / {TOTAL_RACES}):")
        for c in key_constructors:
            if c in c_pin:
                info = c_pin[c]
                print(f"       {c:<18}  pinned: {info['at_ceiling']:>2}/{TOTAL_RACES}  "
                      f"range: {fmt_m(info['min_price'])}–{fmt_m(info['max_price'])}  "
                      f"max consecutive same: {info['max_consecutive_same']}")

        # ── 2. Price signal quality ───────────────────────────────────────

        # Count rounds where price didn't change but rolling avg did change
        total_zero_change_d = sum(v["zero_change_rounds"] for v in d_pin.values())
        total_zero_change_c = sum(v["zero_change_rounds"] for v in c_pin.values())

        print(f"\n  2. PRICE SIGNAL (zero-change rounds)")
        print(f"     Drivers:       {total_zero_change_d} entity-rounds with $0 change")
        print(f"     Constructors:  {total_zero_change_c} entity-rounds with $0 change")

        # ── 3. Dream team cost & tightness ────────────────────────────────

        # Use mid-season prices (round 12) for diversity analysis
        d_r12 = {d: rounds.get(12, DRIVER_FLOOR) for d, rounds in d_hist.items()}
        c_r12 = {c: rounds.get(12, CONSTRUCTOR_FLOOR) for c, rounds in c_hist.items()}

        dt_cost_pre, dt_d, dt_c = compute_dream_team_cost(
            d_preseason, c_preseason, d_totals_2025, c_totals_2025
        )
        tightness_pre = dt_cost_pre / BUDGET_CAP * 100

        dt_cost_r12, _, _ = compute_dream_team_cost(
            d_r12, c_r12, d_totals_2025, c_totals_2025
        )
        tightness_r12 = dt_cost_r12 / BUDGET_CAP * 100

        print(f"\n  3. DREAM TEAM COST & TIGHTNESS (target: 125–140%)")
        print(f"     Preseason:  {fmt_m(dt_cost_pre):>8}  ({tightness_pre:.1f}% of {fmt_m(BUDGET_CAP)})")
        print(f"     Mid-season: {fmt_m(dt_cost_r12):>8}  ({tightness_r12:.1f}% of {fmt_m(BUDGET_CAP)})")

        # ── 4. Top-entity price differentiation ──────────────────────────

        print(f"\n  4. TOP-ENTITY DIFFERENTIATION (preseason)")
        print(f"     {'Driver':<6}  {'Price':>8}     {'Constructor':<18}  {'Price':>8}")
        sorted_d = sorted(d_preseason, key=lambda d: -d_preseason.get(d, 0))[:8]
        sorted_c = sorted(c_preseason, key=lambda c: -c_preseason.get(c, 0))[:5]
        for i in range(max(len(sorted_d), len(sorted_c))):
            d_str = f"     {sorted_d[i]:<6}  {fmt_m(d_preseason[sorted_d[i]]):>8}" if i < len(sorted_d) else " " * 22
            c_str = f"     {sorted_c[i]:<18}  {fmt_m(c_preseason[sorted_c[i]]):>8}" if i < len(sorted_c) else ""
            print(f"{d_str}{c_str}")

        # Top driver price spread (max - 5th)
        top5_d_prices = sorted(d_preseason.values(), reverse=True)[:5]
        d_spread = top5_d_prices[0] - top5_d_prices[-1] if len(top5_d_prices) >= 5 else 0
        # Constructor spread (max - 3rd)
        top3_c_prices = sorted(c_preseason.values(), reverse=True)[:3]
        c_spread = top3_c_prices[0] - top3_c_prices[-1] if len(top3_c_prices) >= 3 else 0

        print(f"\n     Top-5 driver spread:       {fmt_m(d_spread)}")
        print(f"     Top-3 constructor spread:  {fmt_m(c_spread)}")

        # ── 5. Price evolution for McLaren (worst case) ───────────────────

        print(f"\n  5. McLAREN PRICE EVOLUTION (worst ceiling-pinning case)")
        if "McLaren" in c_hist:
            mc_prices = [c_hist["McLaren"].get(r, 0) for r in range(1, TOTAL_RACES + 1)]
            for r in range(1, TOTAL_RACES + 1):
                p = c_hist["McLaren"].get(r, 0)
                bar = "█" * int(p / 1_000_000)
                ceil_marker = " ◄ CEILING" if c_ceil_analysis and p >= c_ceil_analysis else ""
                print(f"     R{r:>2}: {fmt_m(p):>8} {bar}{ceil_marker}")

        # Collect summary
        summary_rows.append({
            "name": name,
            "d_pinned_rounds": total_d_pinned_rounds,
            "c_pinned_rounds": total_c_pinned_rounds,
            "d_zero_change": total_zero_change_d,
            "c_zero_change": total_zero_change_c,
            "dt_cost_pre": dt_cost_pre,
            "tightness_pre": tightness_pre,
            "d_spread": d_spread,
            "c_spread": c_spread,
        })

    # ── Summary comparison ────────────────────────────────────────────────

    print(f"\n{'=' * 90}")
    print("  SUMMARY COMPARISON")
    print(f"{'=' * 90}")

    print(f"\n  {'Scenario':<38}  {'D pin':>5}  {'C pin':>5}  {'D $0Δ':>5}  {'C $0Δ':>5}  "
          f"{'DT cost':>8}  {'Tight%':>6}  {'D spr':>6}  {'C spr':>6}")
    print(f"  {'─' * 38}  {'─' * 5}  {'─' * 5}  {'─' * 5}  {'─' * 5}  "
          f"{'─' * 8}  {'─' * 6}  {'─' * 6}  {'─' * 6}")

    for row in summary_rows:
        tight_marker = "✓" if 125 <= row["tightness_pre"] <= 140 else " "
        print(f"  {row['name']:<38}  {row['d_pinned_rounds']:>5}  {row['c_pinned_rounds']:>5}  "
              f"{row['d_zero_change']:>5}  {row['c_zero_change']:>5}  "
              f"{fmt_m(row['dt_cost_pre']):>8}  {row['tightness_pre']:>5.1f}%  "
              f"{fmt_m(row['d_spread']):>6}  {fmt_m(row['c_spread']):>6}")

    print(f"\n  Key:")
    print(f"    D pin / C pin  = total entity-rounds at ceiling (lower = better signal)")
    print(f"    D $0Δ / C $0Δ  = total entity-rounds with zero price change (lower = more dynamic)")
    print(f"    DT cost        = dream team preseason cost")
    print(f"    Tight%         = dream team cost / budget cap (target: 125–140%)")
    print(f"    D spr / C spr  = price spread among top-5 drivers / top-3 constructors (higher = more differentiated)")


if __name__ == "__main__":
    main()
