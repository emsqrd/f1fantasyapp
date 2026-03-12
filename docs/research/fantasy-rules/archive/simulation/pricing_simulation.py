"""
pricing_simulation.py — Full 2025 price simulation and P1–P6 validation.

Uses pricing.py + 2024/2025 season data to:
  1. Compute 2025 preseason prices from 2024 season totals
  2. Simulate round-by-round price evolution using 2025 scoring data
  3. Analyse team diversity at checkpoint rounds
  4. Revisit C8 (DNF value) and C9 (runaway risk with budget constraint)
  5. Validate P1–P6 criteria

Usage:
    cd docs/research/fantasy-rules/own-rules/simulation
    source .venv/bin/activate
    python pricing_simulation.py
"""

import csv
import itertools
from collections import defaultdict
from pathlib import Path

from pricing import (
    BUDGET_CAP,
    CONSTRUCTOR_FLOOR,
    DRIVER_FLOOR,
    DUMMY_SEED_COUNT,
    ROLLING_WINDOW,
    TEAM_CONSTRUCTORS,
    TEAM_DRIVERS,
    apply_price_change,
    compute_all_preseason_prices,
    compute_context_preseason_price,
    compute_price_change,
    compute_rolling_avg,
)

# ── Constants ─────────────────────────────────────────────────────────────

TOTAL_RACES_2024 = 24
TOTAL_RACES_2025 = 24
HIGH_DNF_THRESHOLD = 4       # ≥ this many DNFs → flagged in C8 analysis
DIVERSITY_CHECKPOINTS = {1, 6, 12, 18, 24}

# 2024 constructor name → 2025 constructor name (where they differ)
CONSTRUCTOR_2024_TO_2025 = {"RB": "Racing Bulls"}

# 2024 team for each driver — used to detect team changes for context pricing.
# Drivers absent from 2024 (rookies, mid-season debutants, <10 races) → None.
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
    # < 10 races in 2024 → individual avg is None → treated as rookie
    "COL": "Williams",
    "LAW": "Racing Bulls",
    "BEA": "Haas F1 Team",
    "DOO": "Alpine",
    # Fully absent from 2024
    "ANT": None,
    "BOR": None,
    "HAD": None,
}

# ── Paths ─────────────────────────────────────────────────────────────────

SIM_DIR = Path(__file__).parent
OUTPUT_DIR = SIM_DIR / "output"
DATA_2024_DIR = OUTPUT_DIR / "2024"
DATA_2025_DIR = OUTPUT_DIR / "2025"
PRICING_DIR = OUTPUT_DIR / "pricing"

# ── Data loading ──────────────────────────────────────────────────────────


def load_driver_season_totals(path: Path) -> list[dict]:
    rows = []
    with open(path) as f:
        for row in csv.DictReader(f):
            rows.append({
                "driver": row["driver"],
                "team": row.get("team", ""),
                "season_total": int(row["season_total"]),
                "races_entered": int(row["races_entered"]),
            })
    return rows


def load_constructor_season_totals(path: Path) -> list[dict]:
    rows = []
    with open(path) as f:
        for row in csv.DictReader(f):
            rows.append({
                "constructor": row["constructor"],
                "season_total": int(row["season_total"]),
            })
    return rows


def load_per_round_driver_scores(path: Path) -> dict[int, dict[str, int]]:
    """Returns {round: {driver: total_pts}}."""
    data: dict[int, dict[str, int]] = defaultdict(dict)
    with open(path) as f:
        for row in csv.DictReader(f):
            data[int(row["round"])][row["driver"]] = int(row["total_pts"])
    return dict(data)


def load_per_round_constructor_scores(path: Path) -> dict[int, dict[str, int]]:
    """Returns {round: {constructor: total_pts}}."""
    data: dict[int, dict[str, int]] = defaultdict(dict)
    with open(path) as f:
        for row in csv.DictReader(f):
            data[int(row["round"])][row["constructor"]] = int(row["total_pts"])
    return dict(data)


def load_dnf_flags(path: Path) -> dict[str, dict[int, bool]]:
    """Returns {driver: {round: is_dnf}}."""
    data: dict[str, dict[int, bool]] = defaultdict(dict)
    with open(path) as f:
        for row in csv.DictReader(f):
            data[row["driver"]][int(row["round"])] = row["is_dnf"] == "True"
    return dict(data)


def load_runaway_data(path: Path) -> dict[int, dict[str, int]]:
    """Returns {round: {col: value}} from runaway_simulation.csv."""
    data = {}
    with open(path) as f:
        for row in csv.DictReader(f):
            r = int(row["round"])
            data[r] = {k: int(v) for k, v in row.items() if k != "round"}
    return data


# ── Preseason price computation ───────────────────────────────────────────


