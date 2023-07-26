import json
from typing import Iterable

import requests

from .services import API_URL


def _update_simulation_with_mareco_allowances(base_url, train_Schedule_id):
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


def test_get_and_update_schedule_result(west_to_south_east_simulation: Iterable[int]):
    schedule_id = west_to_south_east_simulation[0]
    response = requests.get(f"{API_URL}train_schedule/{schedule_id}/result/")
    if response.status_code // 100 != 2:
        raise RuntimeError(f"Schedule error {response.status_code}: {response.content}, id={schedule_id}")
    simulation_report = response.json()
    assert "base" in simulation_report
    assert "eco" not in simulation_report

    response = _update_simulation_with_mareco_allowances(API_URL, schedule_id)
    response = requests.get(f"{API_URL}train_schedule/{schedule_id}/result/")
    if response.status_code // 100 != 2:
        raise RuntimeError(f"Schedule error {response.status_code}: {response.content}, id={schedule_id}")
    simulation_report = response.json()
    assert "base" in simulation_report
    assert "eco" in simulation_report


def test_api_bulk_delete(small_scenario, west_to_south_east_simulations: Iterable[int]):
    ids = west_to_south_east_simulations[0:2]
    schedules = requests.get(f"{API_URL}train_schedule/results/?timetable_id={small_scenario.timetable}").json()
    old_len = len(schedules)
    r = requests.delete(f"{API_URL}train_schedule/delete/", json={"ids": ids})
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Schedule error {r.status_code}: {r.content}, payload={json.dumps(ids)}")
    schedules = requests.get(f"{API_URL}train_schedule/results/?timetable_id={small_scenario.timetable}").json()
    assert len(schedules) == old_len - 2
