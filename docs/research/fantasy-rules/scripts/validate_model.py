"""
validate_model.py — End-to-end validation of the complete pricing model.

Replays the 2025 season using:
  - 2025 preseason prices (from reference/2025-preseason-prices.csv)
  - 2025 per-race scoring (from output/2025/)
  - PPM in-season pricing (from decisions/pricing.md)

Evaluates results against design goals (decisions/design-goals.md).

Usage:
    cd docs/research/fantasy-rules/scripts
    source .venv/bin/activate
    python validate_model.py
"""

import csv
import os
from collections import defaultdict
from itertools import combinations

# ── PPM Parameters (from decisions/pricing.md) ─────────────────────────

NEUTRAL_PPM = 1.0
BAND_WIDTH = 0.80  # ±0.80 around neutral
WINDOW_SIZE = 3
DUMMY_RACES = 2  # seeded at neutral PPM
PRICE_FLOOR = 4.5  # $M
A_TIER_THRESHOLD = 22.0  # $M

# Step sizes: {tier: {band: step}}
STEPS = {
    "A": {"great": 0.3, "good": 0.1, "poor": -0.1, "terrible": -0.3},
    "B": {"great": 0.6, "good": 0.2, "poor": -0.2, "terrible": -0.6},
}

BUDGET_CAP = 100.0
N_DRIVERS = 5
N_CONSTRUCTORS = 2

# Constructor abbreviation → full name mapping (2025 season)
CONSTRUCTOR_ABBR_TO_NAME = {
    "MCL": "McLaren",
    "FER": "Ferrari",
    "RED": "Red Bull Racing",
    "MER": "Mercedes",
    "WIL": "Williams",
    "ALP": "Alpine",
    "AST": "Aston Martin",
    "VRB": "Racing Bulls",
    "HAA": "Haas F1 Team",
    "KCK": "Kick Sauber",
}
CONSTRUCTOR_NAME_TO_ABBR = {v: k for k, v in CONSTRUCTOR_ABBR_TO_NAME.items()}

# Mid-season driver replacements: {new_driver: (replaced_driver, first_round)}
REPLACEMENTS = {"COL": ("DOO", 7)}

# Mid-season team changes: driver swaps between teams with official price resets.
# {round: [(driver, new_price), ...]}
TEAM_CHANGES = {
    3: [("LAW", 8.4), ("TSU", 16.8)],
}


# ── Data loading ────────────────────────────────────────────────────────


def load_preseason_prices(path: str) -> tuple[dict[str, float], dict[str, float]]:
    """Load preseason prices. Returns (driver_prices, constructor_prices)."""
    drivers = {}
    constructors = {}
    with open(path) as f:
        for row in csv.DictReader(f):
            price = float(row["price_millions"])
            if row["type"] == "driver":
                drivers[row["abbreviation"]] = price
            else:
                constructors[row["abbreviation"]] = price
    return drivers, constructors


def load_per_race_scores(
    driver_path: str, constructor_path: str
) -> tuple[dict[int, dict[str, float]], dict[int, dict[str, float]]]:
    """Load per-race scores. Returns (driver_scores, constructor_scores).
    Each is {round_num: {entity_abbr: total_pts}}.
    """
    driver_scores: dict[int, dict[str, float]] = defaultdict(dict)
    with open(driver_path) as f:
        for row in csv.DictReader(f):
            rnd = int(row["round"])
            driver_scores[rnd][row["driver"]] = float(row["total_pts"])

    constructor_scores: dict[int, dict[str, float]] = defaultdict(dict)
    with open(constructor_path) as f:
        for row in csv.DictReader(f):
            rnd = int(row["round"])
            abbr = CONSTRUCTOR_NAME_TO_ABBR.get(row["constructor"], row["constructor"])
            constructor_scores[rnd][abbr] = float(row["total_pts"])

    return driver_scores, constructor_scores


# ── PPM Engine ──────────────────────────────────────────────────────────


