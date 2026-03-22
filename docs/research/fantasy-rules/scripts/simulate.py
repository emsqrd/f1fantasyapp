"""
simulate.py — Fetch F1 results via FastF1, apply current scoring rules,
and produce per-race and season-total CSVs.

Usage:
    cd docs/research/fantasy-rules/scripts
    source .venv/bin/activate
    python3 simulate.py            # defaults to 2025
    python3 simulate.py --year 2024
"""

import argparse
import os

import numpy as np
import pandas as pd
import fastf1

from scoring import score_driver_session, score_driver_quali

CACHE_DIR = ".ff1_cache"
_NON_DNF_STATUSES = {"Finished", "Lapped"}


def is_dnf(status) -> bool:
    if pd.isna(status):
        return True
    return str(status).strip() not in _NON_DNF_STATUSES


def has_sprint(event) -> bool:
    return "sprint" in str(event.get("EventFormat", "")).lower()


def load_session(year: int, round_number: int, session_name: str):
    """Load a FastF1 session. Returns the session object, or None on failure."""
    try:
        session = fastf1.get_session(year, round_number, session_name)
        session.load(telemetry=False, weather=False, messages=False)
        return session
    except Exception as exc:
        print(f"  Warning: could not load {session_name} R{round_number}: {exc}")
        return None


def count_overtakes(laps) -> dict[str, int]:
    """Count on-track overtakes per driver from lap-by-lap position data.

    Uses pairwise comparison: an overtake occurs when driver A was behind
    driver B on lap N-1 but ahead on lap N, and neither driver pitted on
    those laps. This avoids phantom gains from retirements or other cars
    pitting.

    Excludes:
    - Lap 1 (first-lap chaos is captured by grid-to-finish position change)
    - Laps where either driver in the pair entered or exited the pits
    """
    if laps is None or laps.empty:
        return {}

    pos = laps.pivot_table(index="LapNumber", columns="Driver", values="Position")
    if pos.empty:
        return {}

    drivers = list(pos.columns)

    # Identify pit laps (entry or exit) per driver
    pit_laps = set()
    for _, row in laps.iterrows():
        if pd.notna(row.get("PitInTime")):
            pit_laps.add((row["Driver"], int(row["LapNumber"])))
        if pd.notna(row.get("PitOutTime")):
            pit_laps.add((row["Driver"], int(row["LapNumber"])))

    sorted_laps = sorted(pos.index)
    overtakes = {driver: 0 for driver in drivers}

    for i in range(1, len(sorted_laps)):
        curr_lap = int(sorted_laps[i])
        prev_lap = int(sorted_laps[i - 1])

        # Skip comparisons involving lap 1
        if prev_lap <= 1:
            continue

        for a_idx, driver_a in enumerate(drivers):
            # Skip if driver A pitted
            if (driver_a, curr_lap) in pit_laps or (driver_a, prev_lap) in pit_laps:
                continue

            a_prev = pos.loc[sorted_laps[i - 1], driver_a]
            a_curr = pos.loc[sorted_laps[i], driver_a]
            if pd.isna(a_prev) or pd.isna(a_curr):
                continue

            for driver_b in drivers[a_idx + 1:]:
                # Skip if driver B pitted
                if (driver_b, curr_lap) in pit_laps or (driver_b, prev_lap) in pit_laps:
                    continue

                b_prev = pos.loc[sorted_laps[i - 1], driver_b]
                b_curr = pos.loc[sorted_laps[i], driver_b]
                if pd.isna(b_prev) or pd.isna(b_curr):
                    continue

                # A was behind B on prev_lap, A is ahead of B on curr_lap
                if a_prev > b_prev and a_curr < b_curr:
                    overtakes[driver_a] += 1
                # B was behind A on prev_lap, B is ahead of A on curr_lap
                elif b_prev > a_prev and b_curr < a_curr:
                    overtakes[driver_b] += 1

    return overtakes


