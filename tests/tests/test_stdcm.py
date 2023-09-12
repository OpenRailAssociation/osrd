import json

import requests

from tests.utils.timetable import create_op_study, create_scenario

from .infra import Infra
from .path import Path
from .scenario import Scenario
from .services import EDITOAST_URL

_START = {"track_section": "TA2", "geo_coordinate": [-0.387122554630656, 49.4998]}
_MIDDLE = {"track_section": "TA5", "geo_coordinate": [-0.387122554630656, 49.4998]}
_STOP = {"track_section": "TH1", "geo_coordinate": [-0.095104854807785, 49.484]}


def _add_train(editoast_url: str, scenario: Scenario, rolling_stock_id: int, path_id: int, departure_time: int):
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
                "rolling_stock_id": rolling_stock_id,
                "speed_limit_category": "foo",
            }
        ],
    }
    r = requests.post(editoast_url + "train_schedule/standalone_simulation/", json=schedule_payload)
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Schedule error {r.status_code}: {r.content}, payload={json.dumps(schedule_payload)}")
    schedule_id = r.json()[0]
    return schedule_id


def test_empty_timetable(small_infra: Infra, foo_project_id: int, fast_rolling_stock: int):
    op_study = create_op_study(EDITOAST_URL, foo_project_id)
    _, timetable = create_scenario(EDITOAST_URL, small_infra.id, foo_project_id, op_study)
    requests.post(EDITOAST_URL + f"infra/{small_infra.id}/load")
    payload = {
        "infra_id": small_infra.id,
        "rolling_stock_id": fast_rolling_stock,
        "timetable_id": timetable,
        "start_time": 0,
        "name": "foo",
        "steps": [
            {"duration": 0.1, "waypoints": [_START]},
            {"duration": 0.1, "waypoints": [_STOP]},
        ],
        "comfort": "STANDARD",
        "standard_allowance": {"percentage": 0, "value_type": "percentage"},
        "margin_before": 0,
        "margin_after": 0,
        "maximum_departure_delay": 7200,
    }
    r = requests.post(EDITOAST_URL + "stdcm/", json=payload)

    assert r.status_code == 201


def test_empty_timetable_with_stop(small_infra: Infra, foo_project_id: int, fast_rolling_stock: int):
    op_study = create_op_study(EDITOAST_URL, foo_project_id)
    _, timetable = create_scenario(EDITOAST_URL, small_infra.id, foo_project_id, op_study)
    payload = {
        "infra_id": small_infra.id,
        "rolling_stock_id": fast_rolling_stock,
        "timetable_id": timetable,
        "start_time": 0,
        "name": "foo",
        "steps": [
            {"duration": 0.1, "waypoints": [_START]},
            {"duration": 42, "waypoints": [_MIDDLE]},
            {"duration": 0.1, "waypoints": [_STOP]},
        ],
        "comfort": "STANDARD",
        "standard_allowance": {"percentage": 0, "value_type": "percentage"},
        "margin_before": 0,
        "margin_after": 0,
        "maximum_departure_delay": 7200,
    }
    r = requests.post(EDITOAST_URL + "stdcm/", json=payload)
    r.raise_for_status()
    result = r.json()
    stops = result["simulation"]["base"]["stops"]
    assert len(stops) == 2
    assert stops[0]["duration"] == 42
    assert r.status_code == 201


def test_between_trains(small_scenario: Scenario, fast_rolling_stock: int, west_to_south_east_path: Path):
    _add_train(EDITOAST_URL, small_scenario, fast_rolling_stock, west_to_south_east_path.id, 0)
    _add_train(EDITOAST_URL, small_scenario, fast_rolling_stock, west_to_south_east_path.id, 10000)
    payload = {
        "infra_id": small_scenario.infra,
        "rolling_stock_id": fast_rolling_stock,
        "timetable_id": small_scenario.timetable,
        "start_time": 5000,
        "name": "foo",
        "steps": [
            {"duration": 0.1, "waypoints": [_START]},
            {"duration": 0.1, "waypoints": [_STOP]},
        ],
        "comfort": "STANDARD",
        "standard_allowance": {"percentage": 0, "value_type": "percentage"},
        "margin_before": 0,
        "margin_after": 0,
        "maximum_departure_delay": 7200,
    }
    r = requests.post(EDITOAST_URL + "stdcm/", json=payload)
    if r.status_code // 100 != 2:
        raise RuntimeError(f"STDCM error {r.status_code}: {r.content}")
