"""
simulate.py — Fetch F1 results via FastF1, apply scoring rules, and
produce CSVs + a markdown analysis report against the 9 design criteria.

Usage:
    cd docs/research/fantasy-rules/own-rules/simulation
    pip install -r requirements.txt
    python simulate.py            # defaults to 2025
    python simulate.py --year 2024

First run downloads and caches all session data (~few hundred MB).
Subsequent runs use the local cache.
"""

import argparse
import os

import numpy as np
import pandas as pd
import fastf1

from scoring import (
    apply_captain,
    score_constructor_weekend,
    score_driver_quali,
    score_driver_session,
)

CACHE_DIR = ".ff1_cache"

# FastF1 Status values that indicate the driver completed the race.
# "Finished" = on lead lap; "Lapped" = classified but lapped.
_NON_DNF_STATUSES = {"Finished", "Lapped"}


# ── Helpers ───────────────────────────────────────────────────────────────


def is_dnf(status) -> bool:
    """Return True if the status string indicates DNF / DSQ / DNS."""
    if pd.isna(status):
        return True
    return str(status).strip() not in _NON_DNF_STATUSES


def has_sprint(event) -> bool:
    """Return True if the event weekend includes a sprint race."""
    return "sprint" in str(event.get("EventFormat", "")).lower()


def load_results(year: int, round_number: int, session_name: str):
    """Load a session and return its results DataFrame, or None on failure."""
    try:
        session = fastf1.get_session(year, round_number, session_name)
        session.load(telemetry=False, weather=False, messages=False)
        return session.results
    except Exception as exc:
        print(f"  Warning: could not load {session_name} for round {round_number}: {exc}")
        return None


# ── Per-session processing ────────────────────────────────────────────────


def _driver_session_scores(results: pd.DataFrame, session: str) -> dict:
    """
    Return {abbreviation: score_dict} for every driver in the results.

    score_dict keys: finish, gain, fl, penalty, total, team,
                     finish_position, grid_position, is_dnf
    """
    data: dict = {}
    for _, row in results.iterrows():
        abbr = row.get("Abbreviation", "UNK")
        team = row.get("TeamName", "Unknown")
        pos = row.get("Position")
        grid = row.get("GridPosition")
        status = row.get("Status", "")
        fl = bool(row.get("FastestLap", False))

        pos = None if pd.isna(pos) else int(pos)
        grid = None if pd.isna(grid) else int(grid)
        dnf = is_dnf(status) or pos is None

        score = score_driver_session(pos, grid, fl, dnf, session)
        score.update(
            team=team,
            finish_position=pos,
            grid_position=grid,
            is_dnf=dnf,
        )
        data[abbr] = score
    return data


def _constructor_weekend_scores(
    race_results: pd.DataFrame,
    race_driver_scores: dict,
    sprint_driver_scores: dict,
    quali_pts: dict,
) -> dict:
    """
    Return {team_name: score_dict} for every constructor for the full weekend.

    Constructor score = sum of both drivers' fantasy points across qualifying,
    race, and sprint, plus -5 per DNF in race/sprint.
    """
    teams: dict[str, list[str]] = {}
    for _, row in race_results.iterrows():
        team = row.get("TeamName", "Unknown")
        abbr = row.get("Abbreviation", "UNK")
        teams.setdefault(team, []).append(abbr)

    missing_race = {"total": 0, "is_dnf": True}
    missing_sprint = {"total": 0, "is_dnf": True}

    data: dict = {}
    for team, drivers in teams.items():
        a = drivers[0] if len(drivers) >= 1 else None
        b = drivers[1] if len(drivers) >= 2 else None

        a_race = race_driver_scores.get(a, missing_race) if a else missing_race
        b_race = race_driver_scores.get(b, missing_race) if b else missing_race

        has_sprint = bool(sprint_driver_scores)
        a_sprint = sprint_driver_scores.get(a, missing_sprint) if a and has_sprint else None
        b_sprint = sprint_driver_scores.get(b, missing_sprint) if b and has_sprint else None

        a_quali = quali_pts.get(a, 0) if a else 0
        b_quali = quali_pts.get(b, 0) if b else 0

        score = score_constructor_weekend(
            a_race, b_race, a_sprint, b_sprint, a_quali, b_quali,
        )
        data[team] = score
    return data