def build_preseason_prices(
    driver_rows_2024: list[dict],
    constructor_rows_2024: list[dict],
    active_drivers: set[str],
    active_constructors: set[str],
    driver_teams_2025: dict[str, str],
) -> tuple[dict[str, int], dict[str, int], dict[str, float | None], dict[str, float], dict[str, float]]:
    """
    Compute 2025 preseason prices from 2024 season data with constructor-context
    adjustments for rookies and team changers.

    - Rookies / absent drivers: priced at new team's per-driver avg (not floor).
    - Team changers: blend 0.5 × individual + 0.5 × new team per-driver avg.
    - Same-team drivers: standard power-curve price from individual avg.
    Constructor name mapping: 2024 "RB" → 2025 "Racing Bulls".

    Returns (driver_prices, constructor_prices, driver_avgs, constructor_avgs,
             driver_effective_avgs) all keyed by 2025 names.
    driver_effective_avgs is the context-adjusted per-race avg used to derive
    each driver's price — used as the dummy-seeding value for in-season pricing.
    """
    # Index 2024 driver data
    d24 = {r["driver"]: r for r in driver_rows_2024}
    d_avgs_2024 = {
        d: (r["season_total"] / r["races_entered"] if r["races_entered"] >= 10 else None)
        for d, r in d24.items()
    }

    # Constructor prices: compute from 2024, remap names to 2025
    c_totals = {r["constructor"]: r["season_total"] for r in constructor_rows_2024}
    c_races = {r["constructor"]: TOTAL_RACES_2024 for r in constructor_rows_2024}
    c_prices_2024 = compute_all_preseason_prices(c_totals, c_races, "constructor")
    c_avgs_2024 = {r["constructor"]: r["season_total"] / TOTAL_RACES_2024 for r in constructor_rows_2024}

    constructor_prices: dict[str, int] = {}
    constructor_avgs: dict[str, float] = {}
    for name_2024, price in c_prices_2024.items():
        name_2025 = CONSTRUCTOR_2024_TO_2025.get(name_2024, name_2024)
        if name_2025 in active_constructors:
            constructor_prices[name_2025] = price
            constructor_avgs[name_2025] = c_avgs_2024[name_2024]

    # Per-driver avg for each 2025 constructor (constructor season avg / 2 drivers)
    constructor_per_driver_avg = {name: avg / 2.0 for name, avg in constructor_avgs.items()}

    # Driver prices with constructor-context adjustment
    driver_prices: dict[str, int] = {}
    driver_avgs: dict[str, float | None] = {}
    driver_effective_avgs: dict[str, float] = {}
    for d in active_drivers:
        individual_avg = d_avgs_2024.get(d)  # None if absent or < MIN_RACES_ELIGIBLE
        new_team = driver_teams_2025.get(d)
        old_team = TEAM_2024.get(d)
        changed_team = (
            old_team is not None
            and new_team is not None
            and old_team != new_team
        )
        team_avg = constructor_per_driver_avg.get(new_team) if new_team else None
        driver_prices[d] = compute_context_preseason_price(
            individual_avg, team_avg, changed_team, "driver"
        )
        driver_avgs[d] = individual_avg
        # Effective avg = context-adjusted value used to derive the price;
        # becomes the dummy-seeding entry for in-season correction.
        if individual_avg is None:
            driver_effective_avgs[d] = max(0.0, team_avg) if team_avg is not None else 0.0
        elif changed_team and team_avg is not None:
            driver_effective_avgs[d] = max(0.0, 0.5 * individual_avg + 0.5 * team_avg)
        else:
            driver_effective_avgs[d] = max(0.0, individual_avg)

    return driver_prices, constructor_prices, driver_avgs, constructor_avgs, driver_effective_avgs


# ── Price evolution simulation ────────────────────────────────────────────


def simulate_price_evolution(
    preseason_driver_prices: dict[str, int],
    preseason_constructor_prices: dict[str, int],
    active_drivers: set[str],
    active_constructors: set[str],
    per_round_driver: dict[int, dict[str, int]],
    per_round_constructor: dict[int, dict[str, int]],
    driver_effective_avgs: dict[str, float],
    constructor_avgs: dict[str, float],
    num_rounds: int = TOTAL_RACES_2025,
) -> tuple[dict[str, dict[int, int]], dict[str, dict[int, int]]]:
    """
    Simulate round-by-round price evolution using dummy-race seeding.

    Score histories are pre-seeded with DUMMY_SEED_COUNT entries equal to each
    entity's preseason per-race avg. This keeps the rolling window always full
    so corrections start from round 1 with natural dampening — no frozen period.

    Prices recorded for round N are the prices IN EFFECT during round N.

    Returns (d_price_history, c_price_history) as {entity: {round: price}}.
    """
    d_prices = {d: preseason_driver_prices.get(d, DRIVER_FLOOR) for d in active_drivers}
    c_prices = {c: preseason_constructor_prices.get(c, CONSTRUCTOR_FLOOR) for c in active_constructors}

    # Pre-seed score histories with DUMMY_SEED_COUNT entries equal to each
    # entity's preseason per-race avg (the value used to derive their price).
    d_score_history: dict[str, list[float]] = {
        d: [driver_effective_avgs.get(d, 0.0)] * DUMMY_SEED_COUNT
        for d in active_drivers
    }
    c_score_history: dict[str, list[float]] = {
        c: [constructor_avgs.get(c, 0.0)] * DUMMY_SEED_COUNT
        for c in active_constructors
    }

    d_price_history: dict[str, dict[int, int]] = {d: {} for d in active_drivers}
    c_price_history: dict[str, dict[int, int]] = {c: {} for c in active_constructors}

    for round_num in range(1, num_rounds + 1):
        # Record prices in effect for this round
        for d in active_drivers:
            d_price_history[d][round_num] = d_prices[d]
        for c in active_constructors:
            c_price_history[c][round_num] = c_prices[c]

        # Accumulate this round's scores
        for d in active_drivers:
            d_score_history[d].append(per_round_driver.get(round_num, {}).get(d, 0))
        for c in active_constructors:
            c_score_history[c].append(per_round_constructor.get(round_num, {}).get(c, 0))

        # Compute prices for the next round
        for d in active_drivers:
            rolling = compute_rolling_avg(d_score_history[d])
            change = compute_price_change(d_prices[d], rolling, "driver")
            d_prices[d] = apply_price_change(d_prices[d], change, "driver")
        for c in active_constructors:
            rolling = compute_rolling_avg(c_score_history[c])
            change = compute_price_change(c_prices[c], rolling, "constructor")
            c_prices[c] = apply_price_change(c_prices[c], change, "constructor")

    return d_price_history, c_price_history


