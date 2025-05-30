from typing import Any

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


# A train schedule leaves on a top-branch of a 'Y' at 08:00.
# A paced train (every 15 minutes for 2 hours) leave on the other top-branch of a 'Y' after the train schedule at:
# 1. one second after the train schedule, expecting a spacing and a routing conflict
# 2. ten minutes after the train schedule, expecting no conflict
# 3. fifteen minutes and one second before, expecting the train schedule to arrive after the second occurrence with a spacing and a routing conflict
@pytest.mark.parametrize(
    ["paced_start_time", "expected_conflict_types"],
    [
        ("2024-05-22T08:00:01.000Z", {"Spacing", "Routing"}),
        ("2024-05-22T08:10:00.000Z", set()),
        ("2024-05-22T07:44:59.000Z", {"Spacing", "Routing"}),
    ],
)
def test_conflicts_with_paced_trains(
    small_infra: Infra,
    timetable_id: int,
    fast_rolling_stock: int,
    paced_start_time: str,
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
                {"key": "start", "track": "TC0", "offset": 185000},
                {"key": "stop", "track": "TC0", "offset": 685000},
                {"key": "end", "track": "TD0", "offset": 24820000},
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
            "start_time": "2024-05-22T08:00:00.000Z",
            "train_name": "with_stop",
        }
    ]

    stopping_train_schedule_response = requests.post(
        f"{EDITOAST_URL}/timetable/{timetable_id}/train_schedules",
        json=stopping_train_schedule_payload,
    )
    stopping_train_schedule_response.raise_for_status()

    stopping_paced_train_payload = stopping_train_schedule_payload[0]
    stopping_paced_train_payload["start_time"] = paced_start_time
    stopping_paced_train_payload["paced"] = {"time_window": "PT2H", "interval": "PT15M"}
    stopping_paced_train_payload["path"] = [
        {"key": "start", "track": "TC1", "offset": 185000},
        {"key": "end", "track": "TD0", "offset": 24820000},
    ]

    stopping_paced_train_response = requests.post(
        f"{EDITOAST_URL}/timetable/{timetable_id}/paced_trains",
        json=[stopping_paced_train_payload],
    )
    stopping_paced_train_response.raise_for_status()

    conflicts_response = requests.get(
        f"{EDITOAST_URL}/timetable/{timetable_id}/conflicts/?infra_id={small_infra.id}"
    )
    conflicts_response.raise_for_status()
    actual_conflicts = {
        conflict["conflict_type"] for conflict in conflicts_response.json()
    }
    assert actual_conflicts == expected_conflict_types


