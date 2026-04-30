"""
ingest_results.py — Fetch F1 results via FastF1 and submit them to the
F1 Fantasy API.

Usage:
    cd api/scripts
    source .venv/bin/activate
    python3 ingest_results.py --round 1
    python3 ingest_results.py --round 1 --env prod
"""

import argparse
import os
import sys
from datetime import datetime, timezone
from enum import IntEnum
from itertools import combinations

import fastf1
import pandas as pd
import requests
from dotenv import dotenv_values

CACHE_DIR = ".ff1_cache"

WEEKEND_FORMAT_SPRINT = 1


class RacingStatus(IntEnum):
    """Mirrors the C# RacingStatus enum in Data/Entities/RacingStatus.cs."""

    CLASSIFIED = 0
    DNF = 1
    DSQ = 2
    DNS = 3


class IngestError(Exception):
    """Raised when the import process encounters a non-recoverable error."""


class ApiError(IngestError):
    """Raised when an API request fails."""

    def __init__(self, action: str, status_code: int, body: str):
        self.action = action
        self.status_code = status_code
        self.body = body
        super().__init__(f"{action} failed ({status_code}): {body}")


def create_api_session(api_key: str) -> requests.Session:
    """Create a requests session with API key headers."""
    session = requests.Session()
    session.headers.update({
        "X-Api-Key": api_key,
        "Content-Type": "application/json",
    })
    return session


def fetch_driver_mapping(session: requests.Session, api_url: str) -> dict[str, int]:
    """Fetch drivers from the API and return abbreviation -> id mapping."""
    resp = session.get(f"{api_url}/api/drivers")
    if resp.status_code >= 400:
        raise ApiError("Fetch drivers", resp.status_code, resp.text)
    return {d["abbreviation"]: d["id"] for d in resp.json()}


def fetch_current_season(session: requests.Session, api_url: str) -> dict:
    """Fetch the current active season from the API."""
    resp = session.get(f"{api_url}/api/seasons/current")
    if resp.status_code == 404:
        raise IngestError("No active season found")
    if resp.status_code >= 400:
        raise ApiError("Fetch current season", resp.status_code, resp.text)
    return resp.json()


def fetch_race_weekends(session: requests.Session, api_url: str, season_id: int) -> list[dict]:
    """Fetch all race weekends for the given season."""
    resp = session.get(f"{api_url}/api/seasons/{season_id}/race-weekends")
    if resp.status_code >= 400:
        raise ApiError("Fetch race weekends", resp.status_code, resp.text)
    return resp.json()


def find_race_weekend(race_weekends: list[dict], round_number: int) -> dict:
    """Find a race weekend by round number."""
    for rw in race_weekends:
        if rw["round"] == round_number:
            return rw
    raise IngestError(f"Race weekend for round {round_number} not found in API")


def load_session(year: int, round_number: int, session_name: str):
    """Load a FastF1 session. Returns the session object, or None on failure."""
    try:
        session = fastf1.get_session(year, round_number, session_name)
        session.load(telemetry=False, weather=False, messages=False)
        if session.results is None or session.results.empty:
            raise IngestError(
                f"No data available for {session_name} R{round_number} — session may not have occurred yet"
            )
        return session
    except IngestError:
        raise
    except Exception as exc:
        print(f"  Warning: could not load {session_name} R{round_number}: {exc}")
        return None


def _build_pit_laps(laps) -> set[tuple[str, int]]:
    """Build a set of (driver, lap_number) tuples where the driver pitted."""
    pit_laps = set()
    for _, row in laps.iterrows():
        if pd.notna(row.get("PitInTime")):
            pit_laps.add((row["Driver"], int(row["LapNumber"])))
        if pd.notna(row.get("PitOutTime")):
            pit_laps.add((row["Driver"], int(row["LapNumber"])))
    return pit_laps


def _either_pitted(
    driver_a: str, driver_b: str, prev_lap: int, curr_lap: int, pit_laps: set
) -> bool:
    """Check if either driver pitted on the previous or current lap."""
    return (
        (driver_a, curr_lap) in pit_laps
        or (driver_a, prev_lap) in pit_laps
        or (driver_b, curr_lap) in pit_laps
        or (driver_b, prev_lap) in pit_laps
    )


def get_fastest_lap_driver(laps) -> str | None:
    """Return the abbreviation of the driver who set the fastest lap, or None."""
    if laps is None or laps.empty:
        return None
    try:
        fastest = laps.pick_fastest()
        if fastest is not None and pd.notna(fastest.get("Driver")):
            return str(fastest["Driver"])
    except Exception:
        pass
    return None


