import json

import requests

from tests.get_rolling_stocks import get_rolling_stock
from tests.run_pathfinding import run_pathfinding
from tests.run_simulation import run_simulation, make_payload_schedule


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


def make_schedule_with_conflict(base_url, infra_id):
    timetable = create_timetable(base_url, infra_id)
    path_id = run_pathfinding(base_url, infra_id)
    rolling_stock_id = get_rolling_stock(base_url)

    def make_train(departure_time):
        payload = make_payload_schedule(base_url, infra_id, path_id, rolling_stock_id,
                                        timetable=timetable, departure_time=departure_time)
        r = requests.post(base_url + "train_schedule/standalone_simulation/", json=payload)
        if r.status_code // 100 != 2:
            raise RuntimeError(f"Schedule error {r.status_code}: {r.content}, payload={json.dumps(payload)}")
        return r.json()

    first_train = make_train(0)
    second_train = make_train(1)
    return timetable, first_train, second_train, path_id


def run(*args, **kwargs):
    base_url = kwargs["url"]
    infra_id = kwargs["all_infras"]["tiny"]
    timetable, first_train, second_train, path_id = make_schedule_with_conflict(base_url, infra_id)
    r = requests.get(base_url + f"timetable/{timetable}/conflicts/", json={"path": path_id})
    if r.status_code // 100 != 2:
        raise RuntimeError(f"conflicts error {r.status_code}: {r.content}, {timetable=}, {path_id=}")
    response = r.json()
    assert len(response) >= 1
    assert response[0]["first_train"] == first_train["ids"][0]
    assert response[0]["second_train"] == second_train["ids"][0]
    assert "position_start" in response[0]
    assert "position_end" in response[0]
    return True, ""
