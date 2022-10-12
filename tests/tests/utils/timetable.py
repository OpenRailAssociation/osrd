import json

import requests


def create_timetable(base_url, infra_id):
    timetable_payload = {
        "name": "foo",
        "infra": infra_id
    }
    r = requests.post(base_url + "timetable/", json=timetable_payload)
    if r.status_code // 100 != 2:
        err = f"Error creating timetable {r.status_code}: {r.content}, payload={json.dumps(timetable_payload)}"
        raise RuntimeError(err)
    return r.json()["id"]


def delete_timetable(base_url, timetable_id):
    requests.delete(f"{base_url}timetable/{timetable_id}/")
