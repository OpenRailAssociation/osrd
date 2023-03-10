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


def get_schedule_arrival_time(base_url, schedule_id):
    r = requests.get(f"{base_url}train_schedule/{schedule_id}/result/")
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Schedule result {r.status_code}: {r.content}")
    response = r.json()
    return response["simulation"]["base"]["head_positions"][-1]["time"]


def get_schedule_longest_occupancy(base_url, schedule_id):
    r = requests.get(f"{base_url}train_schedule/{schedule_id}/result/")
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Schedule result {r.status_code}: {r.content}")
    response = r.json()
    begin_occupancy = {}
    for entry in response["base"]["route_begin_occupancy"][0]:
        begin_occupancy[entry["position"]] = entry["time"]
    longest_occupancy = 0
    for entry in response["base"]["route_end_occupancy"][0]:
        position = entry["position"]
        if position in begin_occupancy:
            longest_occupancy = max(longest_occupancy, entry["time"] - begin_occupancy[position])
    return longest_occupancy
