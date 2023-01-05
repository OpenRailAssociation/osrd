import json
from pathlib import Path

import requests

from tests.get_rolling_stocks import get_rolling_stock


def pathfinding_with_payload(base_url, payload, infra_id, accept_400):
    payload["infra"] = infra_id
    r = requests.post(base_url + "pathfinding/", json=payload)
    if r.status_code // 100 != 2:
        if r.status_code // 100 == 4 and accept_400:
            return None
        raise RuntimeError(f"Pathfinding error {r.status_code}: {r.content}")
    return r.json()["id"]


def schedule_with_payload(base_url, payload, accept_400):
    r = requests.post(base_url + "train_schedule/standalone_simulation/", json=payload)
    if r.status_code // 100 != 2:
        if r.status_code // 100 == 4 and accept_400:
            return None
        raise RuntimeError(f"Schedule error {r.status_code}: {r.content}")
    return r.json()["ids"][0]


def stdcm_with_payload(base_url, payload):
    r = requests.post(base_url + "stdcm/", json=payload)
    if r.status_code // 100 != 2:
        if r.status_code // 100 == 4:
            return None
        raise RuntimeError(f"stdcm error {r.status_code}: {r.content}")


def reproduce_test(path_to_json, *args, **kwargs):
    base_url = kwargs["url"]
    all_scenarios = kwargs["all_scenarios"]
    fuzzer_output = json.loads(path_to_json.read_bytes())

    if fuzzer_output["error_type"] == "STDCM":
        stdcm_with_payload(base_url, fuzzer_output["stdcm_payload"])
        return True, ""

    stop_after_pathfinding = fuzzer_output["error_type"] == "PATHFINDING"
    stop_after_schedule = fuzzer_output["error_type"] == "SCHEDULE"

    scenario = all_scenarios[fuzzer_output["infra_name"]]
    timetable = scenario.timetable
    path_id = pathfinding_with_payload(
        base_url, fuzzer_output["path_payload"], scenario.infra, stop_after_pathfinding
    )
    if stop_after_pathfinding:
        return True, ""
    rolling_stock_id = get_rolling_stock(base_url)

    payload = fuzzer_output["schedule_payload"]
    payload["path"] = path_id
    payload["timetable"] = timetable
    payload["schedules"][0]["rolling_stock"] = rolling_stock_id
    schedule_id = schedule_with_payload(base_url, payload, stop_after_schedule)
    if stop_after_schedule:
        return True, ""

    r = requests.get(f"{base_url}train_schedule/{schedule_id}/result/")
    if r.status_code // 100 != 2:
        raise RuntimeError(
            f"Schedule error {r.status_code}: {r.content}, id={schedule_id}"
        )
    return True, ""


def list_tests():
    dir = Path(__file__).parent.resolve()
    for f in dir.glob("*.json"):

        def run_test(func=f, *args, **kwargs):
            return reproduce_test(func, *args, **kwargs)

        yield run_test, f.stem