def count_overtakes(laps) -> dict[str, int]:
    """Count on-track overtakes per driver from lap-by-lap position data.

    Uses pairwise comparison: an overtake occurs when driver A was behind
    driver B on lap N-1 but ahead on lap N, and neither driver pitted on
    those laps.

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
    pit_laps = _build_pit_laps(laps)
    sorted_laps = sorted(pos.index)
    overtakes = {driver: 0 for driver in drivers}

    for prev_lap, curr_lap in zip(sorted_laps, sorted_laps[1:]):
        if prev_lap <= 1:
            continue

        prev_positions = pos.loc[prev_lap]
        curr_positions = pos.loc[curr_lap]

        for driver_a, driver_b in combinations(drivers, 2):
            if _either_pitted(driver_a, driver_b, int(prev_lap), int(curr_lap), pit_laps):
                continue

            a_prev, a_curr = prev_positions[driver_a], curr_positions[driver_a]
            b_prev, b_curr = prev_positions[driver_b], curr_positions[driver_b]

            if pd.isna(a_prev) or pd.isna(a_curr) or pd.isna(b_prev) or pd.isna(b_curr):
                continue

            if a_prev > b_prev and a_curr < b_curr:
                overtakes[driver_a] += 1
            elif b_prev > a_prev and b_curr < a_curr:
                overtakes[driver_b] += 1

    return overtakes


def map_session_status(row) -> RacingStatus:
    """Map a FastF1 SessionResults row to a RacingStatus.

    Reads ClassifiedPosition for grand-prix and sprint sessions (FIA's official
    classification). Falls back to Position-NaN for qualifying, where FastF1
    leaves ClassifiedPosition empty.
    """
    cp = str(row.get("ClassifiedPosition") or "").strip()
    if cp == "":
        return (
            RacingStatus.CLASSIFIED
            if not pd.isna(row.get("Position"))
            else RacingStatus.DSQ
        )
    if cp.isdigit():
        return RacingStatus.CLASSIFIED
    if cp in ("D", "E"):
        return RacingStatus.DSQ
    if cp in ("W", "F"):
        return RacingStatus.DNS
    return RacingStatus.DNF


def build_qualifying_payload(
    session, driver_map: dict[str, int]
) -> tuple[list[dict], list[str]]:
    """Build the qualifying results payload from a FastF1 qualifying session.

    Returns (payload, warnings) where warnings lists any skipped drivers.
    """
    items = []
    warnings = []
    for _, row in session.results.iterrows():
        abbr = row.get("Abbreviation", "")
        driver_id = driver_map.get(abbr)
        if driver_id is None:
            warnings.append(f"Driver '{abbr}' not found in API, skipping")
            continue

        status = map_session_status(row)
        position = row.get("Position")
        position_value = (
            int(position) if status == RacingStatus.CLASSIFIED else None
        )

        items.append({
            "driverId": driver_id,
            "position": position_value,
            "status": int(status),
        })
    return items, warnings


def build_race_payload(
    session, driver_map: dict[str, int], overtakes: dict[str, int],
    fastest_lap_driver: str | None = None,
) -> tuple[list[dict], list[str]]:
    """Build the race/sprint results payload from a FastF1 session.

    Returns (payload, warnings) where warnings lists any skipped drivers.
    """
    items = []
    warnings = []
    for _, row in session.results.iterrows():
        abbr = row.get("Abbreviation", "")
        driver_id = driver_map.get(abbr)
        if driver_id is None:
            warnings.append(f"Driver '{abbr}' not found in API, skipping")
            continue

        status = map_session_status(row)

        grid = row.get("GridPosition")
        grid = 0 if pd.isna(grid) else int(grid)

        finish = row.get("Position")
        if pd.isna(finish) or status != RacingStatus.CLASSIFIED:
            finish_position = None
        else:
            finish_position = int(finish)

        fastest_lap = abbr == fastest_lap_driver

        items.append({
            "driverId": driver_id,
            "gridPosition": grid,
            "finishPosition": finish_position,
            "overtakes": overtakes.get(abbr, 0),
            "fastestLap": fastest_lap,
            "status": int(status),
        })
    return items, warnings


def submit_results(
    session: requests.Session,
    api_url: str,
    season_id: int,
    round_number: int,
    session_type: str,
    payload: list[dict],
) -> None:
    """PUT results to the API endpoint."""
    url = f"{api_url}/api/seasons/{season_id}/race-weekends/{round_number}/results/{session_type}"
    resp = session.put(url, json=payload)
    if resp.status_code >= 400:
        raise ApiError(f"Submit {session_type} results", resp.status_code, resp.text)
    print(f"  {session_type.capitalize()} results submitted ({len(payload)} drivers)")


def post_score(
    session: requests.Session,
    api_url: str,
    season_id: int,
    round_number: int,
) -> None:
    """POST to the scoring endpoint. Expects 204."""
    url = f"{api_url}/api/seasons/{season_id}/race-weekends/{round_number}/score"
    resp = session.post(url)
    if resp.status_code >= 400:
        raise ApiError(
            f"Score season {season_id} round {round_number}", resp.status_code, resp.text
        )
    print(f"  Scored race weekend (season {season_id}, round {round_number})")


def post_advance_lineups(
    session: requests.Session,
    api_url: str,
    season_id: int,
    round_number: int,
) -> None:
    """POST to the advance-lineups endpoint. Expects 204."""
    url = f"{api_url}/api/seasons/{season_id}/race-weekends/{round_number}/advance-lineups"
    resp = session.post(url)
    if resp.status_code >= 400:
        raise ApiError(
            f"Advance lineups season {season_id} round {round_number}",
            resp.status_code,
            resp.text,
        )
    print(
        f"  Lineups advanced (season {season_id}, round {round_number} → {round_number + 1})"
    )


def load_config(env: str) -> dict[str, str | None]:
    """Load and validate environment config."""
    env_file = f".env.{env}"
    config = dotenv_values(env_file)
    required_keys = ["F1_API_KEY", "F1_API_URL"]
    missing = [k for k in required_keys if not config.get(k)]
    if missing:
        raise IngestError(f"Missing keys in {env_file}: {', '.join(missing)}")
    return config


def report_warnings(warnings: list[str], session_name: str) -> None:
    """Print any warnings about skipped drivers."""
    if not warnings:
        return
    print(f"\n  Warnings for {session_name}:")
    for w in warnings:
        print(f"    - {w}")


def ingest(round_number: int, env: str) -> None:
    """Run the full import flow for a single round."""
    config = load_config(env)

    # Set up FastF1 cache
    os.makedirs(CACHE_DIR, exist_ok=True)
    fastf1.Cache.enable_cache(CACHE_DIR)

    api_session = create_api_session(config["F1_API_KEY"])
    api_url = config["F1_API_URL"]

    # Fetch current season to get season_id and year for FastF1
    print("Fetching current season...")
    current_season = fetch_current_season(api_session, api_url)
    season_id = current_season["id"]
    year = current_season["year"]
    print(f"  Season: {year} (id={season_id})")

    # Fetch driver mapping and race weekend info
    print("Fetching driver list...")
    driver_map = fetch_driver_mapping(api_session, api_url)
    print(f"  Found {len(driver_map)} drivers")

    print("Fetching race weekends...")
    race_weekends = fetch_race_weekends(api_session, api_url, season_id)
    race_weekend = find_race_weekend(race_weekends, round_number)
    has_sprint = race_weekend.get("weekendFormat", 0) == WEEKEND_FORMAT_SPRINT
    race_date = datetime.fromisoformat(race_weekend["raceDate"]).replace(tzinfo=timezone.utc)
    print(f"  Race weekend: {race_weekend['name']} (round={round_number}, hasSprint={has_sprint})")

    if datetime.now(timezone.utc) < race_date:
        raise IngestError(f"Race has not occurred yet (scheduled {race_date.date()})")

    # Qualifying
    print(f"Loading qualifying session (R{round_number})...")
    quali = load_session(year, round_number, "Qualifying")
    if quali is not None:
        payload, warnings = build_qualifying_payload(quali, driver_map)
        report_warnings(warnings, "qualifying")
        if payload:
            submit_results(api_session, api_url, season_id, round_number, "qualifying", payload)
            post_score(api_session, api_url, season_id, round_number)
    else:
        print("  Skipping qualifying — session not available")

    # Sprint
    if has_sprint:
        print(f"Loading sprint session (R{round_number})...")
        sprint = load_session(year, round_number, "Sprint")
        if sprint is not None:
            sprint_overtakes = count_overtakes(sprint.laps)
            sprint_fl = get_fastest_lap_driver(sprint.laps)
            payload, warnings = build_race_payload(sprint, driver_map, sprint_overtakes, sprint_fl)
            report_warnings(warnings, "sprint")
            if payload:
                submit_results(api_session, api_url, season_id, round_number, "sprint", payload)
                post_score(api_session, api_url, season_id, round_number)
        else:
            print("  Skipping sprint — session not available")

    # Grand Prix
    print(f"Loading race session (R{round_number})...")
    race_session = load_session(year, round_number, "Race")
    if race_session is not None:
        race_overtakes = count_overtakes(race_session.laps)
        race_fl = get_fastest_lap_driver(race_session.laps)
        payload, warnings = build_race_payload(race_session, driver_map, race_overtakes, race_fl)
        report_warnings(warnings, "grand-prix")
        if payload:
            submit_results(api_session, api_url, season_id, round_number, "grand-prix", payload)
            post_score(api_session, api_url, season_id, round_number)
            if round_number < len(race_weekends):
                post_advance_lineups(api_session, api_url, season_id, round_number)
            else:
                print(f"  Final round of season {season_id} — no lineups to advance")
    else:
        print("  Skipping race — session not available")

    print("Done!")


def main():
    parser = argparse.ArgumentParser(description="Import F1 results into the Fantasy API")
    parser.add_argument("--round", type=int, required=True, help="Round number")
    parser.add_argument(
        "--env",
        choices=["local", "prod"],
        default="local",
        help="Environment (default: local)",
    )
    args = parser.parse_args()

    try:
        ingest(args.round, args.env)
    except IngestError as exc:
        print(f"\nError: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
