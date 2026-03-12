"""
test_pricing.py — Unit tests for pricing.py

Run with:
    cd docs/research/fantasy-rules/own-rules/simulation
    source .venv/bin/activate
    python -m pytest test_pricing.py -v
"""

import pytest
from pricing import (
    BUDGET_CAP,
    CONSTRUCTOR_CEILING,
    CONSTRUCTOR_FLOOR,
    DRIVER_CEILING,
    DRIVER_FLOOR,
    DRIVER_REF_MAX,
    DUMMY_SEED_COUNT,
    ROLLING_WINDOW,
    apply_price_change,
    compute_all_preseason_prices,
    compute_dream_team_cost,
    compute_preseason_price,
    compute_price_change,
    compute_rolling_avg,
)


# ── compute_preseason_price ────────────────────────────────────────────────


def test_preseason_driver_at_ref_max_gets_ceiling():
    # A driver performing exactly at REF_MAX normalises to 1.0 → ceiling price
    price = compute_preseason_price(DRIVER_REF_MAX, "driver")
    assert price == DRIVER_CEILING


def test_preseason_driver_above_ref_max_clamped_to_ceiling():
    # Normalisation clamps to 1.0, so above-max still gets ceiling
    price = compute_preseason_price(DRIVER_REF_MAX * 2, "driver")
    assert price == DRIVER_CEILING


def test_preseason_driver_zero_avg_gets_floor():
    price = compute_preseason_price(0.0, "driver")
    assert price == DRIVER_FLOOR


def test_preseason_driver_negative_avg_gets_floor():
    # Negative scoring (e.g. Williams 2024) → floor via normalisation clamp
    price = compute_preseason_price(-5.0, "driver")
    assert price == DRIVER_FLOOR


def test_preseason_driver_rookie_gets_floor():
    # None signals rookie / insufficient races
    price = compute_preseason_price(None, "driver")
    assert price == DRIVER_FLOOR


def test_preseason_constructor_at_ref_max_gets_ceiling():
    from pricing import CONSTRUCTOR_REF_MAX
    price = compute_preseason_price(CONSTRUCTOR_REF_MAX, "constructor")
    assert price == CONSTRUCTOR_CEILING


def test_preseason_constructor_rookie_gets_constructor_floor():
    price = compute_preseason_price(None, "constructor")
    assert price == CONSTRUCTOR_FLOOR


def test_preseason_price_is_multiple_of_100k():
    price = compute_preseason_price(15.0, "driver")
    assert price % 100_000 == 0


def test_preseason_price_scales_with_avg():
    # Higher avg → higher price (monotonic)
    p_low = compute_preseason_price(5.0, "driver")
    p_mid = compute_preseason_price(15.0, "driver")
    p_high = compute_preseason_price(25.0, "driver")
    assert p_low <= p_mid <= p_high


def test_preseason_price_in_valid_range():
    for avg in [0.0, 5.0, 15.0, 25.0, DRIVER_REF_MAX]:
        price = compute_preseason_price(avg, "driver")
        assert DRIVER_FLOOR <= price <= DRIVER_CEILING


# ── compute_rolling_avg ────────────────────────────────────────────────────


def test_rolling_avg_exact_window():
    assert compute_rolling_avg([10, 20, 30], 3) == 20.0


def test_rolling_avg_uses_last_n_scores():
    # Window=3, scores=[5, 10, 15, 20, 25] → last 3: [15, 20, 25] → avg=20
    assert compute_rolling_avg([5, 10, 15, 20, 25], 3) == 20.0


def test_rolling_avg_insufficient_scores_returns_none():
    assert compute_rolling_avg([10, 20], 3) is None


def test_rolling_avg_empty_returns_none():
    assert compute_rolling_avg([], 3) is None


def test_rolling_avg_default_window_is_rolling_window():
    scores = list(range(ROLLING_WINDOW))
    result = compute_rolling_avg(scores)
    assert result is not None


# ── compute_price_change ──────────────────────────────────────────────────
# No frozen period — dummy seeding keeps the window always full from round 1.


def test_price_change_active_from_round_1():
    # With dummy seeding there is no frozen period; corrections fire immediately
    change = compute_price_change(10_000_000, 25.0, "driver")
    assert change != 0


def test_price_change_positive_for_high_performer():
    change = compute_price_change(5_000_000, 25.0, "driver")
    assert change > 0


def test_price_change_negative_for_low_performer():
    change = compute_price_change(15_000_000, 1.0, "driver")
    assert change < 0


def test_price_change_zero_for_none_rolling_avg():
    assert compute_price_change(10_000_000, None, "driver") == 0


def test_price_change_capped_at_10_pct_upward():
    current = 10_000_000
    change = compute_price_change(current, DRIVER_REF_MAX, "driver")
    assert change <= current * 0.10 + 100_000  # allow $100K rounding


def test_price_change_capped_at_10_pct_downward():
    current = 10_000_000
    change = compute_price_change(current, 0.0, "driver")
    assert change >= -(current * 0.10 + 100_000)


def test_price_change_is_multiple_of_100k():
    change = compute_price_change(10_000_000, 20.0, "driver")
    assert change % 100_000 == 0


def test_price_change_constructor():
    change = compute_price_change(10_000_000, 30.0, "constructor")
    assert change > 0


def test_dummy_seed_count_is_window_minus_one():
    assert DUMMY_SEED_COUNT == ROLLING_WINDOW - 1