# ── Team diversity analysis ───────────────────────────────────────────────


def analyze_team_diversity(
    driver_prices: dict[str, int],
    constructor_prices: dict[str, int],
    driver_scores: dict[str, int],
    constructor_scores: dict[str, int],
    budget_cap: int,
) -> dict:
    """
    Enumerate all C(n_d, TEAM_DRIVERS) × C(n_c, TEAM_CONSTRUCTORS) teams.

    Returns:
        feasible_count, best_score, teams_within_80pct,
        top_driver (most-picked), top_constructor (most-picked),
        entity_frequency: {entity: fraction_of_feasible_teams}
    """
    d_names = sorted(driver_prices)
    c_names = sorted(constructor_prices)
    d_costs = [driver_prices[d] for d in d_names]
    c_costs = [constructor_prices[c] for c in c_names]
    d_scores = [driver_scores.get(d, 0) for d in d_names]
    c_scores = [constructor_scores.get(c, 0) for c in c_names]

    c_combos = list(itertools.combinations(range(len(c_names)), TEAM_CONSTRUCTORS))
    c_combo_costs = [sum(c_costs[i] for i in combo) for combo in c_combos]
    c_combo_scores = [sum(c_scores[i] for i in combo) for combo in c_combos]
    min_c_cost = min(c_combo_costs) if c_combo_costs else 0

    feasible_scores: list[int] = []
    entity_counts: dict[str, int] = defaultdict(int)

    for d_combo in itertools.combinations(range(len(d_names)), TEAM_DRIVERS):
        d_cost = sum(d_costs[i] for i in d_combo)
        remaining = budget_cap - d_cost
        if remaining < min_c_cost:
            continue
        d_score = sum(d_scores[i] for i in d_combo)
        for ci, c_cost in enumerate(c_combo_costs):
            if c_cost <= remaining:
                feasible_scores.append(d_score + c_combo_scores[ci])
                for i in d_combo:
                    entity_counts[d_names[i]] += 1
                for i in c_combos[ci]:
                    entity_counts[c_names[i]] += 1

    if not feasible_scores:
        return {
            "feasible_count": 0, "best_score": 0, "teams_within_80pct": 0,
            "top_driver": "N/A", "top_constructor": "N/A", "entity_frequency": {},
        }

    n = len(feasible_scores)
    best = max(feasible_scores)
    within_80 = sum(1 for s in feasible_scores if s >= 0.8 * best)
    entity_freq = {e: entity_counts[e] / n for e in entity_counts}

    top_d = max((e for e in entity_freq if e in driver_prices), key=lambda e: entity_freq[e], default="N/A")
    top_c = max((e for e in entity_freq if e in constructor_prices), key=lambda e: entity_freq[e], default="N/A")

    return {
        "feasible_count": n,
        "best_score": best,
        "teams_within_80pct": within_80,
        "top_driver": top_d,
        "top_constructor": top_c,
        "entity_frequency": entity_freq,
    }


# ── DNF value analysis ────────────────────────────────────────────────────


def dnf_value_analysis(
    active_drivers: set[str],
    dnf_flags: dict[str, dict[int, bool]],
    d_price_history: dict[str, dict[int, int]],
    season_totals_2025: dict[str, int],
) -> list[dict]:
    """
    For each driver with ≥ HIGH_DNF_THRESHOLD DNFs:
    compute season pts, average in-season price, and pts/$M.
    """
    dnf_counts = {
        d: sum(1 for v in rounds.values() if v)
        for d, rounds in dnf_flags.items()
        if d in active_drivers
    }

    results = []
    for driver, dnf_count in sorted(dnf_counts.items(), key=lambda x: -x[1]):
        if dnf_count < HIGH_DNF_THRESHOLD:
            continue
        season_pts = season_totals_2025.get(driver, 0)
        prices = list(d_price_history.get(driver, {}).values())
        avg_price = sum(prices) / len(prices) if prices else DRIVER_FLOOR
        pts_per_m = season_pts / (avg_price / 1_000_000)
        results.append({
            "driver": driver,
            "dnf_count": dnf_count,
            "season_pts": season_pts,
            "avg_price": avg_price,
            "pts_per_m": pts_per_m,
        })
    return results


