import pytest
import requests

from .infra import Infra
from .services import EDITOAST_URL
from .timetable_v2 import TimetableV2


def test_get_timetable_v2(
    timetable_v2: TimetableV2,
):
    timetable_id = timetable_v2.id

    response = requests.get(f"{EDITOAST_URL}/v2/timetable/{timetable_id}/")
    assert response.status_code == 200
    json = response.json()
    assert "id" in json
    assert "train_ids" in json


@pytest.mark.parametrize(
    ["on_stop_signal", "expected_conflict_types"], [(False, {"Spacing", "Routing"}), (True, set())]
)
def test_conflicts(
    small_infra: Infra,
    timetable_v2: TimetableV2,
    fast_rolling_stock: int,
    on_stop_signal: bool,
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
                {"at": "stop", "on_stop_signal": on_stop_signal, "stop_for": "PT10M"},
                {
                    "at": "end",
                },
            ],
            "speed_limit_tag": "MA100",
            "start_time": "2024-05-22T08:00:00.000Z",
            "train_name": "with_stop",
        }
    ]
    response = requests.post(
        f"{EDITOAST_URL}/v2/timetable/{timetable_v2.id}/train_schedule", json=train_schedule_payload
    )
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
    response = requests.post(
        f"{EDITOAST_URL}/v2/timetable/{timetable_v2.id}/train_schedule", json=train_schedule_payload
    )
    response = requests.get(f"{EDITOAST_URL}/v2/timetable/{timetable_v2.id}/conflicts/?infra_id={small_infra.id}")
    assert response.status_code == 200
    actual_conflicts = {conflict["conflict_type"] for conflict in response.json()}
    assert actual_conflicts == expected_conflict_types


def test_scheduled_points_with_incompatible_margins(
    small_infra: Infra,
    timetable_v2: TimetableV2,
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
    response = requests.post(
        f"{EDITOAST_URL}/v2/timetable/{timetable_v2.id}/train_schedule", json=train_schedule_payload
    )
    response.raise_for_status()
    train_id = response.json()[0]["id"]
    response = requests.get(f"{EDITOAST_URL}/v2/train_schedule/{train_id}/simulation/?infra_id={small_infra.id}")
    response.raise_for_status()
    content = response.json()
    sim_output = content["final_output"]
    travel_time_seconds = sim_output["times"][-1] / 1_000

    # Should arrive roughly 4000s after departure, even if that doesn't fit the margins
    assert abs(travel_time_seconds - 4_000) < 2