def classify_band(avg_ppm: float) -> str:
    if avg_ppm > NEUTRAL_PPM + BAND_WIDTH:
        return "great"
    elif avg_ppm >= NEUTRAL_PPM:
        return "good"
    elif avg_ppm >= NEUTRAL_PPM - BAND_WIDTH:
        return "poor"
    else:
        return "terrible"


def get_tier(price: float) -> str:
    return "A" if price >= A_TIER_THRESHOLD else "B"


def price_step(price: float, avg_ppm: float) -> float:
    band = classify_band(avg_ppm)
    tier = get_tier(price)
    return STEPS[tier][band]


def _active_driver(driver: str, rnd: int) -> str | None:
    """Return which driver holds a seat at a given round.

    For replaced drivers (e.g. DOO replaced by COL at R7):
      - DOO is active R1-R6, returns DOO
      - DOO is inactive R7+, returns None
      - COL is inactive R1-R6, returns None
      - COL is active R7+, returns COL
    """
    # Is this driver the "old" one who got replaced?
    for new, (old, start_rnd) in REPLACEMENTS.items():
        if driver == old:
            return driver if rnd < start_rnd else None
        if driver == new:
            return driver if rnd >= start_rnd else None
    return driver


def run_ppm_simulation(
    preseason_prices: dict[str, float],
    per_race_scores: dict[int, dict[str, float]],
    entity_type: str,
) -> dict[str, list[dict]]:
    """
    Simulate PPM pricing through the season.

    Returns {entity: [{"round": r, "price_before": p, "points": pts,
                        "ppm": ppm, "avg_ppm": avg, "band": b, "step": s,
                        "price_after": pa}, ...]}
    """
    rounds = sorted(per_race_scores.keys())

    # Current prices — start from preseason
    prices = dict(preseason_prices)

    # For replacement drivers, they inherit the replaced driver's price at entry
    if entity_type == "driver":
        for new, (old, start_rnd) in REPLACEMENTS.items():
            if new not in prices:
                # Price will be inherited when the replacement first races;
                # placeholder so they appear in the entity set
                prices[new] = None

    # PPM history per entity (seeded with dummy races at neutral)
    ppm_history: dict[str, list[float]] = {
        entity: [NEUTRAL_PPM] * DUMMY_RACES for entity in prices
    }

    results: dict[str, list[dict]] = defaultdict(list)

    for rnd in rounds:
        race_scores = per_race_scores[rnd]

        # Apply mid-season team changes (price resets + fresh PPM window)
        if entity_type == "driver" and rnd in TEAM_CHANGES:
            for driver, new_price in TEAM_CHANGES[rnd]:
                if driver in prices:
                    prices[driver] = new_price
                    ppm_history[driver] = [NEUTRAL_PPM] * DUMMY_RACES

        for entity in list(prices.keys()):
            # For drivers, check if this entity is active this round
            if entity_type == "driver":
                active = _active_driver(entity, rnd)
                if active is None:
                    continue

                # Replacement driver entering: inherit predecessor's price
                if prices[entity] is None:
                    for new, (old, start_rnd) in REPLACEMENTS.items():
                        if entity == new and rnd >= start_rnd:
                            prices[entity] = prices.get(old, PRICE_FLOOR)
                            # Fresh PPM window for new driver
                            ppm_history[entity] = [NEUTRAL_PPM] * DUMMY_RACES
                            break
                    if prices[entity] is None:
                        continue

            price_before = prices[entity]
            points = race_scores.get(entity, 0.0)

            # Compute PPM for this race (floored at 0 — negative scores
            # produce 0 PPM to prevent extreme negatives from poisoning
            # the rolling window at low prices)
            race_ppm = max(0.0, points / price_before) if price_before > 0 else 0.0

            ppm_history[entity].append(race_ppm)

            # Rolling window average
            window = ppm_history[entity][-WINDOW_SIZE:]
            avg_ppm = sum(window) / len(window)

            band = classify_band(avg_ppm)
            step = price_step(price_before, avg_ppm)
            price_after = max(PRICE_FLOOR, round(price_before + step, 1))

            results[entity].append({
                "round": rnd,
                "price_before": price_before,
                "points": points,
                "ppm": round(race_ppm, 4),
                "avg_ppm": round(avg_ppm, 4),
                "band": band,
                "step": step,
                "price_after": price_after,
            })

            prices[entity] = price_after

    return dict(results)