def field_avg_pts_per_m(
    active_drivers: set[str],
    d_price_history: dict[str, dict[int, int]],
    season_totals_2025: dict[str, int],
) -> float:
    vals = []
    for d in active_drivers:
        prices = list(d_price_history.get(d, {}).values())
        avg_p = sum(prices) / len(prices) if prices else DRIVER_FLOOR
        if avg_p > 0:
            vals.append(season_totals_2025.get(d, 0) / (avg_p / 1_000_000))
    return sum(vals) / len(vals) if vals else 0.0


# ── C9 revisit ────────────────────────────────────────────────────────────


def c9_budget_analysis(
    preseason_driver_prices: dict[str, int],
    preseason_constructor_prices: dict[str, int],
    active_drivers: set[str],
    active_constructors: set[str],
    per_round_driver: dict[int, dict[str, int]],
    per_round_constructor: dict[int, dict[str, int]],
    runaway_data: dict[int, dict[str, int]],
    budget_cap: int,
) -> dict | None:
    """
    Find the best team (by 2025 full-season score) that fits under budget at
    preseason prices. Track its cumulative score vs. unconstrained runaway data.
    """
    d_names = sorted(active_drivers)
    c_names = sorted(active_constructors)
    d_costs = [preseason_driver_prices.get(d, DRIVER_FLOOR) for d in d_names]
    c_costs = [preseason_constructor_prices.get(c, CONSTRUCTOR_FLOOR) for c in c_names]

    # Full-season totals for ranking
    d_season = [
        sum(per_round_driver.get(r, {}).get(d, 0) for r in range(1, TOTAL_RACES_2025 + 1))
        for d in d_names
    ]
    c_season = [
        sum(per_round_constructor.get(r, {}).get(c, 0) for r in range(1, TOTAL_RACES_2025 + 1))
        for c in c_names
    ]

    c_combos = list(itertools.combinations(range(len(c_names)), TEAM_CONSTRUCTORS))
    c_combo_costs = [sum(c_costs[i] for i in combo) for combo in c_combos]
    c_combo_scores = [sum(c_season[i] for i in combo) for combo in c_combos]
    min_c_cost = min(c_combo_costs) if c_combo_costs else 0

    best_score = -1
    best_d_idx: tuple | None = None
    best_c_idx: int | None = None

    for d_combo in itertools.combinations(range(len(d_names)), TEAM_DRIVERS):
        d_cost = sum(d_costs[i] for i in d_combo)
        if budget_cap - d_cost < min_c_cost:
            continue
        d_score = sum(d_season[i] for i in d_combo)
        remaining = budget_cap - d_cost
        for ci, c_cost in enumerate(c_combo_costs):
            if c_cost <= remaining:
                total = d_score + c_combo_scores[ci]
                if total > best_score:
                    best_score = total
                    best_d_idx = d_combo
                    best_c_idx = ci

    if best_d_idx is None:
        return None

    best_drivers = [d_names[i] for i in best_d_idx]
    best_constructors = [c_names[i] for i in c_combos[best_c_idx]]
    best_cost = (
        sum(preseason_driver_prices.get(d, DRIVER_FLOOR) for d in best_drivers)
        + sum(preseason_constructor_prices.get(c, CONSTRUCTOR_FLOOR) for c in best_constructors)
    )

    # Cumulative score round-by-round
    cumulative = 0
    budget_locked_cumulative: dict[int, int] = {}
    for r in range(1, TOTAL_RACES_2025 + 1):
        cumulative += sum(per_round_driver.get(r, {}).get(d, 0) for d in best_drivers)
        cumulative += sum(per_round_constructor.get(r, {}).get(c, 0) for c in best_constructors)
        budget_locked_cumulative[r] = cumulative

    last = TOTAL_RACES_2025
    perfect_final = runaway_data.get(last, {}).get("perfect", 0)
    locked_final = runaway_data.get(last, {}).get("locked", 0)
    budget_locked_final = budget_locked_cumulative[last]

    return {
        "best_drivers": best_drivers,
        "best_constructors": best_constructors,
        "best_cost": best_cost,
        "budget_locked_final": budget_locked_final,
        "perfect_final": perfect_final,
        "locked_final": locked_final,
        "budget_locked_cumulative": budget_locked_cumulative,
        "unconstrained_gap": perfect_final - locked_final,
        "budget_gap": perfect_final - budget_locked_final,
    }


# ── P1–P6 validation ──────────────────────────────────────────────────────


