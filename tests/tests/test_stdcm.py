import json

import requests

from tests.utils.timetable import create_op_study, create_scenario

from .infra import Infra
from .path import Path
from .scenario import Scenario
from .services import API_URL, EDITOAST_URL

_START = {"track_section": "TA2", "geo_coordinate": [-0.387122554630656, 49.4998]}
_STOP = {"track_section": "TH1", "geo_coordinate": [-0.095104854807785, 49.484]}


def _add_train(base_url: str, scenario: Scenario, rolling_stock_id: int, path_id: int, departure_time: int):
    schedule_payload = {
        "timetable": scenario.timetable,
        "path": path_id,
        "schedules": [
            {
                "train_name": "foo",
                "labels": [],
                "allowances": [],
                "departure_time": departure_time,
                "initial_speed": 0,
                "rolling_stock": rolling_stock_id,
                "speed_limit_category": "foo",
            }
        ],
    }
    r = requests.post(base_url + "train_schedule/standalone_simulation/", json=schedule_payload)
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Schedule error {r.status_code}: {r.content}, payload={json.dumps(schedule_payload)}")
    schedule_id = r.json()["ids"][0]
    return schedule_id


def test_empty_timetable(small_infra: Infra, foo_project_id: int, fast_rolling_stock: int):
    op_study = create_op_study(EDITOAST_URL, foo_project_id)
    _, timetable = create_scenario(EDITOAST_URL, small_infra.id, foo_project_id, op_study)
    payload = {
        "infra": small_infra.id,
        "rolling_stock": fast_rolling_stock,
        "timetable": timetable,
        "start_time": 0,
        "name": "foo",
        "start_points": [_START],
        "end_points": [_STOP],
    }
    r = requests.post(API_URL + "stdcm/", json=payload)
    assert r.status_code == 200


def test_between_trains(small_scenario: Scenario, fast_rolling_stock: int, west_to_south_east_path: Path):
    _add_train(API_URL, small_scenario, fast_rolling_stock, west_to_south_east_path.id, 0)
    _add_train(API_URL, small_scenario, fast_rolling_stock, west_to_south_east_path.id, 10000)
    payload = {
        "infra": small_scenario.infra,
        "rolling_stock": fast_rolling_stock,
        "timetable": small_scenario.timetable,
        "start_time": 5000,
        "name": "foo",
        "start_points": [_START],
        "end_points": [_STOP],
    }
    r = requests.post(API_URL + "stdcm/", json=payload)
    if r.status_code // 100 != 2:
        raise RuntimeError(f"STDCM error {r.status_code}: {r.content}")