# ── Per-race weekend processing ───────────────────────────────────────────


def process_weekend(year: int, round_number: int, event_name: str, is_sprint_weekend: bool):
    """
    Fetch and score all sessions for one race weekend.

    Returns:
        (driver_rows, constructor_rows) — lists of dicts ready for DataFrame.
    """
    # ── Qualifying ───────────────────────────────────────────────────────
    quali_results = load_results(year, round_number, "Qualifying")
    quali_pts: dict = {}
    quali_pos: dict = {}
    if quali_results is not None:
        for _, row in quali_results.iterrows():
            abbr = row.get("Abbreviation", "UNK")
            pos = row.get("Position")
            pos = None if pd.isna(pos) else int(pos)
            quali_pts[abbr] = score_driver_quali(pos)
            quali_pos[abbr] = pos

    # ── Sprint ───────────────────────────────────────────────────────────
    sprint_driver: dict = {}
    if is_sprint_weekend:
        sprint_results = load_results(year, round_number, "Sprint")
        if sprint_results is not None:
            sprint_driver = _driver_session_scores(sprint_results, "sprint")

    # ── Race ─────────────────────────────────────────────────────────────
    race_results = load_results(year, round_number, "Race")
    if race_results is None:
        print(f"  Skipping round {round_number} ({event_name}) — no race results")
        return [], []

    race_driver = _driver_session_scores(race_results, "race")

    # ── Constructor (full weekend) ───────────────────────────────────────
    constructor_scores = _constructor_weekend_scores(
        race_results, race_driver, sprint_driver, quali_pts,
    )

    # ── Build driver rows ─────────────────────────────────────────────────
    driver_rows = []
    for abbr in set(race_driver) | set(quali_pts):
        rd = race_driver.get(abbr, {})
        sd = sprint_driver.get(abbr, {})
        qpts = quali_pts.get(abbr, 0)
        qpos = quali_pos.get(abbr)
        grid = rd.get("grid_position")

        race_finish = rd.get("finish", 0)
        race_gain = rd.get("gain", 0)
        race_fl = rd.get("fl", 0)
        sprint_finish = sd.get("finish")
        sprint_gain = sd.get("gain")
        sprint_fl = sd.get("fl")

        positive_pts = (
            (race_finish + race_gain + race_fl)
            + ((sprint_finish or 0) + (sprint_gain or 0) + (sprint_fl or 0))
            + qpts
        )

        driver_rows.append(
            {
                "round": round_number,
                "event": event_name,
                "driver": abbr,
                "team": rd.get("team") or sd.get("team", "Unknown"),
                "quali_pts": qpts,
                "quali_position": qpos,
                "grid_position": grid,
                "finish_position": rd.get("finish_position"),
                "grid_penalty_positions": (
                    (qpos - grid) if (qpos is not None and grid is not None) else None
                ),
                "race_finish_pts": race_finish,
                "race_gain_pts": race_gain,
                "race_fl_pts": race_fl,
                "race_penalty": rd.get("penalty", 0),
                "race_total": rd.get("total", 0),
                "sprint_finish_pts": sprint_finish,
                "sprint_gain_pts": sprint_gain,
                "sprint_fl_pts": sprint_fl,
                "sprint_penalty": sd.get("penalty"),
                "sprint_total": sd.get("total"),
                "positive_pts": positive_pts,
                "is_dnf": rd.get("is_dnf", False),
                "total_pts": (
                    rd.get("total", 0)
                    + (sd.get("total") or 0)
                    + qpts
                ),
            }
        )

    # ── Build constructor rows ────────────────────────────────────────────
    constructor_rows = []
    for team in constructor_scores:
        cs = constructor_scores[team]
        constructor_rows.append(
            {
                "round": round_number,
                "event": event_name,
                "constructor": team,
                "quali_sum": cs.get("quali_sum", 0),
                "race_driver_sum": cs.get("race_driver_sum", 0),
                "race_penalty": cs.get("race_penalty", 0),
                "race_total": cs.get("race_total", 0),
                "sprint_driver_sum": cs.get("sprint_driver_sum"),
                "sprint_penalty": cs.get("sprint_penalty"),
                "sprint_total": cs.get("sprint_total"),
                "total_pts": cs.get("total", 0),
            }
        )

    return driver_rows, constructor_rows


