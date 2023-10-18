import json
from pathlib import Path
from typing import List

import pytest
import requests

from .scenario import Scenario
from .services import EDITOAST_URL

REGRESSION_TESTS_DATA_FOLDER = Path(__file__).parent / "regression_tests_data"
REGRESSION_TESTS_JSON_FILES = [json_file.name for json_file in REGRESSION_TESTS_DATA_FOLDER.resolve().glob("*.json")]


def _load_infra(editoast_url: str, infra_id):
    r = requests.post(editoast_url + f"infra/{infra_id}/load")
    if r.status_code // 100 != 2:
        if r.status_code // 100 == 4:
            return None
        raise RuntimeError(f"Infra load {r.status_code}: {r.content}")


def _pathfinding_with_payload(editoast_url: str, payload, infra_id, accept_400):
    payload["infra"] = infra_id
    r = requests.post(editoast_url + "pathfinding/", json=payload)
    if r.status_code // 100 != 2:
        if r.status_code // 100 == 4 and accept_400:
            return None
        raise RuntimeError(f"Pathfinding error {r.status_code}: {r.content}")
    return r.json()["id"]


def _schedule_with_payload(editoast_url: str, payload, accept_400):
    r = requests.post(editoast_url + "train_schedule/standalone_simulation/", json=payload)
    if r.status_code // 100 != 2:
        if r.status_code // 100 == 4 and accept_400:
            return None
        raise RuntimeError(f"Schedule error {r.status_code}: {r.content}")
    return r.json()[0]


def _update_schedule_payload(payload, path_id, timetable, rolling_stock_id: int):
    payload["path"] = path_id
    payload["timetable"] = timetable
    payload["schedules"][0]["rolling_stock_id"] = rolling_stock_id


def _update_stdcm_payload(payload, infra_id, timetable, rolling_stock_id: int):
    payload["infra_id"] = infra_id
    payload["timetable_id"] = timetable
    payload["rolling_stock_id"] = rolling_stock_id


def _check_result(editoast_url: str, schedule_id):
    r = requests.get(f"{EDITOAST_URL}train_schedule/{schedule_id}/result/")
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Schedule error {r.status_code}: {r.content}, id={schedule_id}")


def _apply_prelude(prelude: List, editoast_url: str, infra, timetable, rolling_stock_id: int):
    for train in prelude:
        assert "path_payload" in train and "schedule_payload" in train

        path_id = _pathfinding_with_payload(editoast_url, train["path_payload"], infra, accept_400=False)

        schedule_payload = train["schedule_payload"]
        _update_schedule_payload(schedule_payload, path_id, timetable, rolling_stock_id)
        schedule_id = _schedule_with_payload(editoast_url, schedule_payload, accept_400=False)

        _check_result(editoast_url, schedule_id)


def _stdcm_with_payload(editoast_url: str, payload):
    r = requests.post(editoast_url + "stdcm/", json=payload)
    if r.status_code // 100 != 2:
        if r.status_code // 100 == 4:
            return None
        raise RuntimeError(f"stdcm error {r.status_code}: {r.content}")


def _reproduce_test(path_to_json: Path, scenario: Scenario, rolling_stock_id: int):
    fuzzer_output = json.loads(path_to_json.read_bytes())
    _load_infra(EDITOAST_URL, scenario.infra)

    assert fuzzer_output["infra_name"] in ["small_infra", "Small Infra"]
    timetable = scenario.timetable

    if fuzzer_output["error_type"] == "STDCM":
        _apply_prelude(fuzzer_output.get("prelude", []), EDITOAST_URL, scenario.infra, timetable, rolling_stock_id)
        payload = fuzzer_output["stdcm_payload"]
        _update_stdcm_payload(payload, scenario.infra, timetable, rolling_stock_id)
        _stdcm_with_payload(EDITOAST_URL, payload)
        return

    stop_after_pathfinding = fuzzer_output["error_type"] == "PATHFINDING"
    stop_after_schedule = fuzzer_output["error_type"] == "SCHEDULE"

    path_id = _pathfinding_with_payload(
        EDITOAST_URL, fuzzer_output["path_payload"], scenario.infra, stop_after_pathfinding
    )
    if stop_after_pathfinding:
        return

    payload = fuzzer_output["schedule_payload"]
    _update_schedule_payload(payload, path_id, timetable, rolling_stock_id)
    schedule_id = _schedule_with_payload(EDITOAST_URL, payload, stop_after_schedule)
    if stop_after_schedule:
        return

    _check_result(EDITOAST_URL, schedule_id)


@pytest.mark.parametrize("file_name", REGRESSION_TESTS_JSON_FILES)
def test_regressions(file_name: str, small_scenario: Scenario, fast_rolling_stock: int):
    _reproduce_test(REGRESSION_TESTS_DATA_FOLDER / file_name, small_scenario, fast_rolling_stock)