# Two train schedules are defined, one leaving at 08:00 and the second one
# leaving a second after. Each train is on a different top-branch of a 'Y'
# configuration and both train goes to the bottom branch of the 'Y'. The first
# train is exposed to a signal before the node. The parametrization of this test
# expose the three following scenarios:
# 1. The signal is opened, the first train will not stop, and therefore reserve
#    the block ahead of it. The second train will have both a spacing conflict (the
#    block in front is reserved) and in routing (the node position is oriented
#    for the first train).
# 2/3. The signal is a stop (or a short slip stop), the first train has a
#      reception on closed signal and does not reserve the block ahead,
#      therefore, the second train has not spacing or routing conflict.
@pytest.mark.parametrize(
    ["reception_signal", "expected_conflict_types"],
    [
        ("OPEN", {"Spacing", "Routing"}),
        ("STOP", set()),
        ("SHORT_SLIP_STOP", set()),
    ],
)
def test_conflicts_with_reception_on_closed_signal(
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
                {"key": "start", "track": "TC0", "offset": 185000},
                {"key": "stop", "track": "TC0", "offset": 685000},
                {"key": "end", "track": "TD0", "offset": 24820000},
            ],
            "power_restrictions": [],
            "rolling_stock_name": "fast_rolling_stock",
            "schedule": [
                {
                    "at": "start",
                },
                {
                    "at": "stop",
                    "reception_signal": reception_signal,
                    "stop_for": "PT10M",
                },
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
        f"{EDITOAST_URL}/timetable/{timetable_id}/train_schedules",
        json=stopping_train_schedule_payload,
    )
    stopping_train_schedule_response.raise_for_status()

    train_schedule_payload = [
        {
            "comfort": "STANDARD",
            "constraint_distribution": "STANDARD",
            "initial_speed": 0,
            "labels": [],
            "options": {"use_electrical_profiles": False},
            "path": [
                {"key": "start", "track": "TC1", "offset": 185000},
                {"key": "end", "track": "TD0", "offset": 24820000},
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
        f"{EDITOAST_URL}/timetable/{timetable_id}/train_schedules",
        json=train_schedule_payload,
    ).raise_for_status()

    conflicts_response = requests.get(
        f"{EDITOAST_URL}/timetable/{timetable_id}/conflicts/?infra_id={small_infra.id}"
    )
    conflicts_response.raise_for_status()
    actual_conflicts = {
        conflict["conflict_type"] for conflict in conflicts_response.json()
    }
    assert actual_conflicts == expected_conflict_types

    # Check GET reservation block starts at the right time for the signal protecting switch.
    # Train is received on closed (STOP/SHORT_SLIP_STOP) or OPEN signal.
    # The free-block requirement must start at the same time as the spacing requirement of the switch's zone
    # (signal sight for OPEN reception, or 20s before restart for STOP/SHORT_SLIP_STOP reception).
    train_id = stopping_train_schedule_response.json()[0]["id"]
    simu_response = requests.get(
        f"{EDITOAST_URL}/train_schedule/{train_id}/simulation/?infra_id={small_infra.id}"
    )
    simu_response.raise_for_status()
    simu_response_json = simu_response.json()
    switch_zone_spacing_requirement = [
        r
        for r in simu_response_json["final_output"]["spacing_requirements"]
        if r["zone"] == "zone.[DC4:INCREASING, DC5:INCREASING, DD0:DECREASING]"
    ]
    assert len(switch_zone_spacing_requirement) == 1
    path_response = requests.get(
        f"{EDITOAST_URL}/train_schedule/{train_id}/path/?infra_id={small_infra.id}"
    )
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
    response_project_path = requests.post(
        f"{EDITOAST_URL}/train_schedule/project_path", json=project_path_payload
    )
    response_project_path.raise_for_status()
    switch_signal_free_block_update = [
        u
        for u in response_project_path.json()[str(train_id)]["signal_updates"]
        if (u["signal_id"] == "SC4" and u["aspect_label"] == "VL")
    ]
    assert len(switch_signal_free_block_update) == 1
    assert (
        switch_signal_free_block_update[0]["time_start"]
        == switch_zone_spacing_requirement[0]["begin_time"]
    )


@pytest.mark.parametrize(
    ["paced_train_interval", "expected_conflict_types"],
    [
        ("PT15M", set()),  # Every half-hour, no conflict between each occurrences
        (
            "PT1M",
            {"Spacing"},
        ),  # Every minute, all occurrences will fight for space
    ],
)
def test_paced_train_conflicts(
    small_infra: Infra,
    timetable_id: int,
    fast_rolling_stock: int,
    paced_train_interval: str,
    expected_conflict_types: set[str],
):
    requests.post(f"{EDITOAST_URL}infra/{small_infra.id}/load").raise_for_status()
    paced_train_payload = {
        "comfort": "STANDARD",
        "constraint_distribution": "STANDARD",
        "initial_speed": 0,
        "labels": [],
        "options": {"use_electrical_profiles": False},
        "path": [
            {"key": "start", "track": "TC1", "offset": 185000},
            {"key": "end", "track": "TD0", "offset": 24820000},
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
        "start_time": "2024-05-22T08:00:00.000Z",
        "train_name": "paced train",
        "paced": {"time_window": "PT1H", "interval": paced_train_interval},
        "exceptions": [],
    }

    paced_train_response = requests.post(
        f"{EDITOAST_URL}timetable/{timetable_id}/paced_trains",
        json=[paced_train_payload],
    )
    paced_train_response.raise_for_status()

    conflicts_response = requests.get(
        f"{EDITOAST_URL}timetable/{timetable_id}/conflicts/?infra_id={small_infra.id}"
    )
    conflicts_response.raise_for_status()

    actual_conflicts = {
        conflict["conflict_type"] for conflict in conflicts_response.json()
    }
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
                {"key": "start", "track": "TC0", "offset": 185000},
                {"key": "end", "track": "TD0", "offset": 24820000},
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
    response = requests.post(
        f"{EDITOAST_URL}/timetable/{timetable_id}/train_schedules",
        json=train_schedule_payload,
    )
    response.raise_for_status()
    train_id = response.json()[0]["id"]
    response = requests.get(
        f"{EDITOAST_URL}/train_schedule/{train_id}/simulation/?infra_id={small_infra.id}"
    )
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
                {"key": "start", "track": "TH0", "offset": 820000},
                {"key": "end", "track": "TH1", "offset": 5000000},
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
    content = _get_train_schedule_simulation_response(
        small_infra, timetable_id, train_schedule_payload
    )
    assert content["mrsp"] == {
        "boundaries": [4180000, 4580000],
        "values": [
            {
                "speed": 27.778,
                "source": {"speed_limit_source_type": "given_train_tag", "tag": "E32C"},
            },
            {
                "speed": 22.222,
                "source": {"speed_limit_source_type": "fallback_tag", "tag": "MA100"},
            },
            {"speed": 80, "source": {"speed_limit_source_type": "unknown_tag"}},
        ],
    }

    train_schedule_payload[0]["speed_limit_tag"] = "MA80"
    content = _get_train_schedule_simulation_response(
        small_infra, timetable_id, train_schedule_payload
    )
    assert content["mrsp"] == {
        "boundaries": [3680000, 4580000],
        "values": [
            {"speed": 39.444, "source": {"speed_limit_source_type": "unknown_tag"}},
            {"speed": 31.111, "source": {"speed_limit_source_type": "unknown_tag"}},
            {"speed": 80, "source": {"speed_limit_source_type": "unknown_tag"}},
        ],
    }


def _get_train_schedule_simulation_response(
    infra: Infra, timetable_id: int, train_schedules_payload: list[dict[str, Any]]
):
    ts_response = requests.post(
        f"{EDITOAST_URL}/timetable/{timetable_id}/train_schedules",
        json=train_schedules_payload,
    )
    ts_response.raise_for_status()
    train_id = ts_response.json()[0]["id"]
    sim_response = requests.get(
        f"{EDITOAST_URL}/train_schedule/{train_id}/simulation/?infra_id={infra.id}"
    )
    sim_response.raise_for_status()
    content = sim_response.json()
    return content
