import json

import requests

from tests.get_rolling_stocks import get_rolling_stock
from tests.run_pathfinding import run_pathfinding
from tests.utils.schedule import make_payload_schedule


def run_simulation(base_url, scenario):
    path_id = run_pathfinding(base_url, scenario.infra)
    rolling_stock_id = get_rolling_stock(base_url)
    schedule_payload = make_payload_schedule(
        base_url, scenario, path_id, rolling_stock_id
    )
    r = requests.post(
        base_url + "train_schedule/standalone_simulation/", json=schedule_payload
    )
    if r.status_code // 100 != 2:
        raise RuntimeError(
            f"Schedule error {r.status_code}: {r.content}, payload={json.dumps(schedule_payload)}"
        )

    schedule_id = r.json()["ids"][0]
    return schedule_id


def run(*args, **kwargs):
    base_url = kwargs["url"]
    scenario = kwargs["all_scenarios"]["dummy"]
    run_simulation(base_url, scenario)
    return True, ""