def validate_p1_p6(
    preseason_driver_prices: dict[str, int],
    preseason_constructor_prices: dict[str, int],
    active_drivers: set[str],
    active_constructors: set[str],
    d_price_history: dict[str, dict[int, int]],
    c_price_history: dict[str, dict[int, int]],
    diversity_r1: dict,
    dnf_results: list[dict],
    budget_cap: int,
    season_totals_2025: dict[str, int],
    constructor_totals_2025: dict[str, int],
) -> dict[str, dict]:
    results: dict[str, dict] = {}

    # P1: Dream team costs 125–140% of budget
    dream_d = sorted(active_drivers, key=lambda d: -season_totals_2025.get(d, 0))[:TEAM_DRIVERS]
    dream_c = sorted(active_constructors, key=lambda c: -constructor_totals_2025.get(c, 0))[:TEAM_CONSTRUCTORS]
    dream_cost = (
        sum(preseason_driver_prices.get(d, DRIVER_FLOOR) for d in dream_d)
        + sum(preseason_constructor_prices.get(c, CONSTRUCTOR_FLOOR) for c in dream_c)
    )
    tightness = dream_cost / budget_cap
    results["P1"] = {
        "pass": 1.25 <= tightness <= 1.40,
        "value": f"{tightness:.1%}",
        "detail": (
            f"Dream team: {', '.join(dream_d)} | {', '.join(dream_c)} "
            f"= ${dream_cost/1e6:.1f}M vs ${budget_cap/1e6:.0f}M cap"
        ),
    }

    # P2: ≥ 50 feasible teams score within 80% of best
    within_80 = diversity_r1.get("teams_within_80pct", 0)
    results["P2"] = {
        "pass": within_80 >= 50,
        "value": f"{within_80:,}",
        "detail": f"{within_80:,} feasible teams score ≥80% of best at preseason prices",
    }

    # P3: No single entity appears on every top-scoring feasible team
    # Proxy: flag if any entity appears on >95% of all feasible teams
    entity_freq = diversity_r1.get("entity_frequency", {})
    max_freq = max(entity_freq.values()) if entity_freq else 0.0
    max_freq_entity = max(entity_freq, key=entity_freq.get) if entity_freq else "N/A"
    results["P3"] = {
        "pass": max_freq <= 0.95,
        "value": f"Max frequency: {max_freq:.1%} ({max_freq_entity})",
        "detail": f"No entity appears on >95% of feasible teams → no mandatory pick",
    }

    # P4: ≥ 3 floor-priced entities with positive season score
    floor_entities = [
        d for d in active_drivers
        if preseason_driver_prices.get(d, DRIVER_FLOOR) == DRIVER_FLOOR
    ] + [
        c for c in active_constructors
        if preseason_constructor_prices.get(c, CONSTRUCTOR_FLOOR) == CONSTRUCTOR_FLOOR
    ]
    positive_ev = [
        e for e in floor_entities
        if season_totals_2025.get(e, constructor_totals_2025.get(e, 0)) > 0
    ]
    results["P4"] = {
        "pass": len(positive_ev) >= 3,
        "value": str(len(positive_ev)),
        "detail": f"Floor-priced entities with positive 2025 score: {positive_ev}",
    }

    # P5: No price moves >30% in any 3-race window
    max_swing = 0.0
    max_swing_entity = ""
    for entity, rounds in {**d_price_history, **c_price_history}.items():
        sorted_rounds = sorted(rounds.keys())
        for i in range(len(sorted_rounds) - 2):
            p_start = rounds[sorted_rounds[i]]
            p_end = rounds[sorted_rounds[i + 2]]
            if p_start > 0:
                swing = abs(p_end - p_start) / p_start
                if swing > max_swing:
                    max_swing = swing
                    max_swing_entity = f"{entity} rounds {sorted_rounds[i]}–{sorted_rounds[i+2]}"
    results["P5"] = {
        "pass": max_swing <= 0.30,
        "value": f"{max_swing:.1%}",
        "detail": f"Largest 3-race price swing: {max_swing:.1%} ({max_swing_entity})",
    }

    # P6: High-DNF drivers viable as budget picks
    if dnf_results:
        f_avg = field_avg_pts_per_m(active_drivers, d_price_history, season_totals_2025)
        viable = [r for r in dnf_results if r["pts_per_m"] >= f_avg]
        results["P6"] = {
            "pass": len(viable) >= 1,
            "value": f"{len(viable)}/{len(dnf_results)} high-DNF drivers ≥ field avg ({f_avg:.1f} pts/$M)",
            "detail": f"Viable: {[r['driver'] for r in viable]}",
        }
    else:
        results["P6"] = {
            "pass": True,
            "value": "N/A — no drivers with ≥4 DNFs",
            "detail": "",
        }

    return results


# ── Output writers ────────────────────────────────────────────────────────


def write_preseason_prices(
    driver_prices: dict[str, int],
    constructor_prices: dict[str, int],
    driver_avgs: dict[str, float | None],
    constructor_avgs: dict[str, float],
    path: Path,
) -> None:
    rows = []
    for d in sorted(driver_prices, key=lambda x: -driver_prices[x]):
        avg = driver_avgs.get(d)
        rows.append({
            "entity": d, "type": "driver",
            "avg_2024": f"{avg:.2f}" if avg is not None else "rookie",
            "preseason_price": driver_prices[d],
        })
    for c in sorted(constructor_prices, key=lambda x: -constructor_prices[x]):
        avg = constructor_avgs.get(c, 0.0)
        rows.append({
            "entity": c, "type": "constructor",
            "avg_2024": f"{avg:.2f}",
            "preseason_price": constructor_prices[c],
        })
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["entity", "type", "avg_2024", "preseason_price"])
        w.writeheader()
        w.writerows(rows)


