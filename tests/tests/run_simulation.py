import json

import requests
from tests.get_rolling_stocks import get_rolling_stock
from tests.run_pathfinding import run_pathfinding
from tests.utils.schedule import make_payload_schedule


def run_simulation(base_url, scenario):
    path_id = run_pathfinding(base_url, scenario.infra)
    rolling_stock_id = get_rolling_stock(base_url)
    schedule_payload = make_payload_schedule(scenario, path_id, rolling_stock_id)
    r = requests.post(
        base_url + "train_schedule/standalone_simulation/", json=schedule_payload
    )
    if r.status_code // 100 != 2:
        raise RuntimeError(
            f"Schedule error {r.status_code}: {r.content}, payload={json.dumps(schedule_payload)}"
        )

    schedule_id = r.json()["ids"][0]
    return schedule_id


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
    r = requests.patch(
        base_url + f"train_schedule/{train_Schedule_id}/", json=train_schedule
    )
    if r.status_code // 100 != 2:
        raise RuntimeError(
            f"Schedule error {r.status_code}: {r.content}, payload={json.dumps(train_schedule)}"
        )
    body = r.json()
    assert len(body["allowances"]) == 1
    assert body["allowances"][0]["distribution"] == "MARECO"
    return body


def run(*args, **kwargs):
    base_url = kwargs["url"]
    scenario = kwargs["all_scenarios"]["dummy"]
    run_simulation(base_url, scenario)
    return True, ""
