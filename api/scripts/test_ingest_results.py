from types import SimpleNamespace

import pandas as pd
import pytest

from unittest.mock import MagicMock, patch

from ingest_results import (
    IngestError,
    RacingStatus,
    build_qualifying_payload,
    build_race_payload,
    count_overtakes,
    find_race_weekend,
    get_fastest_lap_driver,
    ingest,
    load_session,
    map_status,
)


# --- map_status ---


class TestMapStatus:
    def test_finished_returns_classified(self):
        assert map_status("Finished") == RacingStatus.CLASSIFIED

    def test_lapped_one_lap_returns_classified(self):
        assert map_status("+1 Lap") == RacingStatus.CLASSIFIED

    def test_lapped_two_laps_returns_classified(self):
        assert map_status("+2 Laps") == RacingStatus.CLASSIFIED

    def test_retired_returns_dnf(self):
        assert map_status("Retired") == RacingStatus.DNF

    def test_engine_failure_returns_dnf(self):
        assert map_status("Engine") == RacingStatus.DNF

    def test_accident_returns_dnf(self):
        assert map_status("Accident") == RacingStatus.DNF

    def test_disqualified_returns_dsq(self):
        assert map_status("Disqualified") == RacingStatus.DSQ

    def test_none_returns_dns(self):
        assert map_status(None) == RacingStatus.DNS

    def test_nan_returns_dns(self):
        assert map_status(float("nan")) == RacingStatus.DNS

    def test_whitespace_is_stripped(self):
        assert map_status("  Finished  ") == RacingStatus.CLASSIFIED


# --- load_session ---


class TestLoadSession:
    def test_raises_ingest_error_when_results_empty(self):
        mock_session = MagicMock()
        mock_session.results = pd.DataFrame()
        with patch("ingest_results.fastf1.get_session", return_value=mock_session):
            with pytest.raises(IngestError, match="may not have occurred yet"):
                load_session(2026, 7, "Race")

    def test_returns_none_when_session_type_does_not_exist(self):
        with patch("ingest_results.fastf1.get_session", side_effect=Exception("Session type 'Sprint' does not exist")):
            result = load_session(2026, 1, "Sprint")
            assert result is None

    def test_returns_session_when_data_loaded(self):
        mock_session = MagicMock()
        mock_session.results = pd.DataFrame([{"Driver": "VER"}])
        with patch("ingest_results.fastf1.get_session", return_value=mock_session):
            result = load_session(2026, 1, "Race")
            assert result is mock_session


# --- find_race ---


class TestFindRace:
    def test_returns_matching_race(self):
        races = [
            {"round": 1, "id": 10, "name": "Bahrain"},
            {"round": 2, "id": 20, "name": "Saudi Arabia"},
        ]
        result = find_race_weekend(races, 2)
        assert result["id"] == 20
        assert result["name"] == "Saudi Arabia"

    def test_raises_when_not_found(self):
        races = [{"round": 1, "id": 10, "name": "Bahrain"}]
        with pytest.raises(IngestError, match="round 5 not found"):
            find_race_weekend(races, 5)


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


# --- get_fastest_lap_driver ---


class _FakeLaps:
    """Minimal mock for FastF1 laps with pick_fastest()."""

    def __init__(self, data, fastest_driver=None):
        self._df = pd.DataFrame(data)
        self._fastest_driver = fastest_driver
        self.empty = self._df.empty

    def pick_fastest(self):
        if self._fastest_driver is None:
            return None
        return pd.Series({"Driver": self._fastest_driver})


