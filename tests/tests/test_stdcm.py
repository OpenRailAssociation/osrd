import datetime
import json
from typing import Any, Dict

import requests

from tests.utils.timetable import create_op_study, create_scenario

from .infra import Infra
from .scenario import Scenario
from .services import EDITOAST_URL

_START = {"track": "TA2", "offset": 0}
_MIDDLE = {"track": "TA5", "offset": 0}
_STOP = {"track": "TH1", "offset": 0}


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
    r = requests.post(editoast_url + f"/timetable/{scenario.timetable}/train_schedule/", json=schedule_payload)
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Schedule error {r.status_code}: {r.content}, payload={json.dumps(schedule_payload)}")
    schedule_id = r.json()[0]
    return schedule_id


def test_empty_timetable(small_infra: Infra, foo_project_id: int, fast_rolling_stock: int):
    op_study = create_op_study(EDITOAST_URL, foo_project_id)
    _, timetable = create_scenario(EDITOAST_URL, small_infra.id, foo_project_id, op_study)
    requests.post(EDITOAST_URL + f"infra/{small_infra.id}/load")
    payload = {
        "rolling_stock_id": fast_rolling_stock,
        "timetable_id": timetable,
        "margin": "0%",
        "start_time": "2024-08-13T21:26:05.793Z",
        "steps": [
            {"duration": 100, "location": _START},
            {"duration": 100, "location": _STOP},
        ],
        "comfort": "STANDARD",
        "maximum_departure_delay": 7200000,
        "maximum_run_time": 43200000,
    }
    r = requests.post(EDITOAST_URL + f"/timetable/{timetable}/stdcm?infra={small_infra.id}", json=payload)
    assert r.status_code == 200


# TO ADAPT
def test_empty_timetable_with_stop(small_infra: Infra, foo_project_id: int, fast_rolling_stock: int):
    op_study = create_op_study(EDITOAST_URL, foo_project_id)
    _, timetable = create_scenario(EDITOAST_URL, small_infra.id, foo_project_id, op_study)
    payload = {
        "rolling_stock_id": fast_rolling_stock,
        "timetable_id": timetable,
        "margin": "0%",
        "start_time": "2024-08-13T21:26:05.793Z",
        "steps": [
            {"duration": 100, "location": _START},
            {"duration": 42000, "location": _MIDDLE},
            {"duration": 100, "location": _STOP},
        ],
        "comfort": "STANDARD",
        "maximum_departure_delay": 7200000,
        "maximum_run_time": 43200000,
    }
    r = requests.post(EDITOAST_URL + f"/timetable/{timetable}/stdcm?infra={small_infra.id}", json=payload)
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
            {"duration": 100, "location": _START},
            {"duration": 42000, "location": _MIDDLE},
            {"duration": 100, "location": _STOP},
        ],
        "comfort": "STANDARD",
        "maximum_departure_delay": 7200000,
        "maximum_run_time": 43200000,
    }
    r = requests.post(
        EDITOAST_URL + f"/timetable/{small_scenario.timetable}/stdcm?infra={small_scenario.infra}", json=payload
    )
    if r.status_code // 100 != 2:
        raise RuntimeError(f"STDCM error {r.status_code}: {r.content}")


def test_work_schedules(small_scenario: Scenario, fast_rolling_stock: int):
    requests.post(EDITOAST_URL + f"infra/{small_scenario.infra}/load")
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
                    "track_ranges": [{"begin": 0, "end": 100000, "track": _START["track"]}],
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
            {"duration": None, "location": _START},
            {"duration": 1, "location": _STOP},
        ],
        "comfort": "STANDARD",
        "margin": "0%",
        "work_schedule_group_id": work_schedules_response["work_schedule_group_id"],
    }
    url = f"{EDITOAST_URL}timetable/{small_scenario.timetable}/stdcm/?infra={small_scenario.infra}"
    r = requests.post(url, json=payload)
    assert r.status_code == 200
    response = r.json()
    departure_time = datetime.datetime.fromisoformat(response["departure_time"].replace("Z", "+00:00"))
    assert departure_time >= end_time.astimezone(departure_time.tzinfo)


