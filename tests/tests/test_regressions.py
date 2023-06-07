import json
from pathlib import Path

import pytest
import requests

from .scenario import Scenario
from .services import API_URL, EDITOAST_URL

REGRESSION_TESTS_DATA_FOLDER = Path(__file__).parent / "regression_tests_data"
REGRESSION_TESTS_JSON_FILES = [json_file.name for json_file in REGRESSION_TESTS_DATA_FOLDER.resolve().glob("*.json")]


def _load_infra(editoast_url, infra_id):
    r = requests.post(editoast_url + f"infra/{infra_id}/load")
    if r.status_code // 100 != 2:
        if r.status_code // 100 == 4:
            return None
        raise RuntimeError(f"Infra load {r.status_code}: {r.content}")


def _pathfinding_with_payload(base_url, payload, infra_id, accept_400):
    payload["infra"] = infra_id
    r = requests.post(base_url + "pathfinding/", json=payload)
    if r.status_code // 100 != 2:
        if r.status_code // 100 == 4 and accept_400:
            return None
        raise RuntimeError(f"Pathfinding error {r.status_code}: {r.content}")
    return r.json()["id"]


def _schedule_with_payload(base_url, payload, accept_400):
    r = requests.post(base_url + "train_schedule/standalone_simulation/", json=payload)
    if r.status_code // 100 != 2:
        if r.status_code // 100 == 4 and accept_400:
            return None
        raise RuntimeError(f"Schedule error {r.status_code}: {r.content}")
    return r.json()["ids"][0]


def _stdcm_with_payload(base_url: str, payload):
    r = requests.post(base_url + "stdcm/", json=payload)
    if r.status_code // 100 != 2:
        if r.status_code // 100 == 4:
            return None
        raise RuntimeError(f"stdcm error {r.status_code}: {r.content}")


def _reproduce_test(path_to_json: Path, scenario: Scenario, rolling_stock_id: int):
    fuzzer_output = json.loads(path_to_json.read_bytes())
    _load_infra(EDITOAST_URL, scenario.infra)

    if fuzzer_output["error_type"] == "STDCM":
        _stdcm_with_payload(API_URL, fuzzer_output["stdcm_payload"])
        return

    stop_after_pathfinding = fuzzer_output["error_type"] == "PATHFINDING"
    stop_after_schedule = fuzzer_output["error_type"] == "SCHEDULE"

    assert "small_infra" == fuzzer_output["infra_name"]
    timetable = scenario.timetable
    path_id = _pathfinding_with_payload(API_URL, fuzzer_output["path_payload"], scenario.infra, stop_after_pathfinding)
    if stop_after_pathfinding:
        return

    payload = fuzzer_output["schedule_payload"]
    payload["path"] = path_id
    payload["timetable"] = timetable
    payload["schedules"][0]["rolling_stock"] = rolling_stock_id
    schedule_id = _schedule_with_payload(API_URL, payload, stop_after_schedule)
    if stop_after_schedule:
        return

    r = requests.get(f"{API_URL}train_schedule/{schedule_id}/result/")
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Schedule error {r.status_code}: {r.content}, id={schedule_id}")


@pytest.mark.parametrize("file_name", REGRESSION_TESTS_JSON_FILES)
def test_regressions(file_name: str, small_scenario: Scenario, fast_rolling_stock: int):
    _reproduce_test(REGRESSION_TESTS_DATA_FOLDER / file_name, small_scenario, fast_rolling_stock)