def process_weekend(year: int, round_number: int, event_name: str, is_sprint_weekend: bool):
    """Fetch and score all sessions for one race weekend."""

    # Qualifying
    quali_session = load_session(year, round_number, "Qualifying")
    quali_pts: dict = {}
    quali_pos: dict = {}
    if quali_session is not None:
        for _, row in quali_session.results.iterrows():
            abbr = row.get("Abbreviation", "UNK")
            pos = row.get("Position")
            pos = None if pd.isna(pos) else int(pos)
            quali_pts[abbr] = score_driver_quali(pos)
            quali_pos[abbr] = pos

    # Sprint
    sprint_driver: dict = {}
    sprint_grid_pos: dict = {}
    if is_sprint_weekend:
        sprint_session = load_session(year, round_number, "Sprint")
        if sprint_session is not None:
            sprint_overtakes = count_overtakes(sprint_session.laps)
            for _, row in sprint_session.results.iterrows():
                abbr = row.get("Abbreviation", "UNK")
                team = row.get("TeamName", "Unknown")
                pos = row.get("Position")
                grid = row.get("GridPosition")
                status = row.get("Status", "")
                fl = bool(row.get("FastestLap", False))

                pos = None if pd.isna(pos) else int(pos)
                grid = None if pd.isna(grid) else int(grid)
                dnf = is_dnf(status) or pos is None

                score = score_driver_session(pos, grid, fl, dnf, "sprint",
                                             overtakes=sprint_overtakes.get(abbr, 0))
                score.update(team=team, finish_position=pos, grid_position=grid, is_dnf=dnf)
                sprint_driver[abbr] = score
                sprint_grid_pos[abbr] = grid

    # Race
    race_session = load_session(year, round_number, "Race")
    if race_session is None:
        print(f"  Skipping R{round_number} ({event_name}) — no race results")
        return [], []

    race_overtakes = count_overtakes(race_session.laps)
    race_driver: dict = {}
    for _, row in race_session.results.iterrows():
        abbr = row.get("Abbreviation", "UNK")
        team = row.get("TeamName", "Unknown")
        pos = row.get("Position")
        grid = row.get("GridPosition")
        status = row.get("Status", "")
        fl = bool(row.get("FastestLap", False))

        pos = None if pd.isna(pos) else int(pos)
        grid = None if pd.isna(grid) else int(grid)
        dnf = is_dnf(status) or pos is None

        score = score_driver_session(pos, grid, fl, dnf, "race",
                                     overtakes=race_overtakes.get(abbr, 0))
        score.update(team=team, finish_position=pos, grid_position=grid, is_dnf=dnf)
        race_driver[abbr] = score

    # Build driver rows
    driver_rows = []
    for abbr in set(race_driver) | set(quali_pts):
        rd = race_driver.get(abbr, {})
        sd = sprint_driver.get(abbr, {})
        qpts = quali_pts.get(abbr, 0)
        qpos = quali_pos.get(abbr)

        race_total = rd.get("total", 0)
        sprint_total = sd.get("total") if sd else None

        total_pts = race_total + (sprint_total or 0) + qpts

        driver_rows.append({
            "round": round_number,
            "event": event_name,
            "driver": abbr,
            "team": rd.get("team") or sd.get("team", "Unknown"),
            "quali_pts": qpts,
            "quali_position": qpos,
            "race_grid": rd.get("grid_position"),
            "race_finish": rd.get("finish_position"),
            "race_finish_pts": rd.get("finish", 0),
            "race_pos_change": rd.get("pos_change", 0),
            "race_overtakes": rd.get("overtakes", 0),
            "race_fl_pts": rd.get("fl", 0),
            "race_penalty": rd.get("penalty", 0),
            "race_total": race_total,
            "sprint_grid": sprint_grid_pos.get(abbr),
            "sprint_finish": sd.get("finish_position") if sd else None,
            "sprint_finish_pts": sd.get("finish") if sd else None,
            "sprint_pos_change": sd.get("pos_change") if sd else None,
            "sprint_overtakes": sd.get("overtakes") if sd else None,
            "sprint_fl_pts": sd.get("fl") if sd else None,
            "sprint_penalty": sd.get("penalty") if sd else None,
            "sprint_total": sprint_total,
            "is_dnf": rd.get("is_dnf", False),
            "total_pts": total_pts,
        })

    # Build constructor rows (sum of both drivers)
    teams: dict[str, list[str]] = {}
    for _, row in race_session.results.iterrows():
        team = row.get("TeamName", "Unknown")
        abbr = row.get("Abbreviation", "UNK")
        teams.setdefault(team, []).append(abbr)

    constructor_rows = []
    for team, drivers in teams.items():
        c_total = 0
        for d in drivers:
            d_race = race_driver.get(d, {}).get("total", 0)
            d_sprint = sprint_driver.get(d, {}).get("total") if sprint_driver.get(d) else 0
            d_quali = quali_pts.get(d, 0)
            c_total += d_race + (d_sprint or 0) + d_quali

        constructor_rows.append({
            "round": round_number,
            "event": event_name,
            "constructor": team,
            "total_pts": c_total,
        })

    return driver_rows, constructor_rows