# ── Price helpers ───────────────────────────────────────────────────────


def prices_at_round(results: dict, rnd: int) -> dict[str, float]:
    """Get each entity's price at the START of a given round."""
    prices = {}
    for entity, rnds in results.items():
        for r in rnds:
            if r["round"] == rnd:
                prices[entity] = r["price_before"]
                break
        else:
            # Entity may not be active yet or round not found
            for r in reversed(rnds):
                if r["round"] <= rnd:
                    prices[entity] = r["price_after"]
                    break
    return prices


def end_of_season_prices(results: dict) -> dict[str, float]:
    """Get each entity's price AFTER the last round."""
    return {
        entity: rnds[-1]["price_after"]
        for entity, rnds in results.items()
        if rnds
    }


# ── Evaluation ──────────────────────────────────────────────────────────


def eval_price_trajectories(
    driver_results: dict, constructor_results: dict
) -> dict:
    """Evaluate price behavior across the season."""
    all_results = {}
    for entity, rounds in driver_results.items():
        all_results[("driver", entity)] = rounds
    for entity, rounds in constructor_results.items():
        all_results[("constructor", entity)] = rounds

    # Build set of entities with team changes for effective-start lookup
    team_change_prices = {}
    for rnd, changes in TEAM_CHANGES.items():
        for driver, new_price in changes:
            team_change_prices[driver] = new_price

    # Replaced drivers don't finish the season — exclude from end-of-season metrics
    replaced_drivers = {old for new, (old, _) in REPLACEMENTS.items()}

    trajectories = []
    for (etype, entity), rounds in all_results.items():
        # For drivers with mid-season team changes, use the reset price
        # as the effective start — the preseason price belonged to a
        # different team context and the admin reset isn't PPM-driven.
        if etype == "driver" and entity in team_change_prices:
            start = team_change_prices[entity]
        else:
            start = rounds[0]["price_before"]
        end = rounds[-1]["price_after"]
        all_prices = [r["price_before"] for r in rounds] + [rounds[-1]["price_after"]]
        active_at_end = not (etype == "driver" and entity in replaced_drivers)
        trajectories.append({
            "type": etype,
            "entity": entity,
            "start": start,
            "end": end,
            "change": round(end - start, 1),
            "change_pct": round((end - start) / start * 100, 1),
            "min": min(all_prices),
            "max": max(all_prices),
            "at_floor": end <= PRICE_FLOOR and active_at_end,
            "active_at_end": active_at_end,
        })

    return {
        "trajectories": sorted(
            trajectories, key=lambda x: abs(x["change"]), reverse=True
        ),
    }


def eval_floor_compression(trajectories: list[dict]) -> dict:
    """Check how many entities end at the floor."""
    at_floor = [t for t in trajectories if t["at_floor"]]
    return {
        "total_at_floor": len(at_floor),
        "drivers_at_floor": [t["entity"] for t in at_floor if t["type"] == "driver"],
        "constructors_at_floor": [t["entity"] for t in at_floor if t["type"] == "constructor"],
    }


