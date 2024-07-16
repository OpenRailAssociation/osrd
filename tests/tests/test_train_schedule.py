import json
from collections.abc import Sequence

import requests

from .services import EDITOAST_URL


def _update_simulation_with_mareco_allowances(editoast_url, train_Schedule_id):
    response = requests.get(editoast_url + f"train_schedule/{train_Schedule_id}/")
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
    r = requests.patch(editoast_url + "train_schedule/", json=[train_schedule])
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Schedule error {r.status_code}: {r.content}, payload={json.dumps(train_schedule)}")
    r = requests.get(editoast_url + f"train_schedule/{train_Schedule_id}/")
    body = r.json()
    assert len(body["allowances"]) == 1
    assert body["allowances"][0]["distribution"] == "MARECO"
    return body


def test_get_and_update_schedule_result(west_to_south_east_simulation: Sequence[int]):
    schedule_id = west_to_south_east_simulation[0]
    response = requests.get(f"{EDITOAST_URL}train_schedule/{schedule_id}/result/")
    if response.status_code // 100 != 2:
        raise RuntimeError(f"Schedule error {response.status_code}: {response.content}, id={schedule_id}")
    simulation_report = response.json()
    assert "base" in simulation_report
    assert "eco" not in simulation_report

    response = _update_simulation_with_mareco_allowances(EDITOAST_URL, schedule_id)
    response = requests.get(f"{EDITOAST_URL}train_schedule/{schedule_id}/result/")
    if response.status_code // 100 != 2:
        raise RuntimeError(f"Schedule error {response.status_code}: {response.content}, id={schedule_id}")
    simulation_report = response.json()
    assert "base" in simulation_report
    assert "eco" in simulation_report


def test_editoast_get_and_update_schedule_result(west_to_south_east_simulation: Sequence[int]):
    schedule_id = west_to_south_east_simulation[0]
    response = requests.get(f"{EDITOAST_URL}train_schedule/{schedule_id}/result/")
    if response.status_code // 100 != 2:
        raise RuntimeError(f"Schedule error {response.status_code}: {response.content}, id={schedule_id}")
    simulation_report = response.json()
    assert "base" in simulation_report
    assert "eco" not in simulation_report

    response = _update_simulation_with_mareco_allowances(EDITOAST_URL, schedule_id)
    response = requests.get(f"{EDITOAST_URL}train_schedule/{schedule_id}/result/")
    if response.status_code // 100 != 2:
        raise RuntimeError(f"Schedule error {response.status_code}: {response.content}, id={schedule_id}")
    simulation_report = response.json()
    assert "base" in simulation_report
    assert "eco" in simulation_report


def test_editoast_bulk_delete(west_to_south_east_simulations: Sequence[int]):
    ids = west_to_south_east_simulations[0:2]
    r = requests.delete(f"{EDITOAST_URL}train_schedule/", json={"ids": ids})
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Schedule error {r.status_code}: {r.content}, payload={json.dumps(ids)}")
    r = requests.post(
        f"{EDITOAST_URL}train_schedule/results/",
        json={"path_id": None, "train_ids": west_to_south_east_simulations[0]},
    )
    assert r.status_code == 422
    r = requests.post(
        f"{EDITOAST_URL}train_schedule/results/",
        json={"path_id": None, "train_ids": west_to_south_east_simulations[1]},
    )
    assert r.status_code == 422
