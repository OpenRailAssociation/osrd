import datetime
import json

import requests

from tests.utils.timetable import create_op_study, create_scenario_v2

from .infra import Infra
from .scenario import Scenario
from .services import EDITOAST_URL

_START = {"track_section": "TA2", "geo_coordinate": [-0.387122554630656, 49.4998]}

_START_V2 = {"track": "TA2", "offset": 0}
_MIDDLE_V2 = {"track": "TA5", "offset": 0}
_STOP_V2 = {"track": "TH1", "offset": 0}


def _add_train(editoast_url: str, scenario: Scenario, rolling_stock_name: str, start_time: str):
    schedule_payload = [
        {
            "constraint_distribution": "STANDARD",
            "path": [
                {"offset": 837034, "track": "TA2", "id": "a"},
                {"offset": 4386000, "track": "TH1", "id": "b"},
            ],
            "rolling_stock_name": rolling_stock_name,
            "train_name": "foo",
            "speed_limit_tag": "foo",
            "start_time": start_time,
        }
    ]
    r = requests.post(editoast_url + f"v2/timetable/{scenario.timetable}/train_schedule/", json=schedule_payload)
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Schedule error {r.status_code}: {r.content}, payload={json.dumps(schedule_payload)}")
    schedule_id = r.json()[0]
    return schedule_id


def test_empty_timetable(small_infra: Infra, foo_project_id: int, fast_rolling_stock: int):
    op_study = create_op_study(EDITOAST_URL, foo_project_id)
    _, timetable = create_scenario_v2(EDITOAST_URL, small_infra.id, foo_project_id, op_study)
    requests.post(EDITOAST_URL + f"infra/{small_infra.id}/load")
    payload = {
        "rolling_stock_id": fast_rolling_stock,
        "timetable_id": timetable,
        "margin": "0%",
        "start_time": "2024-08-13T21:26:05.793Z",
        "steps": [
            {"duration": 100, "location": _START_V2},
            {"duration": 100, "location": _STOP_V2},
        ],
        "comfort": "STANDARD",
        "maximum_departure_delay": 7200000,
        "maximum_run_time": 43200000,
    }
    r = requests.post(EDITOAST_URL + f"v2/timetable/{timetable}/stdcm?infra={small_infra.id}", json=payload)
    assert r.status_code == 200


# TO ADAPT
def test_empty_timetable_with_stop(small_infra: Infra, foo_project_id: int, fast_rolling_stock: int):
    op_study = create_op_study(EDITOAST_URL, foo_project_id)
    _, timetable = create_scenario_v2(EDITOAST_URL, small_infra.id, foo_project_id, op_study)
    payload = {
        "rolling_stock_id": fast_rolling_stock,
        "timetable_id": timetable,
        "margin": "0%",
        "start_time": "2024-08-13T21:26:05.793Z",
        "steps": [
            {"duration": 100, "location": _START_V2},
            {"duration": 42000, "location": _MIDDLE_V2},
            {"duration": 100, "location": _STOP_V2},
        ],
        "comfort": "STANDARD",
        "maximum_departure_delay": 7200000,
        "maximum_run_time": 43200000,
    }
    r = requests.post(EDITOAST_URL + f"v2/timetable/{timetable}/stdcm?infra={small_infra.id}", json=payload)
    assert r.status_code == 200


def test_between_trains(small_scenario: Scenario, fast_rolling_stock: int):
    response = requests.get(EDITOAST_URL + f"light_rolling_stock/{fast_rolling_stock}")
    fast_rolling_stock_name = response.json()["name"]
    _add_train(EDITOAST_URL, small_scenario, fast_rolling_stock_name, "2024-08-13T22:31:36.377Z")
    _add_train(EDITOAST_URL, small_scenario, fast_rolling_stock_name, "2024-08-13T23:31:36.377Z")
    payload = {
        "rolling_stock_id": fast_rolling_stock,
        "timetable_id": small_scenario.timetable,
        "margin": "0%",
        "start_time": "2024-08-13T21:26:05.793Z",
        "steps": [
            {"duration": 100, "location": _START_V2},
            {"duration": 42000, "location": _MIDDLE_V2},
            {"duration": 100, "location": _STOP_V2},
        ],
        "comfort": "STANDARD",
        "maximum_departure_delay": 7200000,
        "maximum_run_time": 43200000,
    }
    r = requests.post(
        EDITOAST_URL + f"v2/timetable/{small_scenario.timetable}/stdcm?infra={small_scenario.infra}", json=payload
    )
    if r.status_code // 100 != 2:
        raise RuntimeError(f"STDCM error {r.status_code}: {r.content}")


def test_work_schedules(small_scenario_v2: Scenario, fast_rolling_stock: int):
    # This test is already using time schedules v2, it's required for work schedules
    requests.post(EDITOAST_URL + f"infra/{small_scenario_v2.infra}/load")
    start_time = datetime.datetime(2024, 1, 1, 14, 0, 0)
    end_time = start_time + datetime.timedelta(days=4)
    # TODO: we cannot delete work schedules for now, so let's give a unique name
    # to avoid collisions
    now = datetime.datetime.now()
    work_schedules_r = requests.post(
        EDITOAST_URL + "work_schedules/",
        json={
            "work_schedule_group_name": f"generic_group_{now}",
            "work_schedules": [
                {
                    "start_date_time": start_time.isoformat(),
                    "end_date_time": end_time.isoformat(),
                    "obj_id": "string",
                    "track_ranges": [{"begin": 0, "end": 100000, "track": _START["track_section"]}],
                    "work_schedule_type": "CATENARY",
                }
            ],
        },
    )
    work_schedules_response = work_schedules_r.json()

    payload = {
        "rolling_stock_id": fast_rolling_stock,
        "start_time": "2024-01-05T13:00:00+00:00",
        "maximum_departure_delay": 7200000,
        "maximum_run_time": 43200000,
        "time_gap_before": 0,
        "time_gap_after": 0,
        "steps": [
            {"duration": None, "location": _START_V2},
            {"duration": 1, "location": _STOP_V2},
        ],
        "comfort": "STANDARD",
        "margin": "0%",
        "work_schedule_group_id": work_schedules_response["work_schedule_group_id"],
    }
    url = f"{EDITOAST_URL}v2/timetable/{small_scenario_v2.timetable}/stdcm/?infra={small_scenario_v2.infra}"
    r = requests.post(url, json=payload)
    assert r.status_code == 200
    response = r.json()
    departure_time = datetime.datetime.fromisoformat(response["departure_time"].replace("Z", "+00:00"))
    assert departure_time >= end_time.astimezone(departure_time.tzinfo)