class TestGetFastestLapDriver:
    def test_returns_driver_abbreviation(self):
        laps = _FakeLaps([{"Driver": "VER"}], fastest_driver="VER")
        assert get_fastest_lap_driver(laps) == "VER"

    def test_returns_none_for_none_laps(self):
        assert get_fastest_lap_driver(None) is None

    def test_returns_none_for_empty_laps(self):
        laps = _FakeLaps([])
        assert get_fastest_lap_driver(laps) is None

    def test_returns_none_when_pick_fastest_returns_none(self):
        laps = _FakeLaps([{"Driver": "VER"}], fastest_driver=None)
        assert get_fastest_lap_driver(laps) is None


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
             "Position": 1},
        ])
        driver_map = {"VER": 10}
        overtakes = {"VER": 3}
        payload, warnings = build_race_payload(session, driver_map, overtakes, fastest_lap_driver="VER")

        assert len(payload) == 1
        assert payload[0] == {
            "driverId": 10,
            "gridPosition": 1,
            "finishPosition": 1,
            "overtakes": 3,
            "fastestLap": True,
            "status": int(RacingStatus.CLASSIFIED),
        }
        assert warnings == []

    def test_fastest_lap_false_when_not_matching(self):
        session = _make_session([
            {"Abbreviation": "VER", "Status": "Finished", "GridPosition": 1,
             "Position": 1},
        ])
        driver_map = {"VER": 10}
        payload, _ = build_race_payload(session, driver_map, {}, fastest_lap_driver="NOR")

        assert payload[0]["fastestLap"] is False

    def test_fastest_lap_false_when_none(self):
        session = _make_session([
            {"Abbreviation": "VER", "Status": "Finished", "GridPosition": 1,
             "Position": 1},
        ])
        driver_map = {"VER": 10}
        payload, _ = build_race_payload(session, driver_map, {})

        assert payload[0]["fastestLap"] is False

    def test_dnf_driver_has_null_finish_position(self):
        session = _make_session([
            {"Abbreviation": "NOR", "Status": "Retired", "GridPosition": 3,
             "Position": float("nan")},
        ])
        driver_map = {"NOR": 20}
        payload, warnings = build_race_payload(session, driver_map, {})

        assert payload[0]["finishPosition"] is None
        assert payload[0]["status"] == int(RacingStatus.DNF)

    def test_dsq_driver_has_null_finish_position(self):
        session = _make_session([
            {"Abbreviation": "VER", "Status": "Disqualified", "GridPosition": 1,
             "Position": 1},
        ])
        driver_map = {"VER": 10}
        payload, warnings = build_race_payload(session, driver_map, {})

        assert payload[0]["finishPosition"] is None
        assert payload[0]["status"] == int(RacingStatus.DSQ)

    def test_lapped_driver_is_classified(self):
        session = _make_session([
            {"Abbreviation": "VER", "Status": "+1 Lap", "GridPosition": 15,
             "Position": 12},
        ])
        driver_map = {"VER": 10}
        payload, warnings = build_race_payload(session, driver_map, {})

        assert payload[0]["finishPosition"] == 12
        assert payload[0]["status"] == int(RacingStatus.CLASSIFIED)

    def test_skips_unknown_driver_with_warning(self):
        session = _make_session([
            {"Abbreviation": "XXX", "Status": "Finished", "GridPosition": 1,
             "Position": 1},
        ])
        payload, warnings = build_race_payload(session, {}, {})

        assert len(payload) == 0
        assert len(warnings) == 1
        assert "XXX" in warnings[0]

    def test_missing_overtakes_defaults_to_zero(self):
        session = _make_session([
            {"Abbreviation": "VER", "Status": "Finished", "GridPosition": 1,
             "Position": 1},
        ])
        driver_map = {"VER": 10}
        payload, warnings = build_race_payload(session, driver_map, {})

        assert payload[0]["overtakes"] == 0

    def test_missing_grid_position_defaults_to_zero(self):
        session = _make_session([
            {"Abbreviation": "VER", "Status": "Finished", "GridPosition": float("nan"),
             "Position": 1},
        ])
        driver_map = {"VER": 10}
        payload, warnings = build_race_payload(session, driver_map, {})

        assert payload[0]["gridPosition"] == 0


# --- ingest orchestration: submit → score → (advance) ---


def _resp(status_code: int) -> MagicMock:
    """Build a mock response with the given status code."""
    resp = MagicMock()
    resp.status_code = status_code
    resp.text = ""
    return resp


def _captured_calls(session: MagicMock) -> list[tuple[str, str]]:
    """Return ('METHOD', url) tuples in call order from a mocked session."""
    out = []
    for call in session.method_calls:
        name = call[0]
        if name in ("put", "post", "get"):
            url = call[1][0] if call[1] else call[2].get("url", "")
            out.append((name.upper(), url))
    return out