def eval_team_evolution(
    driver_results: dict,
    constructor_results: dict,
    driver_scores: dict[int, dict[str, float]],
    constructor_scores: dict[int, dict[str, float]],
) -> dict:
    """
    Check whether the optimal team changes across the season.

    At each checkpoint, find the best-value team using scoring data available
    up to that point and current prices. Compare rosters across checkpoints.
    """
    checkpoints = [1, 6, 12, 18, 24]

    def avg_scoring_up_to(
        per_race: dict[int, dict[str, float]], rnd: int
    ) -> dict[str, float]:
        totals: dict[str, float] = defaultdict(float)
        counts: dict[str, int] = defaultdict(int)
        for r in sorted(per_race.keys()):
            if r > rnd:
                break
            for entity, pts in per_race[r].items():
                totals[entity] += pts
                counts[entity] += 1
        return {e: totals[e] / counts[e] for e in totals if counts[e] > 0}

    def find_best_team(d_prices, c_prices, d_avg, c_avg):
        """Find team with highest total avg points under budget."""
        best = None
        best_pts = -999

        avail_d = [d for d in d_prices if d in d_avg]
        avail_c = [c for c in c_prices if c in c_avg]

        for d_combo in combinations(avail_d, N_DRIVERS):
            d_cost = sum(d_prices[d] for d in d_combo)
            if d_cost > BUDGET_CAP:
                continue
            d_pts = sum(d_avg[d] for d in d_combo)
            remaining = BUDGET_CAP - d_cost

            for c_combo in combinations(avail_c, N_CONSTRUCTORS):
                c_cost = sum(c_prices[c] for c in c_combo)
                if c_cost > remaining:
                    continue
                total_pts = d_pts + sum(c_avg[c] for c in c_combo)
                if total_pts > best_pts:
                    best_pts = total_pts
                    best = (list(d_combo), list(c_combo), d_cost + c_cost, total_pts)

        return best

    snapshots = []
    for rnd in checkpoints:
        d_prices = prices_at_round(driver_results, rnd)
        c_prices = prices_at_round(constructor_results, rnd)
        d_avg = avg_scoring_up_to(driver_scores, rnd)
        c_avg = avg_scoring_up_to(constructor_scores, rnd)

        team = find_best_team(d_prices, c_prices, d_avg, c_avg)
        if team:
            drivers, constructors, cost, pts = team
            snapshots.append({
                "round": rnd,
                "drivers": sorted(drivers),
                "constructors": sorted(constructors),
                "cost": round(cost, 1),
                "expected_pts": round(pts, 1),
            })

    # Count roster changes between consecutive snapshots
    changes = []
    for i in range(1, len(snapshots)):
        prev = set(snapshots[i - 1]["drivers"] + snapshots[i - 1]["constructors"])
        curr = set(snapshots[i]["drivers"] + snapshots[i]["constructors"])
        diff = prev.symmetric_difference(curr)
        changes.append({
            "from_round": snapshots[i - 1]["round"],
            "to_round": snapshots[i]["round"],
            "roster_changes": len(diff) // 2,
            "changed_entities": sorted(diff),
        })

    return {"snapshots": snapshots, "changes": changes}


