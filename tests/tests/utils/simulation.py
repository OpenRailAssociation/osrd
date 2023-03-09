import json

import requests

from .schedule import make_payload_schedule


def _get_rolling_stock_id(base_url, rolling_stock_name: str):
    r = requests.get(base_url + "rolling_stock/?page_size=1000")
    assert r.status_code == 200

    rolling_stocks = r.json()["results"]
    return next(
        iter([rolling_stock["id"] for rolling_stock in rolling_stocks if rolling_stock["name"] == rolling_stock_name])
    )


def run_pathfinding(base_url, infra_id, waypoints):
    path_payload = {
        "infra": infra_id,
        "steps": [
            {
                "duration": 0,
                "waypoints": [waypoint],
            }
            for waypoint in waypoints
        ],
    }
    r = requests.post(base_url + "pathfinding/", json=path_payload)
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Pathfinding error {r.status_code}: {r.content}, payload={json.dumps(path_payload)}")
    return r.json()["id"]


def _get_waypoints_dummy_infra(base_url, infra_id):
    response = requests.get(base_url + f"infra/{infra_id}/railjson/")
    infra = response.json()
    return [
        {"track_section": infra["track_sections"][0]["id"], "offset": infra["track_sections"][0]["length"] * 0.1},
        {"track_section": infra["track_sections"][0]["id"], "offset": infra["track_sections"][0]["length"] * 0.9},
    ]


def update_simulation_with_mareco_allowances(base_url, train_Schedule_id):
    response = requests.get(base_url + f"train_schedule/{train_Schedule_id}/")
    assert response.status_code == 200
    train_schedule = response.json()
    train_schedule["allowances"] = [
        {
            "allowance_type": "standard",
            "distribution": "MARECO",
            "default_value": {"value_type": "percentage", "percentage": 3},
            "ranges": [],
        }
    ]
    r = requests.patch(base_url + f"train_schedule/{train_Schedule_id}/", json=train_schedule)
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Schedule error {r.status_code}: {r.content}, payload={json.dumps(train_schedule)}")
    body = r.json()
    assert len(body["allowances"]) == 1
    assert body["allowances"][0]["distribution"] == "MARECO"
    return body


def run_simulation(base_url, scenario):
    path_id = run_pathfinding(base_url, scenario.infra, _get_waypoints_dummy_infra(base_url, scenario.infra))
    rolling_stock_id = _get_rolling_stock_id(base_url, "fast_rolling_stock")
    schedule_payload = make_payload_schedule(scenario, path_id, rolling_stock_id)
    r = requests.post(base_url + "train_schedule/standalone_simulation/", json=schedule_payload)
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Schedule error {r.status_code}: {r.content}, payload={json.dumps(schedule_payload)}")

    schedule_id = r.json()["ids"][0]
    return schedule_id