def _make_ingest_mocks(monkeypatch, *, has_sprint: bool, total_rounds: int, round_number: int):
    """Patch ingest_results dependencies to drive `ingest()` through a single round.

    Returns the mocked api session so tests can inspect calls and patch responses.
    """
    api_session = MagicMock()
    # Default: every API call returns 204 / empty list as appropriate.
    api_session.put.return_value = _resp(204)
    api_session.post.return_value = _resp(204)

    monkeypatch.setattr(
        "ingest_results.load_config",
        lambda env: {"F1_API_KEY": "k", "F1_API_URL": "http://api"},
    )
    monkeypatch.setattr("ingest_results.create_api_session", lambda key: api_session)
    monkeypatch.setattr(
        "ingest_results.fetch_current_season",
        lambda s, u: {"id": 1, "year": 2026},
    )
    monkeypatch.setattr(
        "ingest_results.fetch_driver_mapping", lambda s, u: {"VER": 10}
    )
    weekends = [
        {
            "round": r,
            "id": 100 + r,
            "name": f"R{r}",
            "weekendFormat": (1 if has_sprint and r == round_number else 0),
            "raceDate": "2020-01-01T00:00:00",
        }
        for r in range(1, total_rounds + 1)
    ]
    monkeypatch.setattr(
        "ingest_results.fetch_race_weekends", lambda s, u, sid: weekends
    )
    monkeypatch.setattr("ingest_results.fastf1.Cache.enable_cache", lambda d: None)

    # Stub session loaders to return mock sessions; payload builders return one driver.
    fake_session = MagicMock()
    fake_session.results = pd.DataFrame([{"Abbreviation": "VER"}])
    fake_session.laps = None

    def _load(year, rn, name):
        if name == "Sprint" and not has_sprint:
            return None
        return fake_session

    monkeypatch.setattr("ingest_results.load_session", _load)
    monkeypatch.setattr(
        "ingest_results.build_qualifying_payload",
        lambda sess, dm: ([{"driverId": 10, "position": 1}], []),
    )
    monkeypatch.setattr(
        "ingest_results.build_race_payload",
        lambda sess, dm, ot, fl=None: (
            [{"driverId": 10, "gridPosition": 1, "finishPosition": 1,
              "overtakes": 0, "fastestLap": False, "status": 0}],
            [],
        ),
    )
    monkeypatch.setattr("ingest_results.count_overtakes", lambda laps: {})
    monkeypatch.setattr("ingest_results.get_fastest_lap_driver", lambda laps: None)

    return api_session


class TestIngestOrchestration:
    def test_gp_submit_then_score_then_advance_when_not_final(self, monkeypatch):
        api_session = _make_ingest_mocks(
            monkeypatch, has_sprint=False, total_rounds=5, round_number=1
        )

        ingest(round_number=1, env="local")

        write_calls = [c for c in _captured_calls(api_session) if c[0] in ("PUT", "POST")]
        gp_put = ("PUT", "http://api/api/seasons/1/race-weekends/1/results/grand-prix")
        score = ("POST", "http://api/api/seasons/1/race-weekends/1/score")
        advance = ("POST", "http://api/api/seasons/1/race-weekends/1/advance-lineups")
        idx = write_calls.index(gp_put)
        assert write_calls[idx + 1] == score
        assert write_calls[idx + 2] == advance

    def test_final_round_skips_advance_and_prints_message(self, monkeypatch, capsys):
        api_session = _make_ingest_mocks(
            monkeypatch, has_sprint=False, total_rounds=5, round_number=5
        )

        ingest(round_number=5, env="local")

        write_calls = [c for c in _captured_calls(api_session) if c[0] in ("PUT", "POST")]
        advance = ("POST", "http://api/api/seasons/1/race-weekends/5/advance-lineups")
        assert advance not in write_calls
        # GP score should still have been called.
        score = ("POST", "http://api/api/seasons/1/race-weekends/5/score")
        assert score in write_calls

        captured = capsys.readouterr()
        assert "Final round of season 1" in captured.out
        assert "no lineups to advance" in captured.out

    def test_advance_not_called_after_quali_or_sprint(self, monkeypatch):
        api_session = _make_ingest_mocks(
            monkeypatch, has_sprint=True, total_rounds=5, round_number=1
        )

        ingest(round_number=1, env="local")

        write_calls = [c for c in _captured_calls(api_session) if c[0] in ("PUT", "POST")]
        advance = ("POST", "http://api/api/seasons/1/race-weekends/1/advance-lineups")
        # Advance must appear after the GP put, not after quali or sprint.
        gp_put_idx = write_calls.index(
            ("PUT", "http://api/api/seasons/1/race-weekends/1/results/grand-prix")
        )
        assert write_calls.index(advance) > gp_put_idx
        # Exactly one advance call.
        assert sum(1 for c in write_calls if c == advance) == 1
