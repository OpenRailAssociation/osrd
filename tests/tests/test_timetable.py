from typing import Any
from collections import Counter

import pytest
from requests import Session

from .infra import Infra
from .services import EDITOAST_URL


def test_get_timetable(timetable_id: int, session: Session):
    response = session.get(f"{EDITOAST_URL}/timetable/{timetable_id}/train_schedules")
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
    session: Session,
):
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
                {
                    "at": "end",
                },
            ],
            "speed_limit_tag": "MA100",
            "start_time": "2024-05-22T08:00:00.000Z",
            "train_name": "with_stop",
        }
    ]

    stopping_train_schedule_response = session.post(
        f"{EDITOAST_URL}/timetable/{timetable_id}/train_schedules",
        json=stopping_train_schedule_payload,
    )
    stopping_train_schedule_response.raise_for_status()

    stopping_paced_train_payload = stopping_train_schedule_payload[0]
    stopping_paced_train_payload["start_time"] = paced_start_time
    stopping_paced_train_payload["paced"] = {"time_window": "PT2H", "interval": "PT15M"}
    stopping_paced_train_payload["path"] = [
        {"id": "start", "track": "TC1", "offset": 185000},
        {"id": "end", "track": "TD0", "offset": 24820000},
    ]

    stopping_paced_train_response = session.post(
        f"{EDITOAST_URL}/timetable/{timetable_id}/paced_trains",
        json=[stopping_paced_train_payload],
    )
    stopping_paced_train_response.raise_for_status()

    conflicts_response = session.get(
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
    session: Session,
):
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

    stopping_train_schedule_response = session.post(
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
    session.post(
        f"{EDITOAST_URL}/timetable/{timetable_id}/train_schedules",
        json=train_schedule_payload,
    ).raise_for_status()

    conflicts_response = session.get(
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
    simu_response = session.get(
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
    path_response = session.get(
        f"{EDITOAST_URL}/train_schedule/{train_id}/path/?infra_id={small_infra.id}"
    )
    path_response.raise_for_status()
    path_response_json = path_response.json()
    project_path_payload = {
        "ids": [train_id],
        "infra_id": small_infra.id,
        "track_section_ranges": path_response_json["path"]["track_section_ranges"],
    }
    response_project_path = session.post(
        f"{EDITOAST_URL}/train_schedule/project_path", json=project_path_payload
    )
    response_project_path.raise_for_status()


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
    session: Session,
):
    paced_train_payload = {
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
        "start_time": "2024-05-22T08:00:00.000Z",
        "train_name": "paced train",
        "paced": {"time_window": "PT1H", "interval": paced_train_interval},
        "exceptions": [],
    }

    paced_train_response = session.post(
        f"{EDITOAST_URL}timetable/{timetable_id}/paced_trains",
        json=[paced_train_payload],
    )
    paced_train_response.raise_for_status()

    conflicts_response = session.get(
        f"{EDITOAST_URL}timetable/{timetable_id}/conflicts/?infra_id={small_infra.id}"
    )
    conflicts_response.raise_for_status()

    actual_conflicts = {
        conflict["conflict_type"] for conflict in conflicts_response.json()
    }
    assert actual_conflicts == expected_conflict_types


# This test verifies that conflicts between a paced train and its exceptions are correctly detected.
# It focuses on scenarios where exceptions override the default behavior of paced train occurrences,
# either by changing the start time or modifying the train name at a specific index.
#
# The paced train is scheduled with:
#   - a base `start_time` of "2024-05-22T08:00:00.000Z"
#   - a pacing interval of 15 minutes ("PT15M")
#
# It defines 3 exceptions:
# 1. `created_ex_key` creates a new train occurrence at "2024-05-22T08:01:00.000Z"
# 2. `modified_ex_key` modifies the 3rd occurrence (index=2), normally scheduled at "2024-05-22T08:30:00.000Z"
# 3. `created_ex_conflict_modified_key` creates a new occurrence also at "2024-05-22T08:30:00.000Z"
#
# This results in two expected conflicts:
# - One between the base occurrence at 08:00 and the new exception at 08:01
# - Another between the modified occurrence at 08:30 and the newly created conflicting exception at the same time
def test_paced_train_with_exceptions_conflicts(
    small_infra: Infra,
    timetable_id: int,
    fast_rolling_stock: int,
    session: Session,
):
    paced_train_payload = {
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
        "start_time": "2024-05-22T08:00:00.000Z",
        "train_name": "paced train",
        "paced": {"time_window": "PT1H", "interval": "PT15M"},
        "exceptions": [
            {
                "key": "created_ex_key",
                "disabled": False,
                "start_time": {
                    "value": "2024-05-22T08:01:00.000Z",
                },
                "train_name": {"value": "created_exception_train_name"},
            },
            {
                "key": "modified_ex_key",
                "occurrence_index": 2,
                "disabled": False,
                "train_name": {"value": "modified_exception_train_name"},
            },
            {
                "key": "created_ex_conflict_modified_key",
                "disabled": False,
                "start_time": {
                    "value": "2024-05-22T08:30:00.000Z",
                },
                "train_name": {"value": "exception_train_name"},
            },
        ],
    }

    paced_train_response = session.post(
        f"{EDITOAST_URL}timetable/{timetable_id}/paced_trains",
        json=[paced_train_payload],
    )
    paced_train_response.raise_for_status()

    conflicts_response = session.get(
        f"{EDITOAST_URL}timetable/{timetable_id}/conflicts/?infra_id={small_infra.id}"
    )
    conflicts_response.raise_for_status()
    conflicts_response_json = conflicts_response.json()

    paced_train_occurrence_ids = [
        [
            {
                "index": c.get("index", None),
                "exception_key": c.get("exception_key", None),
            }
            for c in conflict["paced_train_occurrence_ids"]
        ]
        for conflict in conflicts_response_json
    ]

    expected_conflict_with_created_exception = [
        {"exception_key": None, "index": 0},
        {"exception_key": "created_ex_key", "index": None},
    ]

    expected_conflict_with_modified_exception = [
        {"exception_key": "modified_ex_key", "index": 2},
        {"exception_key": "created_ex_conflict_modified_key", "index": None},
    ]

    assert any(
        _match_conflict_lists(conflict, expected_conflict_with_created_exception)
        for conflict in paced_train_occurrence_ids
    ), "Missing expected_conflict_with_created_exception"

    assert any(
        _match_conflict_lists(conflict, expected_conflict_with_modified_exception)
        for conflict in paced_train_occurrence_ids
    ), "Missing expected_conflict_with_modified_exception"


def _match_conflict_lists(a, b):
    return Counter(frozenset(d.items()) for d in a) == Counter(
        frozenset(d.items()) for d in b
    )


def test_scheduled_points_with_incompatible_margins(
    small_infra: Infra,
    timetable_id: int,
    fast_rolling_stock: int,
    session: Session,
):
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
    response = session.post(
        f"{EDITOAST_URL}/timetable/{timetable_id}/train_schedules",
        json=train_schedule_payload,
    )
    response.raise_for_status()
    train_id = response.json()[0]["id"]
    response = session.get(
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
    session: Session,
):
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
    content = _get_train_schedule_simulation_response(
        small_infra, timetable_id, train_schedule_payload, session
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
        small_infra, timetable_id, train_schedule_payload, session
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
    infra: Infra,
    timetable_id: int,
    train_schedules_payload: list[dict[str, Any]],
    session: Session,
):
    ts_response = session.post(
        f"{EDITOAST_URL}/timetable/{timetable_id}/train_schedules",
        json=train_schedules_payload,
    )
    ts_response.raise_for_status()
    train_id = ts_response.json()[0]["id"]
    sim_response = session.get(
        f"{EDITOAST_URL}/train_schedule/{train_id}/simulation/?infra_id={infra.id}"
    )
    sim_response.raise_for_status()
    content = sim_response.json()
    return content