# ── Captain analysis ──────────────────────────────────────────────────────


def analyze_captains(driver_df: pd.DataFrame) -> pd.DataFrame:
    """
    For each race, find the retrospectively optimal captain (highest positive_pts).

    Returns one row per race with the top driver, their captained total, and
    the second-best driver.
    """
    rows = []
    for round_num, group in driver_df.groupby("round"):
        group = group.sort_values("positive_pts", ascending=False).reset_index(drop=True)
        if group.empty:
            continue
        best = group.iloc[0]
        second = group.iloc[1] if len(group) > 1 else None

        rows.append(
            {
                "round": round_num,
                "event": best["event"],
                "optimal_captain": best["driver"],
                "positive_pts": int(best["positive_pts"]),
                "captained_total": apply_captain(int(best["positive_pts"]), bool(best["is_dnf"])),
                "second_driver": second["driver"] if second is not None else None,
                "second_pts": int(second["positive_pts"]) if second is not None else None,
            }
        )
    return pd.DataFrame(rows)


# ── Runaway simulation ────────────────────────────────────────────────────


def _greedy_swap(
    roster_drivers: list,
    roster_constructors: list,
    all_drivers: set,
    all_constructors: set,
    driver_scores: dict,
    constructor_scores: dict,
    n_swaps: int,
) -> tuple[list, list]:
    """
    Make n_swaps greedy transfers, each time swapping the slot whose
    replacement yields the greatest improvement this race.
    """
    cur_d = list(roster_drivers)
    cur_c = list(roster_constructors)

    for _ in range(n_swaps):
        best_gain = 0
        best_action = None

        for i, d in enumerate(cur_d):
            for new_d in all_drivers - set(cur_d):
                gain = driver_scores.get(new_d, 0) - driver_scores.get(d, 0)
                if gain > best_gain:
                    best_gain = gain
                    best_action = ("driver", i, new_d)

        for i, c in enumerate(cur_c):
            for new_c in all_constructors - set(cur_c):
                gain = constructor_scores.get(new_c, 0) - constructor_scores.get(c, 0)
                if gain > best_gain:
                    best_gain = gain
                    best_action = ("constructor", i, new_c)

        if best_action:
            kind, idx, new_val = best_action
            if kind == "driver":
                cur_d[idx] = new_val
            else:
                cur_c[idx] = new_val

    return cur_d, cur_c


def _score_team(
    drivers: list,
    constructors: list,
    driver_scores: dict,
    constructor_scores: dict,
    driver_positive: dict,
    driver_dnf: dict,
) -> int:
    """Score a team for one race including the optimal captain bonus."""
    d_total = sum(driver_scores.get(d, 0) for d in drivers)
    c_total = sum(constructor_scores.get(c, 0) for c in constructors)

    # Captain: find driver with highest positive_pts; their bonus is +positive_pts
    best_d = max(drivers, key=lambda d: driver_positive.get(d, 0), default=None)
    captain_bonus = driver_positive.get(best_d, 0) if best_d else 0

    return d_total + c_total + captain_bonus


