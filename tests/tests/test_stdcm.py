import datetime
import json
from typing import Any, Dict

import requests

from tests.utils.timetable import create_op_study, create_scenario

from .infra import Infra
from .path import Path
from .scenario import Scenario
from .services import EDITOAST_URL

_START = {"track_section": "TA2", "geo_coordinate": [-0.387122554630656, 49.4998]}
_MIDDLE = {"track_section": "TA5", "geo_coordinate": [-0.387122554630656, 49.4998]}
_STOP = {"track_section": "TH1", "geo_coordinate": [-0.095104854807785, 49.484]}

_START_V2 = {"track": "TA2", "offset": 0}
_MIDDLE_V2 = {"track": "TA5", "offset": 0}
_STOP_V2 = {"track": "TH1", "offset": 0}


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
        "maximum_departure_delay": 7200,
        "maximum_run_time": 43200,
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
        "maximum_departure_delay": 7200,
        "maximum_run_time": 43200,
    }
    r = requests.post(EDITOAST_URL + "stdcm/", json=payload)
    r.raise_for_status()
    result = r.json()
    stops = result["simulation"]["base"]["stops"]
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
        "maximum_departure_delay": 7200,
        "maximum_run_time": 43200,
    }
    r = requests.post(EDITOAST_URL + "stdcm/", json=payload)
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


def test_mrsp_sources(
    small_infra: Infra,
    timetable_v2_id: int,
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

    content = _get_stdcm_response(small_infra, timetable_v2_id, stdcm_payload)
    assert content["simulation"]["mrsp"] == {
        "boundaries": [4180000, 4580000],
        "values": [
            {"speed": 27.778, "source": {"speed_limit_source_type": "given_train_tag", "tag": "E32C"}},
            {"speed": 22.222, "source": {"speed_limit_source_type": "fallback_tag", "tag": "MA100"}},
            {"speed": 80, "source": None},
        ],
    }

    stdcm_payload["speed_limit_tags"] = "MA80"
    content = _get_stdcm_response(small_infra, timetable_v2_id, stdcm_payload)
    assert content["simulation"]["mrsp"] == {
        "boundaries": [3680000, 4580000],
        "values": [
            {"speed": 39.444, "source": {"speed_limit_source_type": "unknown_tag"}},
            {"speed": 31.111, "source": {"speed_limit_source_type": "unknown_tag"}},
            {"speed": 80, "source": None},
        ],
    }


def _get_stdcm_response(infra: Infra, timetable_v2_id: int, stdcm_payload: Dict[str, Any]):
    stdcm_response = requests.post(
        f"{EDITOAST_URL}/v2/timetable/{timetable_v2_id}/stdcm/?infra={infra.id}", json=stdcm_payload
    )
    stdcm_response.raise_for_status()
    content = stdcm_response.json()
    return content
