import json

import requests

from .schedule import make_payload_schedule
from .simulation import _get_rolling_stock_id, run_pathfinding


def add_train(base_url, scenario, start, stop, departure_time):
    path_id = run_pathfinding(base_url, scenario.infra, [start, stop])
    rolling_stock_id = _get_rolling_stock_id(base_url, "fast_rolling_stock")
    schedule_payload = make_payload_schedule(scenario, path_id, rolling_stock_id, departure_time)
    r = requests.post(base_url + "train_schedule/standalone_simulation/", json=schedule_payload)
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Schedule error {r.status_code}: {r.content}, payload={json.dumps(schedule_payload)}")
    schedule_id = r.json()["ids"][0]
    return schedule_id
