from typing import Any, Dict, List

import pytest
import requests

from .infra import Infra
from .services import EDITOAST_URL


def test_get_timetable(
    timetable_id: int,
):
    response = requests.get(f"{EDITOAST_URL}/timetable/{timetable_id}/train_schedules")
    assert response.status_code == 200
    json = response.json()
    assert "results" in json


@pytest.mark.parametrize(
    ["reception_signal", "expected_conflict_types"],
    [("OPEN", {"Spacing", "Routing"}), ("STOP", {"Spacing"}), ("SHORT_SLIP_STOP", {"Spacing"})],
)
def test_conflicts(
    small_infra: Infra,
    timetable_id: int,
    fast_rolling_stock: int,
    reception_signal: str,
    expected_conflict_types: set[str],
):
    requests.post(f"{EDITOAST_URL}infra/{small_infra.id}/load").raise_for_status()
    stopping_train_schedule_payload = [
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

    stopping_train_schedule_response = requests.post(
        f"{EDITOAST_URL}/timetable/{timetable_id}/train_schedules", json=stopping_train_schedule_payload
    )

    stopping_paced_train_payload = stopping_train_schedule_payload[0]
    stopping_paced_train_payload["start_time"] = "2024-05-22T08:05:00.000Z"
    stopping_paced_train_payload["paced"] = {"duration": "PT2H", "step": "PT15M"}

    stopping_paced_train_response = requests.post(
        f"{EDITOAST_URL}/timetable/{timetable_id}/paced_trains", json=[stopping_paced_train_payload]
    )
    stopping_paced_train_response.raise_for_status()

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
    requests.post(
        f"{EDITOAST_URL}/timetable/{timetable_id}/train_schedules", json=train_schedule_payload
    ).raise_for_status()

    conflicts_response = requests.get(f"{EDITOAST_URL}/timetable/{timetable_id}/conflicts/?infra_id={small_infra.id}")
    conflicts_response.raise_for_status()
    actual_conflicts = {conflict["conflict_type"] for conflict in conflicts_response.json()}
    assert actual_conflicts == expected_conflict_types

    # Check GET reservation block starts at the right time for the signal protecting switch.
    # Train is received on closed (STOP/SHORT_SLIP_STOP) or OPEN signal.
    # The free-block requirement must start at the same time as the spacing requirement of the switch's zone
    # (signal sight for OPEN reception, or 20s before restart for STOP/SHORT_SLIP_STOP reception).
    train_id = stopping_train_schedule_response.json()[0]["id"]
    simu_response = requests.get(f"{EDITOAST_URL}/train_schedule/{train_id}/simulation/?infra_id={small_infra.id}")
    simu_response.raise_for_status()
    simu_response_json = simu_response.json()
    switch_zone_spacing_requirement = [
        r
        for r in simu_response_json["final_output"]["spacing_requirements"]
        if r["zone"] == "zone.[DC4:INCREASING, DC5:INCREASING, DD0:DECREASING]"
    ]
    assert len(switch_zone_spacing_requirement) == 1
    path_response = requests.get(f"{EDITOAST_URL}/train_schedule/{train_id}/path/?infra_id={small_infra.id}")
    path_response.raise_for_status()
    path_response_json = path_response.json()
    project_path_payload = {
        "ids": [train_id],
        "infra_id": small_infra.id,
        "path": {
            "blocks": path_response_json["blocks"],
            "routes": path_response_json["routes"],
            "track_section_ranges": path_response_json["track_section_ranges"],
        },
    }
    response_project_path = requests.post(f"{EDITOAST_URL}/train_schedule/project_path", json=project_path_payload)
    response_project_path.raise_for_status()
    switch_signal_free_block_update = [
        u
        for u in response_project_path.json()[str(train_id)]["signal_updates"]
        if (u["signal_id"] == "SC4" and u["aspect_label"] == "VL")
    ]
    assert len(switch_signal_free_block_update) == 1
    assert switch_signal_free_block_update[0]["time_start"] == switch_zone_spacing_requirement[0]["begin_time"]


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
    response = requests.post(f"{EDITOAST_URL}/timetable/{timetable_id}/train_schedules", json=train_schedule_payload)
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
    ts_response = requests.post(
        f"{EDITOAST_URL}/timetable/{timetable_id}/train_schedules", json=train_schedules_payload
    )
    ts_response.raise_for_status()
    train_id = ts_response.json()[0]["id"]
    sim_response = requests.get(f"{EDITOAST_URL}/train_schedule/{train_id}/simulation/?infra_id={infra.id}")
    sim_response.raise_for_status()
    content = sim_response.json()
    return content
