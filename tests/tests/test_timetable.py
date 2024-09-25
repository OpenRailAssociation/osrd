from typing import Any, Dict, List

import pytest
import requests

from .infra import Infra
from .services import EDITOAST_URL


def test_get_timetable(
    timetable_id: int,
):
    response = requests.get(f"{EDITOAST_URL}/timetable/{timetable_id}/")
    assert response.status_code == 200
    json = response.json()
    assert "timetable_id" in json
    assert "train_ids" in json


@pytest.mark.parametrize(
    ["reception_signal", "expected_conflict_types"],
    [("OPEN", {"Spacing", "Routing"}), ("STOP", set()), ("SHORT_SLIP_STOP", set())],
)
def test_conflicts(
    small_infra: Infra,
    timetable_id: int,
    fast_rolling_stock: int,
    reception_signal: str,
    expected_conflict_types: set[str],
):
    requests.post(f"{EDITOAST_URL}infra/{small_infra.id}/load").raise_for_status()
    train_schedule_payload = [
        {
            "comfort": "STANDARD",
            "constraint_distribution": "STANDARD",
            "initial_speed": 0,
            "labels": [],
            "options": {"use_electrical_profiles": False},
            "path": [
                {"id": "start", "track": "TC0", "offset": 185000},
                {"id": "stop", "track": "TC0", "offset": 685000},
                {"id": "end", "track": "TD0", "offset": 24820000},
            ],
            "power_restrictions": [],
            "rolling_stock_name": "fast_rolling_stock",
            "schedule": [
                {
                    "at": "start",
                },
                {"at": "stop", "reception_signal": reception_signal, "stop_for": "PT10M"},
                {
                    "at": "end",
                },
            ],
            "speed_limit_tag": "MA100",
            "start_time": "2024-05-22T08:00:00.000Z",
            "train_name": "with_stop",
        }
    ]
    requests.post(f"{EDITOAST_URL}/timetable/{timetable_id}/train_schedule", json=train_schedule_payload)
    train_schedule_payload = [
        {
            "comfort": "STANDARD",
            "constraint_distribution": "STANDARD",
            "initial_speed": 0,
            "labels": [],
            "options": {"use_electrical_profiles": False},
            "path": [
                {"id": "start", "track": "TC1", "offset": 185000},
                {"id": "end", "track": "TD0", "offset": 24820000},
            ],
            "power_restrictions": [],
            "rolling_stock_name": "fast_rolling_stock",
            "schedule": [
                {
                    "at": "start",
                },
                {
                    "at": "end",
                },
            ],
            "speed_limit_tag": "MA100",
            "start_time": "2024-05-22T08:00:01.000Z",
            "train_name": "pass",
        }
    ]
    requests.post(f"{EDITOAST_URL}/timetable/{timetable_id}/train_schedule", json=train_schedule_payload)
    response = requests.get(f"{EDITOAST_URL}/timetable/{timetable_id}/conflicts/?infra_id={small_infra.id}")
    assert response.status_code == 200
    actual_conflicts = {conflict["conflict_type"] for conflict in response.json()}
    assert actual_conflicts == expected_conflict_types


def test_scheduled_points_with_incompatible_margins(
    small_infra: Infra,
    timetable_id: int,
    fast_rolling_stock: int,
):
    requests.post(f"{EDITOAST_URL}infra/{small_infra.id}/load").raise_for_status()
    train_schedule_payload = [
        {
            "comfort": "STANDARD",
            "constraint_distribution": "STANDARD",
            "initial_speed": 0,
            "labels": [],
            "options": {"use_electrical_profiles": False},
            "path": [
                {"id": "start", "track": "TC0", "offset": 185000},
                {"id": "end", "track": "TD0", "offset": 24820000},
            ],
            "power_restrictions": [],
            "rolling_stock_name": "fast_rolling_stock",
            "schedule": [
                {
                    "at": "start",
                },
                {
                    "at": "end",
                    "arrival": "PT4000S",
                },
            ],
            "margins": {"boundaries": [], "values": ["100%"]},
            "speed_limit_tag": "MA100",
            "start_time": "2024-05-22T08:00:00.000Z",
            "train_name": "name",
        }
    ]
    response = requests.post(f"{EDITOAST_URL}/timetable/{timetable_id}/train_schedule", json=train_schedule_payload)
    response.raise_for_status()
    train_id = response.json()[0]["id"]
    response = requests.get(f"{EDITOAST_URL}/train_schedule/{train_id}/simulation/?infra_id={small_infra.id}")
    response.raise_for_status()
    content = response.json()
    sim_output = content["final_output"]
    travel_time_seconds = sim_output["times"][-1] / 1_000

    # Should arrive roughly 4000s after departure, even if that doesn't fit the margins
    assert abs(travel_time_seconds - 4_000) < 2


def test_mrsp_sources(
    small_infra: Infra,
    timetable_id: int,
    fast_rolling_stock: int,
):
    requests.post(f"{EDITOAST_URL}infra/{small_infra.id}/load").raise_for_status()
    train_schedule_payload = [
        {
            "comfort": "STANDARD",
            "constraint_distribution": "STANDARD",
            "initial_speed": 0,
            "labels": [],
            "options": {"use_electrical_profiles": False},
            "path": [
                {"id": "start", "track": "TH0", "offset": 820000},
                {"id": "end", "track": "TH1", "offset": 5000000},
            ],
            "power_restrictions": [],
            "rolling_stock_name": "fast_rolling_stock",
            "schedule": [
                {
                    "at": "start",
                },
                {
                    "at": "end",
                },
            ],
            "margins": {"boundaries": [], "values": ["3%"]},
            "speed_limit_tag": "E32C",
            "start_time": "2024-05-22T08:00:00.000Z",
            "train_name": "name",
        }
    ]
    content = _get_train_schedule_simulation_response(small_infra, timetable_id, train_schedule_payload)
    assert content["mrsp"] == {
        "boundaries": [4180000, 4580000],
        "values": [
            {"speed": 27.778, "source": {"speed_limit_source_type": "given_train_tag", "tag": "E32C"}},
            {"speed": 22.222, "source": {"speed_limit_source_type": "fallback_tag", "tag": "MA100"}},
            {"speed": 80, "source": {"speed_limit_source_type": "unknown_tag"}},
        ],
    }

    train_schedule_payload[0]["speed_limit_tag"] = "MA80"
    content = _get_train_schedule_simulation_response(small_infra, timetable_id, train_schedule_payload)
    assert content["mrsp"] == {
        "boundaries": [3680000, 4580000],
        "values": [
            {"speed": 39.444, "source": {"speed_limit_source_type": "unknown_tag"}},
            {"speed": 31.111, "source": {"speed_limit_source_type": "unknown_tag"}},
            {"speed": 80, "source": {"speed_limit_source_type": "unknown_tag"}},
        ],
    }


def _get_train_schedule_simulation_response(
    infra: Infra, timetable_id: int, train_schedules_payload: List[Dict[str, Any]]
):
    ts_response = requests.post(f"{EDITOAST_URL}/timetable/{timetable_id}/train_schedule", json=train_schedules_payload)
    ts_response.raise_for_status()
    train_id = ts_response.json()[0]["id"]
    sim_response = requests.get(f"{EDITOAST_URL}/train_schedule/{train_id}/simulation/?infra_id={infra.id}")
    sim_response.raise_for_status()
    content = sim_response.json()
    return content