def main() -> None:
    parser = argparse.ArgumentParser(description="F1 Fantasy scoring simulation")
    parser.add_argument("--year", type=int, default=2025, help="Season year")
    args = parser.parse_args()
    year = args.year

    output_dir = f"output/{year}"
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(CACHE_DIR, exist_ok=True)
    fastf1.Cache.enable_cache(CACHE_DIR)

    print(f"Fetching {year} schedule...")
    schedule = fastf1.get_event_schedule(year, include_testing=False)

    all_driver_rows: list = []
    all_constructor_rows: list = []

    for _, event in schedule.iterrows():
        round_num = int(event["RoundNumber"])
        if round_num == 0:
            continue
        name = str(event["EventName"])
        sprint = has_sprint(event)
        print(f"  R{round_num:2d}: {name} {'[sprint]' if sprint else ''}")

        dr, cr = process_weekend(year, round_num, name, sprint)
        all_driver_rows.extend(dr)
        all_constructor_rows.extend(cr)

    if not all_driver_rows:
        print("No data collected.")
        return

    driver_df = pd.DataFrame(all_driver_rows)
    constructor_df = pd.DataFrame(all_constructor_rows)

    # Season totals
    season_driver = (
        driver_df.groupby("driver")
        .agg(team=("team", "last"), season_total=("total_pts", "sum"), races=("round", "count"))
        .reset_index()
        .sort_values("season_total", ascending=False)
    )
    season_constructor = (
        constructor_df.groupby("constructor")
        .agg(season_total=("total_pts", "sum"))
        .reset_index()
        .sort_values("season_total", ascending=False)
    )

    # Per-race averages
    season_driver["per_race_avg"] = (season_driver["season_total"] / season_driver["races"]).round(2)
    season_constructor["races"] = constructor_df.groupby("constructor")["round"].count().values
    season_constructor["per_race_avg"] = (season_constructor["season_total"] / season_constructor["races"]).round(2)

    # Write outputs
    driver_df.to_csv(f"{output_dir}/driver_scores.csv", index=False)
    constructor_df.to_csv(f"{output_dir}/constructor_scores.csv", index=False)
    season_driver.to_csv(f"{output_dir}/season_driver_totals.csv", index=False)
    season_constructor.to_csv(f"{output_dir}/season_constructor_totals.csv", index=False)

    print(f"\nSeason driver totals:")
    print(season_driver[["driver", "team", "season_total", "per_race_avg"]].to_string(index=False))
    print(f"\nSeason constructor totals:")
    print(season_constructor[["constructor", "season_total", "per_race_avg"]].to_string(index=False))
    print(f"\nOutputs written to {output_dir}/")


if __name__ == "__main__":
    main()