def eval_active_management(
    driver_results: dict,
    constructor_results: dict,
    driver_scores: dict[int, dict[str, float]],
    constructor_scores: dict[int, dict[str, float]],
    preseason_d: dict[str, float],
    preseason_c: dict[str, float],
) -> dict:
    """
    Compare a passive (set-and-forget) team vs an active manager.

    Passive: picks the best team at R1 based on preseason prices alone
    (price = proxy for expected performance, which is all a player has at R1).
    Active: starts with same team, makes up to 2 transfers per race using
    recent scoring data to find value.

    Measures both points advantage and end-of-season team value difference.
    """
    all_rounds = sorted(driver_scores.keys())
    last_round = max(all_rounds)

    # ── Passive team: best team by price-implied quality at R1 ──
    # At R1, a player has no scoring data. The best they can do is pick
    # the highest-scoring-expectation team that fits the budget.
    # Preseason price is the only signal, so we rank by price (higher = better expected).
    d_prices_r1 = prices_at_round(driver_results, 1)
    c_prices_r1 = prices_at_round(constructor_results, 1)

    # Use price as a proxy for expected points: rank entities by price
    avail_d = sorted(d_prices_r1.keys(), key=lambda d: d_prices_r1[d], reverse=True)
    avail_c = sorted(c_prices_r1.keys(), key=lambda c: c_prices_r1[c], reverse=True)

    # Greedy: pick the most expensive team that fits the budget
    best_passive = None
    best_cost = -1
    for d_combo in combinations(avail_d, N_DRIVERS):
        d_cost = sum(d_prices_r1[d] for d in d_combo)
        if d_cost > BUDGET_CAP:
            continue
        remaining = BUDGET_CAP - d_cost
        for c_combo in combinations(avail_c, N_CONSTRUCTORS):
            c_cost = sum(c_prices_r1[c] for c in c_combo)
            if c_cost > remaining:
                continue
            total_cost = d_cost + c_cost
            if total_cost > best_cost:
                best_cost = total_cost
                best_passive = (list(d_combo), list(c_combo))

    if not best_passive:
        return {"error": "Could not find valid passive team"}

    passive_drivers, passive_constructors = best_passive
    passive_r1_cost = best_cost

    # ── Score the passive team through the season ──
    passive_season_pts = 0
    for rnd in all_rounds:
        for d in passive_drivers:
            active_d = _active_driver(d, rnd)
            if active_d is None:
                # Original was replaced; find the replacement
                for new, (old, _) in REPLACEMENTS.items():
                    if d == old:
                        active_d = new
                        break
            if active_d:
                passive_season_pts += driver_scores.get(rnd, {}).get(active_d, 0)
        for c in passive_constructors:
            passive_season_pts += constructor_scores.get(rnd, {}).get(c, 0)

    # Passive end-of-season value
    d_end = end_of_season_prices(driver_results)
    c_end = end_of_season_prices(constructor_results)

    passive_end_drivers = []
    for d in passive_drivers:
        for new, (old, _) in REPLACEMENTS.items():
            if d == old:
                passive_end_drivers.append(new)
                break
        else:
            passive_end_drivers.append(d)

    passive_end_value = (
        sum(d_end.get(d, PRICE_FLOOR) for d in passive_end_drivers)
        + sum(c_end.get(c, PRICE_FLOOR) for c in passive_constructors)
    )

    # ── Active manager: same start, 2 free transfers per race ──
    active_drivers = list(passive_drivers)
    active_constructors = list(passive_constructors)
    active_balance = BUDGET_CAP - passive_r1_cost  # remaining budget
    active_season_pts = 0
    total_transfers = 0

    for rnd in all_rounds:
        d_prices = prices_at_round(driver_results, rnd)
        c_prices = prices_at_round(constructor_results, rnd)

        # Handle mid-season replacements on roster
        for i, d in enumerate(active_drivers):
            if _active_driver(d, rnd) is None:
                for new, (old, _) in REPLACEMENTS.items():
                    if d == old:
                        active_drivers[i] = new
                        break

        # Score current team this round
        for d in active_drivers:
            active_season_pts += driver_scores.get(rnd, {}).get(d, 0)
        for c in active_constructors:
            active_season_pts += constructor_scores.get(rnd, {}).get(c, 0)

        # After scoring, consider transfers for next round (up to 2)
        if rnd >= last_round:
            continue

        # Use rolling 3-race average as the transfer decision signal
        def recent_avg(entity, scores_dict):
            lookback = [scores_dict.get(r, {}).get(entity, 0)
                        for r in range(max(1, rnd - 2), rnd + 1)
                        if r in scores_dict]
            return sum(lookback) / len(lookback) if lookback else 0

        for _ in range(2):
            # Evaluate each roster slot: could we do better?
            best_swap = None
            best_improvement = 0

            # Check driver swaps
            for d in active_drivers:
                sell_value = d_prices.get(d, PRICE_FLOOR)
                d_recent = recent_avg(d, driver_scores)
                affordable_limit = sell_value + active_balance

                for cand in d_prices:
                    if cand in active_drivers:
                        continue
                    buy_price = d_prices[cand]
                    if buy_price > affordable_limit:
                        continue
                    cand_recent = recent_avg(cand, driver_scores)
                    improvement = cand_recent - d_recent
                    if improvement > best_improvement:
                        best_improvement = improvement
                        best_swap = ("driver", d, cand, sell_value, buy_price)

            # Check constructor swaps
            for c in active_constructors:
                sell_value = c_prices.get(c, PRICE_FLOOR)
                c_recent = recent_avg(c, constructor_scores)
                affordable_limit = sell_value + active_balance

                for cand in c_prices:
                    if cand in active_constructors:
                        continue
                    buy_price = c_prices[cand]
                    if buy_price > affordable_limit:
                        continue
                    cand_recent = recent_avg(cand, constructor_scores)
                    improvement = cand_recent - c_recent
                    if improvement > best_improvement:
                        best_improvement = improvement
                        best_swap = ("constructor", c, cand, sell_value, buy_price)

            if best_swap and best_improvement > 1.0:
                etype, sell, buy, sell_val, buy_val = best_swap
                if etype == "driver":
                    active_drivers.remove(sell)
                    active_drivers.append(buy)
                else:
                    active_constructors.remove(sell)
                    active_constructors.append(buy)
                active_balance += sell_val - buy_val
                total_transfers += 1
            else:
                break

    # Active end-of-season value
    active_end_value = (
        sum(d_end.get(d, PRICE_FLOOR) for d in active_drivers)
        + sum(c_end.get(c, PRICE_FLOOR) for c in active_constructors)
    )

    return {
        "passive": {
            "drivers": sorted(passive_drivers),
            "constructors": sorted(passive_constructors),
            "r1_cost": round(passive_r1_cost, 1),
            "end_value": round(passive_end_value, 1),
            "value_change": round(passive_end_value - passive_r1_cost, 1),
            "season_pts": passive_season_pts,
        },
        "active": {
            "drivers_final": sorted(active_drivers),
            "constructors_final": sorted(active_constructors),
            "end_value": round(active_end_value, 1),
            "remaining_balance": round(active_balance, 1),
            "total_transfers": total_transfers,
            "season_pts": active_season_pts,
        },
        "budget_advantage": round(active_end_value - passive_end_value, 1),
        "points_advantage": active_season_pts - passive_season_pts,
    }


