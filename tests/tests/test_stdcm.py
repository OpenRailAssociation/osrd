import requests

from tests.utils.timetable import create_op_study, create_scenario

from .scenario import Scenario
from .services import API_URL
from .utils.simulation import _get_rolling_stock_id
from .utils.stdcm import add_train


def test_empty_timetable(small_infra_id: int, foo_project_id: int):
    op_study = create_op_study(API_URL, foo_project_id)
    _, timetable = create_scenario(API_URL, small_infra_id, foo_project_id, op_study)
    payload = {
        "infra": small_infra_id,
        "rolling_stock": _get_rolling_stock_id(API_URL, "fast_rolling_stock"),
        "timetable": timetable,
        "start_time": 0,
        "name": "foo",
        "start_points": [{"track_section": "TE1", "offset": 0}],
        "end_points": [{"track_section": "TE0", "offset": 0}],
    }
    r = requests.post(API_URL + "stdcm/", json=payload)
    if r.status_code // 100 != 2:
        raise RuntimeError(f"STDCM error {r.status_code}: {r.content}")


def test_between_trains(small_scenario: Scenario):
    start = {"track_section": "TE1", "offset": 0}
    stop = {"track_section": "TE0", "offset": 0}
    add_train(API_URL, small_scenario, start, stop, 0)
    add_train(API_URL, small_scenario, start, stop, 10000)
    payload = {
        "infra": small_scenario.infra,
        "rolling_stock": _get_rolling_stock_id(API_URL, "fast_rolling_stock"),
        "timetable": small_scenario.timetable,
        "start_time": 5000,
        "name": "foo",
        "start_points": [start],
        "end_points": [stop],
    }
    r = requests.post(API_URL + "stdcm/", json=payload)
    if r.status_code // 100 != 2:
        raise RuntimeError(f"STDCM error {r.status_code}: {r.content}")