def test_dummy_seeded_window_always_full():
    # Pre-seeding with DUMMY_SEED_COUNT entries means compute_rolling_avg
    # returns a value after just 1 real score, not None.
    preseason_avg = 15.0
    seeded = [preseason_avg] * DUMMY_SEED_COUNT
    seeded.append(20)  # one real race result
    result = compute_rolling_avg(seeded)
    assert result is not None


# ── apply_price_change ────────────────────────────────────────────────────


def test_apply_price_change_increases_price():
    new_price = apply_price_change(10_000_000, 1_000_000, "driver")
    assert new_price == 11_000_000


def test_apply_price_change_decreases_price():
    new_price = apply_price_change(10_000_000, -1_000_000, "driver")
    assert new_price == 9_000_000


def test_apply_price_change_enforces_driver_floor():
    # Negative change that would take price below floor → clamped to floor
    new_price = apply_price_change(DRIVER_FLOOR, -500_000, "driver")
    assert new_price == DRIVER_FLOOR


def test_apply_price_change_enforces_constructor_floor():
    new_price = apply_price_change(CONSTRUCTOR_FLOOR, -1_000_000, "constructor")
    assert new_price == CONSTRUCTOR_FLOOR


def test_apply_price_change_result_is_multiple_of_100k():
    new_price = apply_price_change(5_000_000, 150_000, "driver")
    assert new_price % 100_000 == 0


def test_apply_price_change_zero_delta():
    new_price = apply_price_change(8_000_000, 0, "driver")
    assert new_price == 8_000_000


# ── compute_all_preseason_prices ──────────────────────────────────────────


def test_all_preseason_prices_rookies_get_floor():
    totals = {"VER": 703, "ROOKIE": 50}
    races = {"VER": 24, "ROOKIE": 5}  # ROOKIE < MIN_RACES_ELIGIBLE
    prices = compute_all_preseason_prices(totals, races, "driver")
    assert prices["ROOKIE"] == DRIVER_FLOOR
    assert prices["VER"] > DRIVER_FLOOR


def test_all_preseason_prices_missing_races_gets_floor():
    # Entity not present in races_entered dict → 0 races → floor
    totals = {"X": 500}
    prices = compute_all_preseason_prices(totals, {}, "driver")
    assert prices["X"] == DRIVER_FLOOR


def test_all_preseason_prices_returns_all_entities():
    totals = {"A": 700, "B": 400, "C": 100}
    races = {"A": 24, "B": 24, "C": 24}
    prices = compute_all_preseason_prices(totals, races, "driver")
    assert set(prices.keys()) == {"A", "B", "C"}


def test_all_preseason_prices_monotonic_with_totals():
    totals = {"low": 100, "mid": 400, "high": 700}
    races = {"low": 24, "mid": 24, "high": 24}
    prices = compute_all_preseason_prices(totals, races, "driver")
    assert prices["low"] <= prices["mid"] <= prices["high"]


# ── compute_dream_team_cost ────────────────────────────────────────────────


def test_dream_team_cost_selects_top_by_score():
    driver_prices = {
        "A": 19_000_000, "B": 17_000_000, "C": 15_000_000,
        "D": 13_000_000, "E": 10_000_000, "F": 5_000_000,
    }
    constructor_prices = {"X": 25_000_000, "Y": 20_000_000, "Z": 10_000_000}
    driver_scores = {"A": 600, "B": 500, "C": 400, "D": 300, "E": 200, "F": 100}
    constructor_scores = {"X": 800, "Y": 600, "Z": 400}

    cost = compute_dream_team_cost(
        driver_prices, constructor_prices, driver_scores, constructor_scores
    )
    # Top 5D (A,B,C,D,E): 19+17+15+13+10 = 74M
    # Top 3C (X,Y,Z):     25+20+10 = 55M
    # Total: 129M
    assert cost == 129_000_000


def test_dream_team_cost_missing_price_falls_back_to_floor():
    driver_prices = {"A": 19_000_000}  # only one entry
    constructor_prices = {}
    driver_scores = {"A": 600, "B": 500, "C": 400, "D": 300, "E": 200}
    constructor_scores = {"X": 800, "Y": 600, "Z": 400}

    cost = compute_dream_team_cost(
        driver_prices, constructor_prices, driver_scores, constructor_scores
    )
    # B,C,D,E missing → DRIVER_FLOOR each; X,Y,Z missing → CONSTRUCTOR_FLOOR each
    expected = 19_000_000 + 4 * DRIVER_FLOOR + 3 * CONSTRUCTOR_FLOOR
    assert cost == expected


def test_dream_team_exceeds_budget():
    # Sanity check: real 2025 dream team should be over budget
    # Using bakeoff best-param prices for VER,NOR,PIA,RUS,LEC + McLaren,Mercedes,Ferrari
    driver_prices = {
        "VER": 19_000_000, "NOR": 16_600_000, "PIA": 14_700_000,
        "RUS": 12_500_000, "LEC": 16_500_000,
    }
    constructor_prices = {
        "McLaren": 25_000_000, "Mercedes": 20_600_000, "Ferrari": 24_600_000,
    }
    driver_scores = {
        "VER": 676, "NOR": 638, "PIA": 603, "RUS": 554, "LEC": 422,
    }
    constructor_scores = {"McLaren": 858, "Mercedes": 623, "Ferrari": 607}

    cost = compute_dream_team_cost(
        driver_prices, constructor_prices, driver_scores, constructor_scores
    )
    assert cost > BUDGET_CAP