def eval_tier_crossings(
    driver_results: dict, constructor_results: dict
) -> dict:
    """Check how many entities cross the A-tier/B-tier boundary during the season."""
    crossings = []

    for etype, results in [("driver", driver_results), ("constructor", constructor_results)]:
        for entity, rounds in results.items():
            start_tier = get_tier(rounds[0]["price_before"])
            for r in rounds:
                current_tier = get_tier(r["price_after"])
                if current_tier != start_tier:
                    crossings.append({
                        "type": etype,
                        "entity": entity,
                        "round": r["round"],
                        "direction": "A→B" if start_tier == "A" else "B→A",
                        "price": r["price_after"],
                    })
                    start_tier = current_tier  # track further crossings

    return {"crossings": crossings, "total": len(crossings)}


# ── Output ──────────────────────────────────────────────────────────────


def write_price_trajectories(
    driver_results: dict, constructor_results: dict, output_dir: str
):
    """Write price trajectory CSVs."""
    os.makedirs(output_dir, exist_ok=True)

    for label, results, name_col in [
        ("driver", driver_results, "driver"),
        ("constructor", constructor_results, "constructor"),
    ]:
        path = f"{output_dir}/{name_col}_price_trajectories.csv"
        with open(path, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                name_col, "round", "price_before", "points",
                "ppm", "avg_ppm", "band", "step", "price_after",
            ])
            for entity in sorted(results.keys()):
                for r in results[entity]:
                    writer.writerow([
                        entity, r["round"], r["price_before"], r["points"],
                        r["ppm"], r["avg_ppm"], r["band"], r["step"], r["price_after"],
                    ])