def simulate_runaway(driver_df: pd.DataFrame, constructor_df: pd.DataFrame) -> pd.DataFrame:
    """
    Simulate 4 season-long scenarios to quantify season-runaway risk.

    Scenarios:
        locked        — race-1 optimal team, held all season (optimal captain each race)
        1_transfer    — greedy single transfer before each race
        2_transfers   — greedy double transfer before each race
        perfect       — best possible 5 drivers + 3 constructors each race

    NOTE: No budget constraint is applied. Flag in report.
    """
    rounds = sorted(driver_df["round"].unique())
    if not rounds:
        return pd.DataFrame()

    # Build per-round lookup dicts
    d_scores = {
        r: driver_df[driver_df["round"] == r].set_index("driver")["total_pts"].to_dict()
        for r in rounds
    }
    c_scores = {
        r: constructor_df[constructor_df["round"] == r].set_index("constructor")["total_pts"].to_dict()
        for r in rounds
    }
    d_positive = {
        r: driver_df[driver_df["round"] == r].set_index("driver")["positive_pts"].to_dict()
        for r in rounds
    }
    d_dnf = {
        r: driver_df[driver_df["round"] == r].set_index("driver")["is_dnf"].to_dict()
        for r in rounds
    }

    all_drivers = set(driver_df["driver"].unique())
    all_constructors = set(constructor_df["constructor"].unique())

    # Starting team: top 5 drivers + top 3 constructors by race-1 score
    r1 = rounds[0]
    start_drivers = sorted(d_scores[r1], key=lambda d: d_scores[r1][d], reverse=True)[:5]
    start_constructors = sorted(c_scores[r1], key=lambda c: c_scores[r1][c], reverse=True)[:3]

    locked_d = list(start_drivers)
    locked_c = list(start_constructors)
    t1_d = list(start_drivers)
    t1_c = list(start_constructors)
    t2_d = list(start_drivers)
    t2_c = list(start_constructors)

    cum_locked = cum_t1 = cum_t2 = cum_perfect = 0
    rows = []

    for r in rounds:
        # Greedy transfers use current race scores to decide (retrospective upper bound)
        t1_d, t1_c = _greedy_swap(t1_d, t1_c, all_drivers, all_constructors, d_scores[r], c_scores[r], 1)
        t2_d, t2_c = _greedy_swap(t2_d, t2_c, all_drivers, all_constructors, d_scores[r], c_scores[r], 2)

        perfect_d = sorted(d_scores[r], key=lambda d: d_scores[r][d], reverse=True)[:5]
        perfect_c = sorted(c_scores[r], key=lambda c: c_scores[r][c], reverse=True)[:3]

        pts_locked = _score_team(locked_d, locked_c, d_scores[r], c_scores[r], d_positive[r], d_dnf[r])
        pts_t1 = _score_team(t1_d, t1_c, d_scores[r], c_scores[r], d_positive[r], d_dnf[r])
        pts_t2 = _score_team(t2_d, t2_c, d_scores[r], c_scores[r], d_positive[r], d_dnf[r])
        pts_perfect = _score_team(perfect_d, perfect_c, d_scores[r], c_scores[r], d_positive[r], d_dnf[r])

        cum_locked += pts_locked
        cum_t1 += pts_t1
        cum_t2 += pts_t2
        cum_perfect += pts_perfect

        rows.append(
            {
                "round": r,
                "locked": cum_locked,
                "1_transfer": cum_t1,
                "2_transfers": cum_t2,
                "perfect": cum_perfect,
            }
        )

    return pd.DataFrame(rows)


# ── Analysis report ───────────────────────────────────────────────────────