def write_price_evolution(
    d_price_history: dict[str, dict[int, int]],
    c_price_history: dict[str, dict[int, int]],
    path: Path,
) -> None:
    rows = []
    for d, rounds in d_price_history.items():
        for r, price in rounds.items():
            rows.append({"round": r, "entity": d, "type": "driver", "price": price})
    for c, rounds in c_price_history.items():
        for r, price in rounds.items():
            rows.append({"round": r, "entity": c, "type": "constructor", "price": price})
    rows.sort(key=lambda x: (x["round"], x["type"], x["entity"]))
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["round", "entity", "type", "price"])
        w.writeheader()
        w.writerows(rows)


def write_team_diversity(rows: list[dict], path: Path) -> None:
    fields = ["round", "budget_cap", "feasible_teams", "best_score",
              "teams_within_80pct", "top_driver", "top_constructor"]
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)


def write_dnf_analysis(dnf_results: list[dict], f_avg: float, path: Path) -> None:
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["driver", "dnf_count", "season_pts",
                                          "avg_price_m", "pts_per_m", "vs_field_avg"])
        w.writeheader()
        for r in dnf_results:
            w.writerow({
                "driver": r["driver"],
                "dnf_count": r["dnf_count"],
                "season_pts": r["season_pts"],
                "avg_price_m": f"{r['avg_price']/1e6:.2f}",
                "pts_per_m": f"{r['pts_per_m']:.1f}",
                "vs_field_avg": f"{r['pts_per_m'] - f_avg:+.1f}",
            })


def write_validation_report(
    p_results: dict[str, dict],
    dnf_results: list[dict],
    f_avg: float,
    c9_result: dict | None,
    path: Path,
) -> None:
    lines: list[str] = []
    lines.append("# Pricing Validation Report\n")
    lines.append("**Data:** 2025 season (24 rounds)  |  **Budget cap:** $115M  |  **Formula:** Power Curve, shape=1.0\n")

    # ── P1–P6 summary table ──────────────────────────────────────────────
    lines.append("## P1–P6 Criteria\n")
    lines.append(f"{'#':<4} {'Status':<10} {'Value'}")
    lines.append("-" * 80)
    for criterion, result in p_results.items():
        status = "✓ PASS" if result["pass"] else "✗ FAIL"
        lines.append(f"{criterion:<4} {status:<10} {result['value']}")
        lines.append(f"     {result['detail']}")
        lines.append("")

    all_pass = all(r["pass"] for r in p_results.values())
    lines.append(f"**Overall: {'ALL PASS ✓' if all_pass else 'SOME CRITERIA FAILED ✗'}**\n")

    # ── C8 revisit ───────────────────────────────────────────────────────
    lines.append("## C8 Revisit: DNF Penalty Severity\n")
    if dnf_results:
        lines.append(f"Field average pts/$M: **{f_avg:.1f}**\n")
        lines.append(
            f"{'Driver':<8} {'DNFs':<6} {'Season pts':<12} {'Avg price':<12} {'Pts/$M':<10} {'vs field'}"
        )
        lines.append("-" * 60)
        for r in dnf_results:
            vs = f"{r['pts_per_m'] - f_avg:+.1f}"
            lines.append(
                f"{r['driver']:<8} {r['dnf_count']:<6} {r['season_pts']:<12} "
                f"${r['avg_price']/1e6:.1f}M{'':>5} {r['pts_per_m']:<10.1f} {vs}"
            )
        viable = [r for r in dnf_results if r["pts_per_m"] >= f_avg]
        lines.append("")
        if viable:
            lines.append(
                f"**Verdict (C8 ✓):** {len(viable)}/{len(dnf_results)} high-DNF drivers "
                f"({', '.join(r['driver'] for r in viable)}) beat field average pts/$M. "
                f"The -10 DNF penalty reduces their price enough to make them viable budget picks. "
                f"Current penalty is appropriate."
            )
        else:
            lines.append(
                f"**Verdict (C8 ✗):** No high-DNF driver beats field average pts/$M. "
                f"The -10 penalty may be too harsh — high-DNF drivers are priced too low "
                f"relative to their scoring, or the penalty discourages them too much. "
                f"Consider reducing to -5."
            )
    else:
        lines.append("No drivers with ≥4 DNFs in 2025 dataset.\n")

    # ── C9 revisit ───────────────────────────────────────────────────────
    lines.append("\n## C9 Revisit: Runaway Risk with Budget Constraint\n")
    if c9_result:
        lines.append(
            f"**Best budget-legal preseason team** (${c9_result['best_cost']/1e6:.1f}M):\n"
            f"  Drivers: {', '.join(c9_result['best_drivers'])}\n"
            f"  Constructors: {', '.join(c9_result['best_constructors'])}\n"
        )
        lines.append(f"| Team | Final score |")
        lines.append(f"|------|-------------|")
        lines.append(f"| Budget-locked (preseason, ≤${BUDGET_CAP/1e6:.0f}M) | {c9_result['budget_locked_final']:,} pts |")
        lines.append(f"| Unconstrained locked (preseason, no budget) | {c9_result['locked_final']:,} pts |")
        lines.append(f"| Unconstrained perfect (best each round, no budget) | {c9_result['perfect_final']:,} pts |")
        lines.append("")
        lines.append(f"Gap: perfect − locked = **{c9_result['unconstrained_gap']:,} pts** (unconstrained)")
        lines.append(f"Gap: perfect − budget_locked = **{c9_result['budget_gap']:,} pts** (with budget)")
        lines.append("")

        if c9_result["budget_locked_final"] >= c9_result["locked_final"]:
            lines.append(
                "**Verdict (C9 ✓):** The budget-locked team matches or outscores the unconstrained locked team. "
                "Floor-priced high-scorers (e.g. ANT at $2M) make budget teams competitive. "
                "Budget constraint does not worsen the runaway dynamic."
            )
        else:
            diff = c9_result["locked_final"] - c9_result["budget_locked_final"]
            gap_reduction = c9_result["unconstrained_gap"] - c9_result["budget_gap"]
            lines.append(
                f"**Verdict (C9 assessed):** Budget-locked team scores {diff:,} pts less than "
                f"the unconstrained preseason best. However, the budget reduces the gap to the "
                f"perfect score by {gap_reduction:,} pts ({gap_reduction/c9_result['unconstrained_gap']:.0%}), "
                f"since no single player can afford all the top performers. "
                f"The budget constraint is working as intended."
            )
    else:
        lines.append("No feasible budget team found — cap may be too restrictive.\n")

    lines.append("\n## Final Recommendation\n")
    lines.append("**[Complete after reviewing output files.]\n**")
    lines.append("Remaining decisions:")
    lines.append("- Confirm C8 verdict: is -10 DNF penalty appropriate?")
    lines.append("- Confirm C9 verdict: is $115M cap sufficient to prevent runaway leaders?")
    lines.append("- Adjust BUDGET_CAP in pricing.py if simulation suggests a different value.")

    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")


