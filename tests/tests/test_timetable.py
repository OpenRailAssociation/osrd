from dataclasses import dataclass
from typing import Any, List, Mapping, Optional

import pytest
import requests

from .path import Path
from .scenario import Scenario
from .services import EDITOAST_URL
from .utils.approximations import recursive_approx


@dataclass(frozen=True)
class _TrainScheduleSummary:
    id: int
    train_name: str
    departure_time: int
    arrival_time: float
    path_id: int
    timetable_id: int
    rolling_stock_id: int
    initial_speed: int
    labels: List[str]
    allowances: List[dict]
    speed_limit_tags: Optional[str]
    scheduled_points: List[dict]
    comfort: str
    options: Optional[dict]
    power_restriction_ranges: Optional[List[dict]]
    mechanical_energy_consumed: dict
    stops_count: int
    path_length: float
    invalid_reasons: List[str]


@dataclass(frozen=True)
class _TimetableResponse:
    id: int
    name: str
    train_schedule_summaries: List[dict]


def _two_train_simulation_payload(path_id: int, timetable_id: int, rolling_stock_id: int):
    return {
        "timetable": timetable_id,
        "path": path_id,
        "schedules": [
            {
                "train_name": "West to South East 1",
                "labels": ["new train", "west", "south east"],
                "departure_time": 3600,
                "initial_speed": 0,
                "rolling_stock_id": rolling_stock_id,
                "comfort": "STANDARD",
            },
            {
                "train_name": "West to South East 3",
                "labels": ["new train", "west", "south east"],
                "departure_time": 5100,
                "initial_speed": 0,
                "rolling_stock_id": rolling_stock_id,
                "comfort": "STANDARD",
            },
        ],
    }


@pytest.mark.parametrize(
    ["service_url", "expected_error"],
    [
        (
            EDITOAST_URL,
            {
                "type": "editoast:timetable:NotFound",
                "context": {"timetable_id": -1},
                "message": "Timetable '-1', could not be found",
                "status": 404,
            },
        ),
    ],
)
@pytest.mark.parametrize(["timetable_id", "status_code"], [(None, 200), (-1, 404)])
def test_get_timetable(
    small_scenario: Scenario,
    fast_rolling_stock: int,
    west_to_south_east_path: Path,
    service_url: str,
    timetable_id: Optional[int],
    status_code: int,
    expected_error: Mapping[str, Any],
):
    timetable_id = timetable_id or small_scenario.timetable

    response = requests.get(f"{service_url}timetable/{timetable_id}/")
    assert response.status_code == status_code
    if status_code == 404:
        assert expected_error == response.json()
        return

    timetable = _TimetableResponse(**response.json())
    assert timetable.name == "timetable"
    assert len(timetable.train_schedule_summaries) == 0

    # add simulation
    simulation_response = requests.post(
        f"{EDITOAST_URL}train_schedule/standalone_simulation/",
        json=_two_train_simulation_payload(west_to_south_east_path.id, small_scenario.timetable, fast_rolling_stock),
    )
    assert simulation_response.status_code == 200
    simulation = simulation_response.json()
    assert len(simulation) == 2
    response = requests.get(f"{service_url}timetable/{timetable_id}/")
    timetable = _TimetableResponse(**response.json())
    assert timetable.id == small_scenario.timetable
    assert timetable.name == "timetable"
    assert len(timetable.train_schedule_summaries) == 2
    expected_schedules = [
        _TrainScheduleSummary(
            id=simulation[0],
            train_name="West to South East 1",
            departure_time=3600,
            arrival_time=4384.388065381583,
            path_id=west_to_south_east_path.id,
            timetable_id=small_scenario.timetable,
            rolling_stock_id=fast_rolling_stock,
            initial_speed=0,
            labels=["new train", "west", "south east"],
            allowances=[],
            speed_limit_tags=None,
            scheduled_points=[],
            comfort="STANDARD",
            options=None,
            power_restriction_ranges=None,
            mechanical_energy_consumed={"base": 6041639227.0, "eco": None},
            stops_count=1,
            path_length=45549.566000000006,
            invalid_reasons=[],
        ),
        _TrainScheduleSummary(
            id=simulation[1],
            train_name="West to South East 3",
            departure_time=5100,
            arrival_time=5884.388065381583,
            path_id=west_to_south_east_path.id,
            timetable_id=small_scenario.timetable,
            rolling_stock_id=fast_rolling_stock,
            initial_speed=0,
            labels=["new train", "west", "south east"],
            allowances=[],
            speed_limit_tags=None,
            scheduled_points=[],
            comfort="STANDARD",
            options=None,
            power_restriction_ranges=None,
            mechanical_energy_consumed={"base": 6041639227.0, "eco": None},
            stops_count=1,
            path_length=45549.566000000006,
            invalid_reasons=[],
        ),
    ]
    actual_results = [_TrainScheduleSummary(**train_schedule) for train_schedule in timetable.train_schedule_summaries]
    recursive_approx([x.__dict__ for x in expected_schedules], [x.__dict__ for x in actual_results])