def generate_report(
    driver_df: pd.DataFrame,
    constructor_df: pd.DataFrame,
    season_driver: pd.DataFrame,
    season_constructor: pd.DataFrame,
    captain_df: pd.DataFrame,
    runaway_df: pd.DataFrame,
    year: int,
) -> str:
    lines = [
        f"# Scoring Simulation Analysis Report",
        f"",
        f"Season: {year} | Generated against candidate scoring rules from `scoring.md`",
        f"",
    ]

    # ── C1: Skill ceiling ─────────────────────────────────────────────────
    lines.append("## C1 — Skill Ceiling\n")
    totals = season_driver["season_total"]
    top_val = int(totals.max())
    p80_val = int(totals.quantile(0.8))
    median_val = int(totals.median())
    ratio = top_val / median_val if median_val > 0 else float("inf")
    top_driver = season_driver.iloc[0]["driver"]
    lines += [
        f"- Top driver: **{top_driver}** — {top_val} pts",
        f"- 80th percentile: {p80_val} pts",
        f"- Median: {median_val} pts",
        f"- Top-to-median ratio: {ratio:.2f}x {'⚠️ FLAG: >3x target' if ratio > 3 else '✅ within target'}",
        "",
    ]

    # ── C2: Volatility ────────────────────────────────────────────────────
    lines.append("## C2 — Volatility\n")
    vol_rows = []
    for driver, group in driver_df.groupby("driver"):
        s_total = group["total_pts"].sum()
        max_race = group["total_pts"].max()
        pct = (max_race / s_total * 100) if s_total > 0 else 0.0
        vol_rows.append({"driver": driver, "max_race_pts": max_race, "season_total": s_total, "max_pct": pct})
    vol_df = pd.DataFrame(vol_rows).sort_values("max_pct", ascending=False)
    flagged_vol = vol_df[vol_df["max_pct"] > 20]
    lines.append(f"Target: single race ≤ 20% of season total. Flagged drivers: {len(flagged_vol)}")
    for _, r in flagged_vol.head(10).iterrows():
        lines.append(f"  - {r['driver']}: max {int(r['max_race_pts'])} pts = {r['max_pct']:.1f}% of {int(r['season_total'])}")
    lines.append("")

    # ── C3: Constructor strategy ──────────────────────────────────────────
    lines.append("## C3 — Constructor Strategy\n")
    cdf = constructor_df.copy()
    negative_races = cdf[cdf["race_total"] < 0]
    lines.append(f"- Races where constructor scored negative: **{len(negative_races)}**")
    if not negative_races.empty:
        for _, r in negative_races.head(5).iterrows():
            lines.append(f"  - R{int(r['round'])} {r['constructor']}: driver_sum={int(r['race_driver_sum'])}, penalty={int(r['race_penalty'])}, total={int(r['race_total'])}")

    top5_d_total = season_driver.head(5)["season_total"].sum()
    top3_c_total = season_constructor.head(3)["season_total"].sum()
    model_total = top5_d_total + top3_c_total
    c_pct = top3_c_total / model_total * 100 if model_total > 0 else 0.0
    lines += [
        f"",
        f"Model team (top 5 drivers + top 3 constructors, no budget constraint):",
        f"  - Driver total: {top5_d_total}",
        f"  - Constructor total: {top3_c_total}",
        f"  - Constructor share: {c_pct:.1f}% {'⚠️ FLAG: <25% target' if c_pct < 25 else '✅ above 25% target'}",
        "",
    ]

    # ── C4: No dominant always-picks ──────────────────────────────────────
    lines.append("## C4 — No Dominant Always-Picks\n")
    top_per_race = (
        driver_df.sort_values("total_pts", ascending=False)
        .groupby("round")
        .first()["driver"]
    )
    top_counts = top_per_race.value_counts()
    total_races = len(top_per_race)
    lines.append(f"Top scorer per race distribution (out of {total_races} races):")
    for driver, count in top_counts.head(8).items():
        pct = count / total_races * 100
        flag = " ⚠️ FLAG: >40%" if pct > 40 else ""
        lines.append(f"  - {driver}: {count} races ({pct:.0f}%){flag}")
    lines.append("")

    # ── C5: Position gain calibration ─────────────────────────────────────
    lines.append("## C5 — Position Gain Calibration\n")
    big_gainers = driver_df[driver_df["race_gain_pts"] >= 20].copy()
    lines.append(f"Drivers earning ≥ 20 position-gain pts in a race (P20→P10 threshold): **{len(big_gainers)}**")
    for _, r in big_gainers.iterrows():
        winner_rows = driver_df[(driver_df["round"] == r["round"]) & (driver_df["finish_position"] == 1)]
        winner_total = int(winner_rows["total_pts"].sum()) if not winner_rows.empty else "N/A"
        lines.append(
            f"  - R{int(r['round'])} {r['driver']}: +{int(r['race_gain_pts'])} gain "
            f"(grid P{int(r['grid_position']):.0f}→P{int(r['finish_position']):.0f}); "
            f"race winner total: {winner_total}"
        )
    lines.append("")

    # ── C6: Sprint weekend differential ───────────────────────────────────
    lines.append("## C6 — Sprint Weekend Differential\n")
    sprint_rounds = driver_df[driver_df["sprint_total"].notna()]["round"].unique()
    std_rounds = driver_df[~driver_df["round"].isin(sprint_rounds)]["round"].unique()
    if len(sprint_rounds) > 0:
        sprint_avg = driver_df[driver_df["round"].isin(sprint_rounds)].groupby("round")["total_pts"].sum().mean()
        std_avg = (
            driver_df[driver_df["round"].isin(std_rounds)].groupby("round")["total_pts"].sum().mean()
            if len(std_rounds) > 0
            else 0.0
        )
        ratio_s = sprint_avg / std_avg if std_avg > 0 else float("inf")
        lines += [
            f"- Sprint weekends: {len(sprint_rounds)} | avg field total pts/round: {sprint_avg:.0f}",
            f"- Standard weekends: {len(std_rounds)} | avg field total pts/round: {std_avg:.0f}",
            f"- Sprint-to-standard ratio: {ratio_s:.2f}x",
        ]

        # Main race share within sprint weekends
        sprint_wknd_df = driver_df[driver_df["round"].isin(sprint_rounds)]
        race_share = (
            sprint_wknd_df["race_total"].sum()
            / sprint_wknd_df["total_pts"].replace(0, np.nan).sum()
            * 100
        )
        lines.append(f"- Main race share of total pts on sprint weekends: {race_share:.1f}%")
    else:
        lines.append("- No sprint weekends detected.")
    lines.append("")

    # ── C7: Captain variance ──────────────────────────────────────────────
    lines.append("## C7 — Captain Pick Variance\n")
    if not captain_df.empty:
        cap_counts = captain_df["optimal_captain"].value_counts()
        total_cap_races = len(captain_df)
        lines.append(f"Optimal captain distribution (out of {total_cap_races} races):")
        for driver, count in cap_counts.head(8).items():
            pct = count / total_cap_races * 100
            flag = " ⚠️ FLAG: >40%" if pct > 40 else ""
            lines.append(f"  - {driver}: {count} races ({pct:.0f}%){flag}")
    lines.append("")

    # ── C8: DNF penalty calibration ───────────────────────────────────────
    lines.append("## C8 — DNF Penalty Calibration\n")
    dnf_counts = driver_df[driver_df["is_dnf"]].groupby("driver").size().sort_values(ascending=False)
    if not dnf_counts.empty:
        worst = dnf_counts.index[0]
        n_dnf = int(dnf_counts.iloc[0])
        d_rows = driver_df[driver_df["driver"] == worst]
        total_with = int(d_rows["total_pts"].sum())
        total_without = total_with + n_dnf * 10
        pct_lost = n_dnf * 10 / total_without * 100 if total_without > 0 else 0.0
        lines += [
            f"- Most DNFs: **{worst}** ({n_dnf} DNFs)",
            f"  - Season total with penalties: {total_with}",
            f"  - Season total without penalties: {total_without}",
            f"  - Penalties as % of pre-penalty total: {pct_lost:.1f}% {'⚠️ FLAG: >30%' if pct_lost > 30 else '✅ within target'}",
        ]
        lines.append("")
        lines.append("All drivers with 3+ DNFs:")
        for driver, count in dnf_counts[dnf_counts >= 3].items():
            d_total = int(driver_df[driver_df["driver"] == driver]["total_pts"].sum())
            lines.append(f"  - {driver}: {int(count)} DNFs, season total {d_total}")
    lines.append("")

    # ── C9: Season runaway risk ───────────────────────────────────────────
    lines.append("## C9 — Season Runaway Risk\n")
    lines.append("⚠️ NOTE: No budget constraint applied — re-run after pricing is finalized.\n")
    if not runaway_df.empty:
        final = runaway_df.iloc[-1]
        mid_idx = len(runaway_df) // 2
        mid = runaway_df.iloc[mid_idx]
        lines += [
            f"### Final season totals",
            f"| Scenario | Total pts | vs. locked |",
            f"|----------|-----------|------------|",
            f"| Locked (race-1 optimal, held all season) | {int(final['locked'])} | — |",
            f"| 1 transfer/race | {int(final['1_transfer'])} | +{int(final['1_transfer'] - final['locked'])} |",
            f"| 2 transfers/race | {int(final['2_transfers'])} | +{int(final['2_transfers'] - final['locked'])} |",
            f"| Perfect hindsight | {int(final['perfect'])} | +{int(final['perfect'] - final['locked'])} |",
            f"",
            f"### Mid-season snapshot (round {int(mid['round'])})",
            f"| Scenario | Cumulative pts |",
            f"|----------|----------------|",
            f"| Locked | {int(mid['locked'])} |",
            f"| 1 transfer | {int(mid['1_transfer'])} |",
            f"| 2 transfers | {int(mid['2_transfers'])} |",
            f"| Perfect | {int(mid['perfect'])} |",
            f"",
            f"Gap from locked to perfect at mid-season: {int(mid['perfect'] - mid['locked'])} pts",
            f"Gap from locked to perfect at season end: {int(final['perfect'] - final['locked'])} pts",
        ]
    lines.append("")

    return "\n".join(lines)


