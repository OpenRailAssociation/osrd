from dataclasses import dataclass
from typing import Any, Iterable

import requests

from .scenario import Scenario
from .services import API_URL
from .utils.simulation import _get_rolling_stock_id


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
class _PathfindingResponse:
    id: int
    owner: str
    created: str
    slopes: Iterable[Any]
    curves: Iterable[Any]
    steps: Iterable[Any]
    geographic: Any
    schematic: Any


@dataclass(frozen=True)
class _SimulationResponse:
    ids: Iterable[int]


def _west_to_south_east_payload(infra_id: int, rolling_stock_id: int):
    return {
        "infra": infra_id,
        "steps": [
            {"duration": 0, "waypoints": [{"track_section": "TA2", "geo_coordinate": [-0.387122554630656, 49.4998]}]},
            {"duration": 1, "waypoints": [{"track_section": "TH1", "geo_coordinate": [-0.095104854807785, 49.484]}]},
        ],
        "rolling_stocks": [rolling_stock_id],
    }


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


def test_get_timetable(small_scenario: Scenario):
    # empty timetable
    response = requests.get(f"{API_URL}timetable/{small_scenario.timetable}/")
    assert response.status_code == 200
    timetable = _TimetableResponse(**response.json())
    assert timetable.name == "timetable for foo"

    # add simulation
    rolling_stock_id = _get_rolling_stock_id(API_URL, "fast_rolling_stock")
    path_finding_response = requests.post(
        f"{API_URL}pathfinding/", json=_west_to_south_east_payload(small_scenario.infra, rolling_stock_id)
    )
    assert path_finding_response.status_code == 201
    path_finding = _PathfindingResponse(**path_finding_response.json())

    simulation_response = requests.post(
        f"{API_URL}train_schedule/standalone_simulation/",
        json=_two_train_simulation_payload(path_finding.id, small_scenario.timetable, rolling_stock_id),
    )
    assert simulation_response.status_code == 201
    simulation = _SimulationResponse(**simulation_response.json())
    assert len(simulation.ids) == 2

    # check two trains are added in timetable
    response = requests.get(f"{API_URL}timetable/{small_scenario.timetable}/")
    assert response.status_code == 200
    timetable = _TimetableResponse(**response.json())
    assert timetable.id == small_scenario.timetable
    assert timetable.name == "timetable for foo"
    assert len(timetable.train_schedules) == 2
    expected_schedules = [
        _TrainScheduleDetails(simulation.ids[0], "West to South East 1", 3600, path_finding.id),
        _TrainScheduleDetails(simulation.ids[1], "West to South East 3", 5100, path_finding.id),
    ]
    assert expected_schedules == [
        _TrainScheduleDetails(**train_schedule) for train_schedule in timetable.train_schedules
    ]
