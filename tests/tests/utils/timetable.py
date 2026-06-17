import json

from datetime import datetime
from requests import Session


def create_op_study(editoast_url, project_id: int, session: Session) -> int:
    payload = {
        "project_id": project_id,
        "name": "foo",
        "state": "Starting",
        "service_code": "AAA",
        "business_code": "BBB",
    }
    res = session.post(editoast_url + "studies/", json=payload)
    if res.status_code // 100 != 2:
        err = f"Error creating operational study {res.status_code}: {res.content}, payload={json.dumps(payload)}"
        raise RuntimeError(err)
    return res.json()["id"]


def create_scenario(
    editoast_url: str,
    infra_id: int,
    op_study_id: int,
    session: Session,
) -> tuple[int, int, int]:
    # Create the timetable
    r = session.post(editoast_url + "/timetable/", json={"timetable_type": "CALENDAR"})
    if r.status_code // 100 != 2:
        err = f"Error creating timetable {r.status_code}: {r.content}"
        raise RuntimeError(err)
    timetable_id = r.json()["timetable_id"]

    r = session.post(
        editoast_url + "/train_schedule_sets/",
        json={
            "catalog_entry_id": None,
            "name": None,
            "published": False,
            "description": "",
            "timetable_type": "CALENDAR",
        },
    )
    if r.status_code // 100 != 2:
        err = f"Error creating train_schedule_set_id {r.status_code}: {r.content}"
        raise RuntimeError(err)
    train_schedule_set_id = r.json()["id"]

    # Create the scenario
    scenario_payload = {
        "name": "_@Test integration scenario",
        "infra_id": infra_id,
        "timetable_id": timetable_id,
        "study_id": op_study_id,
    }
    r = session.post(
        editoast_url + "scenarios/",
        json=scenario_payload,
    )
    r.raise_for_status()
    return r.json()["id"], timetable_id, train_schedule_set_id


def ms_since_epoch(s: str) -> int:
    return int(datetime.fromisoformat(s).timestamp() * 1000)