# ── Main ──────────────────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(description="F1 Fantasy scoring simulation")
    parser.add_argument("--year", type=int, default=2025, help="Season year (default: 2025)")
    args = parser.parse_args()
    year = args.year

    output_dir = f"output/{year}"
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(CACHE_DIR, exist_ok=True)
    fastf1.Cache.enable_cache(CACHE_DIR)

    print(f"Fetching {year} F1 schedule...")
    schedule = fastf1.get_event_schedule(year, include_testing=False)

    all_driver_rows: list = []
    all_constructor_rows: list = []

    for _, event in schedule.iterrows():
        round_num = int(event["RoundNumber"])
        name = str(event["EventName"])
        sprint = has_sprint(event)
        print(f"  Round {round_num:2d}: {name} {'[sprint]' if sprint else ''}")

        dr, cr = process_weekend(year, round_num, name, sprint)
        all_driver_rows.extend(dr)
        all_constructor_rows.extend(cr)

    if not all_driver_rows:
        print("No data collected — check FastF1 cache or season availability.")
        return

    driver_df = pd.DataFrame(all_driver_rows)
    constructor_df = pd.DataFrame(all_constructor_rows)

    # Season totals
    season_driver = (
        driver_df.groupby("driver")
        .agg(team=("team", "last"), season_total=("total_pts", "sum"), races_entered=("round", "count"))
        .reset_index()
        .sort_values("season_total", ascending=False)
    )
    season_constructor = (
        constructor_df.groupby("constructor")
        .agg(season_total=("total_pts", "sum"))
        .reset_index()
        .sort_values("season_total", ascending=False)
    )

    print("\nRunning captain analysis...")
    captain_df = analyze_captains(driver_df)

    print("Running runaway simulation (this may take a moment)...")
    runaway_df = simulate_runaway(driver_df, constructor_df)

    print("Generating analysis report...")
    report = generate_report(
        driver_df, constructor_df, season_driver, season_constructor, captain_df, runaway_df, year
    )

    # ── Write outputs ─────────────────────────────────────────────────────
    driver_df.to_csv(f"{output_dir}/driver_scores.csv", index=False)
    constructor_df.to_csv(f"{output_dir}/constructor_scores.csv", index=False)

    season_driver.to_csv(f"{output_dir}/season_totals.csv", index=False)
    season_constructor.to_csv(f"{output_dir}/season_constructor_totals.csv", index=False)

    captain_df.to_csv(f"{output_dir}/captain_analysis.csv", index=False)
    runaway_df.to_csv(f"{output_dir}/runaway_simulation.csv", index=False)

    with open(f"{output_dir}/analysis_report.md", "w") as f:
        f.write(report)

    print(f"\nDone. Outputs written to {output_dir}/")
    print(f"  driver_scores.csv          — per-race per-driver breakdown")
    print(f"  constructor_scores.csv     — per-race per-constructor breakdown")
    print(f"  season_totals.csv          — driver season totals")
    print(f"  season_constructor_totals.csv — constructor season totals")
    print(f"  captain_analysis.csv       — optimal captain per race")
    print(f"  runaway_simulation.csv     — cumulative pts by scenario")
    print(f"  analysis_report.md         — narrative analysis of 9 criteria")


if __name__ == "__main__":
    main()
