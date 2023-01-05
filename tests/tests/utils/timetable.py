import json

import requests


def create_project(base_url) -> int:
    payload = {"name": "foo"}
    response = requests.post(base_url + "projects/", json=payload)
    if response.status_code // 100 != 2:
        err = f"Error creating project {response.status_code}: {response.content}, payload={json.dumps(payload)}"
        raise RuntimeError(err)
    return response.json()["id"]


def create_op_study(base_url, project_id: int) -> int:
    payload = {"name": "foo", "service_code": "AAA", "business_code": "BBB"}
    res = requests.post(base_url + f"projects/{project_id}/studies/", json=payload)
    if res.status_code // 100 != 2:
        err = f"Error creating operational study {res.status_code}: {res.content}, payload={json.dumps(payload)}"
        raise RuntimeError(err)
    return res.json()["id"]


def create_scenario(base_url, infra_id, project_id, op_study_id) -> (int, int):
    scenario_payload = {"name": "foo", "infra": infra_id}
    r = requests.post(
        base_url + f"projects/{project_id}/studies/{op_study_id}/scenarios/",
        json=scenario_payload,
    )
    if r.status_code // 100 != 2:
        err = f"Error creating schedule {r.status_code}: {r.content}, payload={json.dumps(scenario_payload)}"
        raise RuntimeError(err)
    return (r.json()["id"], r.json()["timetable"])


def delete_project(base_url, project):
    requests.delete(f"{base_url}/projects/{project}/")
