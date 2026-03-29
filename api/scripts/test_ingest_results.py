from types import SimpleNamespace

import pandas as pd
import pytest

from ingest_results import (
    IngestError,
    RaceStatus,
    build_qualifying_payload,
    build_race_payload,
    count_overtakes,
    find_race,
    map_status,
)


# --- map_status ---


class TestMapStatus:
    def test_finished_returns_classified(self):
        assert map_status("Finished") == RaceStatus.CLASSIFIED

    def test_lapped_one_lap_returns_classified(self):
        assert map_status("+1 Lap") == RaceStatus.CLASSIFIED

    def test_lapped_two_laps_returns_classified(self):
        assert map_status("+2 Laps") == RaceStatus.CLASSIFIED

    def test_retired_returns_dnf(self):
        assert map_status("Retired") == RaceStatus.DNF

    def test_engine_failure_returns_dnf(self):
        assert map_status("Engine") == RaceStatus.DNF

    def test_accident_returns_dnf(self):
        assert map_status("Accident") == RaceStatus.DNF

    def test_disqualified_returns_dsq(self):
        assert map_status("Disqualified") == RaceStatus.DSQ

    def test_none_returns_dns(self):
        assert map_status(None) == RaceStatus.DNS

    def test_nan_returns_dns(self):
        assert map_status(float("nan")) == RaceStatus.DNS

    def test_whitespace_is_stripped(self):
        assert map_status("  Finished  ") == RaceStatus.CLASSIFIED


# --- find_race ---


class TestFindRace:
    def test_returns_matching_race(self):
        races = [
            {"round": 1, "id": 10, "name": "Bahrain"},
            {"round": 2, "id": 20, "name": "Saudi Arabia"},
        ]
        result = find_race(races, 2)
        assert result["id"] == 20
        assert result["name"] == "Saudi Arabia"

    def test_raises_when_not_found(self):
        races = [{"round": 1, "id": 10, "name": "Bahrain"}]
        with pytest.raises(IngestError, match="round 5 not found"):
            find_race(races, 5)


# --- count_overtakes ---


def _make_laps(data: list[dict]) -> pd.DataFrame:
    """Helper to build a laps DataFrame with required columns."""
    df = pd.DataFrame(data)
    for col in ["PitInTime", "PitOutTime"]:
        if col not in df.columns:
            df[col] = None
    return df


class TestCountOvertakes:
    def test_simple_overtake(self):
        # VER passes NOR between lap 2 and lap 3
        laps = _make_laps([
            {"Driver": "VER", "LapNumber": 2, "Position": 2},
            {"Driver": "NOR", "LapNumber": 2, "Position": 1},
            {"Driver": "VER", "LapNumber": 3, "Position": 1},
            {"Driver": "NOR", "LapNumber": 3, "Position": 2},
        ])
        result = count_overtakes(laps)
        assert result["VER"] == 1
        assert result["NOR"] == 0

    def test_no_position_change_means_no_overtake(self):
        laps = _make_laps([
            {"Driver": "VER", "LapNumber": 2, "Position": 1},
            {"Driver": "NOR", "LapNumber": 2, "Position": 2},
            {"Driver": "VER", "LapNumber": 3, "Position": 1},
            {"Driver": "NOR", "LapNumber": 3, "Position": 2},
        ])
        result = count_overtakes(laps)
        assert result["VER"] == 0
        assert result["NOR"] == 0

    def test_lap_1_excluded(self):
        # Position change between lap 1 and lap 2 should not count
        laps = _make_laps([
            {"Driver": "VER", "LapNumber": 1, "Position": 2},
            {"Driver": "NOR", "LapNumber": 1, "Position": 1},
            {"Driver": "VER", "LapNumber": 2, "Position": 1},
            {"Driver": "NOR", "LapNumber": 2, "Position": 2},
        ])
        result = count_overtakes(laps)
        assert result["VER"] == 0
        assert result["NOR"] == 0

    def test_pit_lap_excluded(self):
        # VER appears to pass NOR but NOR pitted — should not count
        laps = _make_laps([
            {"Driver": "VER", "LapNumber": 2, "Position": 2, "PitInTime": None, "PitOutTime": None},
            {"Driver": "NOR", "LapNumber": 2, "Position": 1, "PitInTime": None, "PitOutTime": None},
            {"Driver": "VER", "LapNumber": 3, "Position": 1, "PitInTime": None, "PitOutTime": None},
            {"Driver": "NOR", "LapNumber": 3, "Position": 2, "PitInTime": pd.Timestamp("2024-01-01"), "PitOutTime": None},
        ])
        result = count_overtakes(laps)
        assert result["VER"] == 0
        assert result["NOR"] == 0

    def test_multiple_overtakes_across_laps(self):
        # VER overtakes NOR on lap 3, and PIA on lap 4
        laps = _make_laps([
            {"Driver": "VER", "LapNumber": 2, "Position": 3},
            {"Driver": "NOR", "LapNumber": 2, "Position": 2},
            {"Driver": "PIA", "LapNumber": 2, "Position": 1},
            {"Driver": "VER", "LapNumber": 3, "Position": 2},
            {"Driver": "NOR", "LapNumber": 3, "Position": 3},
            {"Driver": "PIA", "LapNumber": 3, "Position": 1},
            {"Driver": "VER", "LapNumber": 4, "Position": 1},
            {"Driver": "NOR", "LapNumber": 4, "Position": 3},
            {"Driver": "PIA", "LapNumber": 4, "Position": 2},
        ])
        result = count_overtakes(laps)
        assert result["VER"] == 2
        assert result["NOR"] == 0
        assert result["PIA"] == 0

    def test_empty_laps_returns_empty(self):
        assert count_overtakes(None) == {}
        assert count_overtakes(pd.DataFrame()) == {}