def test_mrsp_sources(
    small_infra: Infra,
    timetable_id: int,
    fast_rolling_stock: int,
):
    requests.post(f"{EDITOAST_URL}infra/{small_infra.id}/load").raise_for_status()
    stdcm_payload = {
        "start_time": "2024-05-22T10:00:00.000Z",
        "rolling_stock_id": fast_rolling_stock,
        "comfort": "STANDARD",
        "maximum_departure_delay": 86400000,
        "maximum_run_time": 86400000,
        "steps": [
            {"location": {"track": "TH0", "offset": 820000}},
            {"duration": 1, "location": {"track": "TH1", "offset": 5000000}},
        ],
        "speed_limit_tags": "E32C",
        "time_gap_before": 3600000,
        "time_gap_after": 3600000,
        "margin": "0%",
        "standard_allowance": "3%",
    }

    content = _get_stdcm_response(small_infra, timetable_id, stdcm_payload)
    assert content["simulation"]["mrsp"] == {
        "boundaries": [4180000, 4580000],
        "values": [
            {"speed": 27.778, "source": {"speed_limit_source_type": "given_train_tag", "tag": "E32C"}},
            {"speed": 22.222, "source": {"speed_limit_source_type": "fallback_tag", "tag": "MA100"}},
            {"speed": 80.0, "source": {"speed_limit_source_type": "unknown_tag"}},
        ],
    }

    stdcm_payload["speed_limit_tags"] = "MA80"
    content = _get_stdcm_response(small_infra, timetable_id, stdcm_payload)
    assert content["simulation"]["mrsp"] == {
        "boundaries": [3680000, 4580000],
        "values": [
            {"speed": 39.444, "source": {"speed_limit_source_type": "unknown_tag"}},
            {"speed": 31.111, "source": {"speed_limit_source_type": "unknown_tag"}},
            {"speed": 80.0, "source": {"speed_limit_source_type": "unknown_tag"}},
        ],
    }


def test_max_running_time(small_scenario: Scenario, fast_rolling_stock: int):
    """
    We use work schedules to force a very long running time, which shouldn't be a valid solution.
    We specifically try with a very large departure time window to reproduce a bug (#9164).
                distance
                   ^
    destination  > |######################## /
                   |########################/
                   |                       /
                   |    __________________/
                   |   /
                   |  /#########################
        origin   > | / #########################
                   +___________________________> time
                       ^                   ^
                      8:00               16:00
                   [       ] <  max running time
                   [                             ] < departure time window
    """
    requests.post(EDITOAST_URL + f"infra/{small_scenario.infra}/load")
    origin_start_time = datetime.datetime(2024, 1, 1, 8, 0, 0)
    origin_end_time = datetime.datetime(2025, 1, 1, 8, 0, 0)
    destination_start_time = datetime.datetime(2023, 1, 1, 8, 0, 0)
    destination_end_time = datetime.datetime(2024, 1, 1, 16, 0, 0)
    # TODO: we cannot delete work schedules for now, so let's give a unique name
    # to avoid collisions
    now = datetime.datetime.now()
    work_schedules_r = requests.post(
        EDITOAST_URL + "work_schedules/",
        json={
            "work_schedule_group_name": f"generic_group_{now}",
            "work_schedules": [
                {
                    "start_date_time": origin_start_time.isoformat(),
                    "end_date_time": origin_end_time.isoformat(),
                    "obj_id": "string",
                    "track_ranges": [{"begin": 0, "end": 100000, "track": _START["track"]}],
                    "work_schedule_type": "CATENARY",
                },
                {
                    "start_date_time": destination_start_time.isoformat(),
                    "end_date_time": destination_end_time.isoformat(),
                    "obj_id": "string",
                    "track_ranges": [{"begin": 0, "end": 100000, "track": _STOP["track"]}],
                    "work_schedule_type": "CATENARY",
                },
            ],
        },
    )
    work_schedules_response = work_schedules_r.json()

    payload = {
        "rolling_stock_id": fast_rolling_stock,
        "start_time": "2024-01-01T07:30:00+00:00",
        "maximum_departure_delay": 3600 * 10,
        "time_gap_before": 0,
        "time_gap_after": 0,
        "steps": [
            {"duration": None, "location": _START},
            {"duration": 1, "location": _STOP},
        ],
        "comfort": "STANDARD",
        "margin": "0%",
        "work_schedule_group_id": work_schedules_response["work_schedule_group_id"],
    }
    url = f"{EDITOAST_URL}timetable/{small_scenario.timetable}/stdcm/?infra={small_scenario.infra}"
    r = requests.post(url, json=payload)
    response = r.json()
    assert r.status_code == 200
    assert response == {"status": "path_not_found"}


def _get_stdcm_response(infra: Infra, timetable_id: int, stdcm_payload: Dict[str, Any]):
    stdcm_response = requests.post(
        f"{EDITOAST_URL}/timetable/{timetable_id}/stdcm/?infra={infra.id}", json=stdcm_payload
    )
    stdcm_response.raise_for_status()
    content = stdcm_response.json()
    return content