def print_report(
    driver_results: dict,
    constructor_results: dict,
    traj_eval: dict,
    floor_eval: dict,
    evolution_eval: dict,
    management_eval: dict,
    tier_eval: dict,
):
    """Print the full evaluation report."""

    print("=" * 80)
    print("  STEP 12: FULL MODEL VALIDATION — 2025 SEASON REPLAY")
    print("=" * 80)

    # ── 1. Price Trajectories ───────────────────────────────────────────
    print("\n" + "-" * 80)
    print("  1. PRICE TRAJECTORIES")
    print("-" * 80)

    print(f"\n  {'Entity':>8} {'Type':>5} {'Start':>7} {'End':>7} "
          f"{'Change':>8} {'%':>7} {'Min':>7} {'Max':>7} {'Floor':>5}")
    print(f"  {'-' * 72}")

    for t in traj_eval["trajectories"]:
        floor_mark = "  *" if t["at_floor"] else ""
        sign = "+" if t["change"] >= 0 else ""
        print(
            f"  {t['entity']:>8} {t['type'][0].upper():>5} "
            f"${t['start']:>5.1f} ${t['end']:>5.1f} "
            f"{sign}${t['change']:>5.1f} "
            f"{t['change_pct']:>6.1f}% "
            f"${t['min']:>5.1f} ${t['max']:>5.1f}{floor_mark}"
        )

    # Note on inflationary bias
    print(f"\n  NOTE: At exactly PPM = 1.0 (neutral), the band classification is")
    print(f"  'Good' (+step), creating a mild inflationary bias. Entities at fair")
    print(f"  value still see a price increase. This is per the pricing table spec.")

    # ── 2. Floor Compression ────────────────────────────────────────────
    print("\n" + "-" * 80)
    print("  2. FLOOR COMPRESSION")
    print("-" * 80)

    actual = floor_eval["total_at_floor"]
    print(f"\n  Entities at floor (${PRICE_FLOOR}M) at season end: {actual}")
    if floor_eval["drivers_at_floor"]:
        print(f"  Drivers:      {', '.join(floor_eval['drivers_at_floor'])}")
    if floor_eval["constructors_at_floor"]:
        print(f"  Constructors: {', '.join(floor_eval['constructors_at_floor'])}")

    if actual <= 3:
        verdict = "PASS"
    elif actual <= 5:
        verdict = "MARGINAL"
    else:
        verdict = "FAIL"
    print(f"\n  Target: 2-3 entities at floor | Actual: {actual} | {verdict}")

    # ── 3. Team Evolution ───────────────────────────────────────────────
    print("\n" + "-" * 80)
    print("  3. TEAM EVOLUTION (does the optimal team change?)")
    print("-" * 80)

    for snap in evolution_eval["snapshots"]:
        d_str = ", ".join(snap["drivers"])
        c_str = ", ".join(snap["constructors"])
        print(f"\n  R{snap['round']:>2}: ${snap['cost']:.1f}M "
              f"({snap['expected_pts']:.1f} pts/race)")
        print(f"        D: {d_str}")
        print(f"        C: {c_str}")

    total_changes = sum(c["roster_changes"] for c in evolution_eval["changes"])
    print(f"\n  Total roster changes across snapshots: {total_changes}")
    for c in evolution_eval["changes"]:
        if c["roster_changes"] > 0:
            print(f"    R{c['from_round']}->R{c['to_round']}: "
                  f"{c['roster_changes']} changes ({', '.join(c['changed_entities'])})")

    if total_changes >= 3:
        verdict = "PASS"
    elif total_changes >= 1:
        verdict = "MARGINAL"
    else:
        verdict = "FAIL"
    print(f"\n  Verdict: {verdict} — optimal team "
          f"{'evolves meaningfully' if total_changes >= 3 else 'evolves slightly' if total_changes > 0 else 'is static'}")

    # ── 4. Active Management ────────────────────────────────────────────
    print("\n" + "-" * 80)
    print("  4. ACTIVE MANAGEMENT ADVANTAGE")
    print("-" * 80)

    p = management_eval["passive"]
    a = management_eval["active"]

    print(f"\n  Passive team (best affordable at R1 preseason prices, hold all season):")
    print(f"    Roster: {', '.join(p['drivers'])} + {', '.join(p['constructors'])}")
    print(f"    R1 cost: ${p['r1_cost']:.1f}M -> End value: ${p['end_value']:.1f}M "
          f"({'+' if p['value_change'] >= 0 else ''}{p['value_change']:.1f}M)")
    print(f"    Season points: {p['season_pts']}")

    print(f"\n  Active manager (2 free transfers/race, recent-form signal):")
    print(f"    Final roster: {', '.join(a['drivers_final'])} + {', '.join(a['constructors_final'])}")
    print(f"    End value: ${a['end_value']:.1f}M | Remaining balance: ${a['remaining_balance']:.1f}M")
    print(f"    Transfers made: {a['total_transfers']} | Season points: {a['season_pts']}")

    print(f"\n  Budget advantage (end value): ${management_eval['budget_advantage']:.1f}M")
    print(f"  Points advantage: {management_eval['points_advantage']}")

    budget_adv = management_eval["budget_advantage"]
    if budget_adv < 1.0:
        verdict = "MARGINAL (too small — active management barely matters)"
    elif budget_adv > 15.0:
        verdict = "FAIL (too large — active management is dominant)"
    else:
        verdict = "PASS (meaningful but bounded)"
    print(f"\n  Verdict: {verdict}")

    # ── 5. Tier Crossings ───────────────────────────────────────────────
    print("\n" + "-" * 80)
    print(f"  5. TIER CROSSINGS (A-Tier >= ${A_TIER_THRESHOLD}M / B-Tier < ${A_TIER_THRESHOLD}M)")
    print("-" * 80)

    print(f"\n  Total tier crossings during the season: {tier_eval['total']}")
    for cx in tier_eval["crossings"]:
        print(f"    {cx['entity']:>8} ({cx['type'][0].upper()}) R{cx['round']:>2}: "
              f"{cx['direction']} at ${cx['price']:.1f}M")

    if tier_eval["total"] == 0:
        verdict = "INFO — no crossings (tiers are static labels)"
    else:
        verdict = f"INFO — {tier_eval['total']} crossing(s) show price tiers are dynamic"
    print(f"\n  {verdict}")

    # ── 6. Band Distribution ────────────────────────────────────────────
    print("\n" + "-" * 80)
    print("  6. BAND DISTRIBUTION")
    print("-" * 80)

    band_counts = defaultdict(int)
    for results in [driver_results, constructor_results]:
        for entity, rounds in results.items():
            for r in rounds:
                band_counts[r["band"]] += 1

    total = sum(band_counts.values())
    for band in ["great", "good", "poor", "terrible"]:
        count = band_counts[band]
        pct = count / total * 100 if total > 0 else 0
        bar = "#" * int(pct / 2)
        print(f"  {band:>9}: {count:>4} ({pct:>5.1f}%) {bar}")

    max_pct = max(band_counts[b] / total * 100 for b in band_counts) if total > 0 else 0
    if max_pct > 80:
        verdict = "FAIL (too binary — one band dominates)"
    elif max_pct > 60:
        verdict = "MARGINAL (one band heavy)"
    else:
        verdict = "PASS (bands well-distributed)"
    print(f"\n  Verdict: {verdict}")

    # ── Summary ─────────────────────────────────────────────────────────
    print("\n" + "=" * 80)
    print("  SUMMARY")
    print("=" * 80)
    print()