# --- build_qualifying_payload ---


def _make_session(results_data: list[dict]) -> SimpleNamespace:
    """Helper to build a mock session with a results DataFrame."""
    return SimpleNamespace(results=pd.DataFrame(results_data))


class TestBuildQualifyingPayload:
    def test_builds_payload(self):
        session = _make_session([
            {"Abbreviation": "VER", "Position": 1},
            {"Abbreviation": "NOR", "Position": 2},
        ])
        driver_map = {"VER": 10, "NOR": 20}
        payload, warnings = build_qualifying_payload(session, driver_map)

        assert len(payload) == 2
        assert payload[0] == {"driverId": 10, "position": 1}
        assert payload[1] == {"driverId": 20, "position": 2}
        assert warnings == []

    def test_skips_unknown_driver_with_warning(self):
        session = _make_session([
            {"Abbreviation": "VER", "Position": 1},
            {"Abbreviation": "XXX", "Position": 2},
        ])
        driver_map = {"VER": 10}
        payload, warnings = build_qualifying_payload(session, driver_map)

        assert len(payload) == 1
        assert len(warnings) == 1
        assert "XXX" in warnings[0]

    def test_skips_missing_position_with_warning(self):
        session = _make_session([
            {"Abbreviation": "VER", "Position": float("nan")},
        ])
        driver_map = {"VER": 10}
        payload, warnings = build_qualifying_payload(session, driver_map)

        assert len(payload) == 0
        assert len(warnings) == 1
        assert "VER" in warnings[0]


# --- build_race_payload ---


class TestBuildRacePayload:
    def test_classified_driver(self):
        session = _make_session([
            {"Abbreviation": "VER", "Status": "Finished", "GridPosition": 1,
             "Position": 1, "FastestLap": True},
        ])
        driver_map = {"VER": 10}
        overtakes = {"VER": 3}
        payload, warnings = build_race_payload(session, driver_map, overtakes)

        assert len(payload) == 1
        assert payload[0] == {
            "driverId": 10,
            "gridPosition": 1,
            "finishPosition": 1,
            "overtakes": 3,
            "fastestLap": True,
            "status": int(RaceStatus.CLASSIFIED),
        }
        assert warnings == []

    def test_dnf_driver_has_null_finish_position(self):
        session = _make_session([
            {"Abbreviation": "NOR", "Status": "Retired", "GridPosition": 3,
             "Position": float("nan"), "FastestLap": False},
        ])
        driver_map = {"NOR": 20}
        payload, warnings = build_race_payload(session, driver_map, {})

        assert payload[0]["finishPosition"] is None
        assert payload[0]["status"] == int(RaceStatus.DNF)

    def test_dsq_driver_has_null_finish_position(self):
        session = _make_session([
            {"Abbreviation": "VER", "Status": "Disqualified", "GridPosition": 1,
             "Position": 1, "FastestLap": False},
        ])
        driver_map = {"VER": 10}
        payload, warnings = build_race_payload(session, driver_map, {})

        assert payload[0]["finishPosition"] is None
        assert payload[0]["status"] == int(RaceStatus.DSQ)

    def test_lapped_driver_is_classified(self):
        session = _make_session([
            {"Abbreviation": "VER", "Status": "+1 Lap", "GridPosition": 15,
             "Position": 12, "FastestLap": False},
        ])
        driver_map = {"VER": 10}
        payload, warnings = build_race_payload(session, driver_map, {})

        assert payload[0]["finishPosition"] == 12
        assert payload[0]["status"] == int(RaceStatus.CLASSIFIED)

    def test_skips_unknown_driver_with_warning(self):
        session = _make_session([
            {"Abbreviation": "XXX", "Status": "Finished", "GridPosition": 1,
             "Position": 1, "FastestLap": False},
        ])
        payload, warnings = build_race_payload(session, {}, {})

        assert len(payload) == 0
        assert len(warnings) == 1
        assert "XXX" in warnings[0]

    def test_missing_overtakes_defaults_to_zero(self):
        session = _make_session([
            {"Abbreviation": "VER", "Status": "Finished", "GridPosition": 1,
             "Position": 1, "FastestLap": False},
        ])
        driver_map = {"VER": 10}
        payload, warnings = build_race_payload(session, driver_map, {})

        assert payload[0]["overtakes"] == 0

    def test_missing_grid_position_defaults_to_zero(self):
        session = _make_session([
            {"Abbreviation": "VER", "Status": "Finished", "GridPosition": float("nan"),
             "Position": 1, "FastestLap": False},
        ])
        driver_map = {"VER": 10}
        payload, warnings = build_race_payload(session, driver_map, {})

        assert payload[0]["gridPosition"] == 0
