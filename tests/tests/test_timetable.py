from dataclasses import dataclass
from typing import Any, Iterable, Mapping, Optional

import pytest
import requests

from .path import Path
from .scenario import Scenario
from .services import API_URL, EDITOAST_URL


@dataclass(frozen=True)
class _TrainScheduleDetails:
    id: int
    train_name: str
    departure_time: int
    train_path: int


@dataclass(frozen=True)
class _TimetableResponse:
    id: int
    name: str
    train_schedules: Iterable[_TrainScheduleDetails]


@dataclass(frozen=True)
class _SimulationResponse:
    ids: Iterable[int]


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
                "rolling_stock": rolling_stock_id,
                "comfort": "STANDARD",
            },
            {
                "train_name": "West to South East 3",
                "labels": ["new train", "west", "south east"],
                "departure_time": 5100,
                "initial_speed": 0,
                "rolling_stock": rolling_stock_id,
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
            },
        ),
        (API_URL, {"detail": "Not found."}),
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
    assert timetable.name == "timetable for Scenario test 1"
    assert len(timetable.train_schedules) == 0

    # add simulation
    simulation_response = requests.post(
        f"{API_URL}train_schedule/standalone_simulation/",
        json=_two_train_simulation_payload(west_to_south_east_path.id, small_scenario.timetable, fast_rolling_stock),
    )
    assert simulation_response.status_code == 201
    simulation = _SimulationResponse(**simulation_response.json())
    assert len(simulation.ids) == 2

    response = requests.get(f"{service_url}timetable/{timetable_id}/")
    timetable = _TimetableResponse(**response.json())
    assert timetable.id == small_scenario.timetable
    assert timetable.name == "timetable for Scenario test 1"
    assert len(timetable.train_schedules) == 2
    expected_schedules = [
        _TrainScheduleDetails(simulation.ids[0], "West to South East 1", 3600, west_to_south_east_path.id),
        _TrainScheduleDetails(simulation.ids[1], "West to South East 3", 5100, west_to_south_east_path.id),
    ]
    assert expected_schedules == [
        _TrainScheduleDetails(**train_schedule) for train_schedule in timetable.train_schedules
    ]
