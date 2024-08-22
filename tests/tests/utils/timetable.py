import json
from typing import Tuple

import requests


def create_op_study(editoast_url, project_id: int) -> int:
    payload = {"name": "foo", "state": "Starting", "service_code": "AAA", "business_code": "BBB"}
    res = requests.post(editoast_url + f"projects/{project_id}/studies/", json=payload)
    if res.status_code // 100 != 2:
        err = f"Error creating operational study {res.status_code}: {res.content}, payload={json.dumps(payload)}"
        raise RuntimeError(err)
    return res.json()["id"]


def create_scenario(editoast_url: str, infra_id: int, project_id: int, op_study_id: int) -> Tuple[int, int]:
    # Create the timetable
    r = requests.post(editoast_url + "/timetable/")
    if r.status_code // 100 != 2:
        err = f"Error creating timetable {r.status_code}: {r.content}"
        raise RuntimeError(err)
    timetable_id = r.json()["timetable_id"]

    # Create the scenario
    scenario_payload = {
        "name": "_@Test integration scenario",
        "infra_id": infra_id,
        "timetable_id": timetable_id,
    }
    r = requests.post(editoast_url + f"/projects/{project_id}/studies/{op_study_id}/scenarios/", json=scenario_payload)
    r.raise_for_status()
    return r.json()["id"], timetable_id