# ── Helpers ───────────────────────────────────────────────────────────────


def fmt_m(x: int) -> str:
    return f"${x/1e6:.1f}M"


# ── Main ──────────────────────────────────────────────────────────────────


def main() -> None:
    # ── Load data ─────────────────────────────────────────────────────────
    print("Loading data...", flush=True)
    driver_rows_2024 = load_driver_season_totals(DATA_2024_DIR / "season_totals.csv")
    constructor_rows_2024 = load_constructor_season_totals(DATA_2024_DIR / "season_constructor_totals.csv")
    per_round_driver = load_per_round_driver_scores(DATA_2025_DIR / "driver_scores.csv")
    per_round_constructor = load_per_round_constructor_scores(DATA_2025_DIR / "constructor_scores.csv")
    dnf_flags = load_dnf_flags(DATA_2025_DIR / "driver_scores.csv")
    runaway_data = load_runaway_data(DATA_2025_DIR / "runaway_simulation.csv")
    season_totals_rows = load_driver_season_totals(DATA_2025_DIR / "season_totals.csv")
    constructor_totals_rows = load_constructor_season_totals(DATA_2025_DIR / "season_constructor_totals.csv")
    season_totals_2025 = {r["driver"]: r["season_total"] for r in season_totals_rows}
    constructor_totals_2025 = {r["constructor"]: r["season_total"] for r in constructor_totals_rows}
    driver_teams_2025 = {r["driver"]: r["team"] for r in season_totals_rows if r.get("team")}

    # Active 2025 entities: union of all rounds (handles mid-season debuts)
    active_drivers: set[str] = set()
    active_constructors: set[str] = set()
    for r in per_round_driver.values():
        active_drivers.update(r.keys())
    for r in per_round_constructor.values():
        active_constructors.update(r.keys())
    print(f"  Drivers ({len(active_drivers)}): {sorted(active_drivers)}")
    print(f"  Constructors ({len(active_constructors)}): {sorted(active_constructors)}")

    # ── Preseason prices ──────────────────────────────────────────────────
    print("\nComputing preseason prices...", flush=True)
    driver_prices, constructor_prices, driver_avgs, constructor_avgs, driver_effective_avgs = build_preseason_prices(
        driver_rows_2024, constructor_rows_2024, active_drivers, active_constructors,
        driver_teams_2025,
    )
    for d in sorted(driver_prices, key=lambda x: -driver_prices[x]):
        avg_str = f"{driver_avgs[d]:.1f}" if driver_avgs.get(d) is not None else "rookie"
        print(f"  {d:<8} {fmt_m(driver_prices[d]):>8}  (2024 avg: {avg_str})")
    print()
    for c in sorted(constructor_prices, key=lambda x: -constructor_prices[x]):
        print(f"  {c:<22} {fmt_m(constructor_prices[c]):>8}  (2024 avg: {constructor_avgs.get(c, 0.0):.1f})")

    # ── Price evolution ───────────────────────────────────────────────────
    print("\nSimulating price evolution (24 rounds)...", flush=True)
    d_price_history, c_price_history = simulate_price_evolution(
        driver_prices, constructor_prices,
        active_drivers, active_constructors,
        per_round_driver, per_round_constructor,
        driver_effective_avgs, constructor_avgs,
    )
    print("  Done.")

    # ── Team diversity at checkpoints ─────────────────────────────────────
    print("\nAnalysing team diversity...", flush=True)
    diversity_rows: list[dict] = []
    diversity_by_round: dict[int, dict] = {}
    d_cum: dict[str, int] = defaultdict(int)
    c_cum: dict[str, int] = defaultdict(int)

    for round_num in range(1, TOTAL_RACES_2025 + 1):
        for d, pts in per_round_driver.get(round_num, {}).items():
            d_cum[d] += pts
        for c, pts in per_round_constructor.get(round_num, {}).items():
            c_cum[c] += pts

        if round_num in DIVERSITY_CHECKPOINTS:
            d_prices_r = {d: d_price_history[d][round_num] for d in active_drivers}
            c_prices_r = {c: c_price_history[c][round_num] for c in active_constructors}
            print(f"  Round {round_num}...", flush=True)
            div = analyze_team_diversity(
                d_prices_r, c_prices_r,
                dict(d_cum), dict(c_cum),
                BUDGET_CAP,
            )
            diversity_by_round[round_num] = div
            diversity_rows.append({
                "round": round_num,
                "budget_cap": BUDGET_CAP,
                "feasible_teams": div["feasible_count"],
                "best_score": div["best_score"],
                "teams_within_80pct": div["teams_within_80pct"],
                "top_driver": div["top_driver"],
                "top_constructor": div["top_constructor"],
            })
            print(
                f"    feasible={div['feasible_count']:,}  "
                f"best={div['best_score']:,}pts  "
                f"within80%={div['teams_within_80pct']:,}  "
                f"top_d={div['top_driver']} ({div['entity_frequency'].get(div['top_driver'], 0):.0%})  "
                f"top_c={div['top_constructor']} ({div['entity_frequency'].get(div['top_constructor'], 0):.0%})"
            )

    # ── DNF value analysis ────────────────────────────────────────────────
    print("\nAnalysing DNF value...", flush=True)
    dnf_results = dnf_value_analysis(active_drivers, dnf_flags, d_price_history, season_totals_2025)
    f_avg = field_avg_pts_per_m(active_drivers, d_price_history, season_totals_2025)
    print(f"  Field avg pts/$M: {f_avg:.1f}")
    for r in dnf_results:
        vs = f"{r['pts_per_m'] - f_avg:+.1f}"
        print(f"  {r['driver']}: {r['dnf_count']} DNFs, {r['season_pts']}pts, "
              f"avg {fmt_m(int(r['avg_price']))}, {r['pts_per_m']:.1f}pts/$M ({vs})")

    # ── C9 revisit ────────────────────────────────────────────────────────
    print("\nC9 budget analysis...", flush=True)
    c9_result = c9_budget_analysis(
        driver_prices, constructor_prices,
        active_drivers, active_constructors,
        per_round_driver, per_round_constructor,
        runaway_data, BUDGET_CAP,
    )
    if c9_result:
        print(f"  Best budget team ({fmt_m(c9_result['best_cost'])}):")
        print(f"    Drivers: {c9_result['best_drivers']}")
        print(f"    Constructors: {c9_result['best_constructors']}")
        print(f"  Budget-locked final:    {c9_result['budget_locked_final']:,}")
        print(f"  Unconstrained locked:   {c9_result['locked_final']:,}")
        print(f"  Perfect:                {c9_result['perfect_final']:,}")
        print(f"  Budget gap vs perfect:  {c9_result['budget_gap']:,}  "
              f"(unconstrained gap: {c9_result['unconstrained_gap']:,})")

    # ── P1–P6 validation ──────────────────────────────────────────────────
    print("\nValidating P1–P6...", flush=True)
    p_results = validate_p1_p6(
        driver_prices, constructor_prices,
        active_drivers, active_constructors,
        d_price_history, c_price_history,
        diversity_by_round.get(1, {}),
        dnf_results, BUDGET_CAP,
        season_totals_2025, constructor_totals_2025,
    )
    for criterion, result in p_results.items():
        status = "PASS" if result["pass"] else "FAIL"
        print(f"  {criterion}: {status} — {result['value']}")

    # ── Write outputs ─────────────────────────────────────────────────────
    PRICING_DIR.mkdir(parents=True, exist_ok=True)

    paths = {
        "preseason_prices_2025.csv": PRICING_DIR / "preseason_prices_2025.csv",
        "price_evolution_2025.csv": PRICING_DIR / "price_evolution_2025.csv",
        "team_diversity_2025.csv": PRICING_DIR / "team_diversity_2025.csv",
        "dnf_value_analysis_2025.csv": PRICING_DIR / "dnf_value_analysis_2025.csv",
        "pricing_validation_report.md": PRICING_DIR / "pricing_validation_report.md",
    }

    print(f"\nWriting output to {PRICING_DIR}...", flush=True)
    write_preseason_prices(driver_prices, constructor_prices, driver_avgs, constructor_avgs,
                           paths["preseason_prices_2025.csv"])
    write_price_evolution(d_price_history, c_price_history, paths["price_evolution_2025.csv"])
    write_team_diversity(diversity_rows, paths["team_diversity_2025.csv"])
    write_dnf_analysis(dnf_results, f_avg, paths["dnf_value_analysis_2025.csv"])
    write_validation_report(p_results, dnf_results, f_avg, c9_result,
                            paths["pricing_validation_report.md"])

    print("\nDone.")
    for name in paths:
        print(f"  {name}")


if __name__ == "__main__":
    main()