# ── Main ────────────────────────────────────────────────────────────────


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.dirname(script_dir)

    # Load data
    preseason_d, preseason_c = load_preseason_prices(
        os.path.join(base_dir, "reference", "2025-preseason-prices.csv")
    )
    driver_scores, constructor_scores = load_per_race_scores(
        os.path.join(script_dir, "output", "2025", "driver_scores.csv"),
        os.path.join(script_dir, "output", "2025", "constructor_scores.csv"),
    )

    # Run PPM simulation
    driver_results = run_ppm_simulation(preseason_d, driver_scores, "driver")
    constructor_results = run_ppm_simulation(preseason_c, constructor_scores, "constructor")

    # Write trajectories
    output_dir = os.path.join(script_dir, "output", "validation")
    write_price_trajectories(driver_results, constructor_results, output_dir)

    # Evaluate
    traj_eval = eval_price_trajectories(driver_results, constructor_results)
    floor_eval = eval_floor_compression(traj_eval["trajectories"])
    evolution_eval = eval_team_evolution(
        driver_results, constructor_results, driver_scores, constructor_scores
    )
    management_eval = eval_active_management(
        driver_results, constructor_results, driver_scores, constructor_scores,
        preseason_d, preseason_c,
    )
    tier_eval = eval_tier_crossings(driver_results, constructor_results)

    # Report
    print_report(
        driver_results, constructor_results,
        traj_eval, floor_eval, evolution_eval, management_eval, tier_eval,
    )

    print(f"  Price trajectory CSVs written to {output_dir}/")


if __name__ == "__main__":
    main()
