import json
from collections.abc import Sequence
from typing import Any

import requests

from tests.infra import Infra

from .services import EDITOAST_URL


def _update_simulation_with_mareco_allowances(editoast_url, train_Schedule_id):
    response = requests.get(editoast_url + f"v2/train_schedule/{train_Schedule_id}/")
    assert response.status_code == 200
    train_schedule = response.json()
    train_schedule["margins"] = {
        "boundaries": [],
        "values": ["3%"],
    }
    train_schedule["constraint_distribution"] = "MARECO"
    r = requests.put(editoast_url + f"v2/train_schedule/{train_Schedule_id}", json=train_schedule)
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Schedule error {r.status_code}: {r.content}, payload={json.dumps(train_schedule)}")
    r = requests.get(editoast_url + f"v2/train_schedule/{train_Schedule_id}/")
    body = r.json()
    assert body["constraint_distribution"] == "MARECO"
    return body


def test_get_and_update_schedule_result(west_to_south_east_simulation: Sequence[Any], small_infra: Infra):
    schedule = west_to_south_east_simulation[0]
    schedule_id = schedule["id"]
    response = requests.get(f"{EDITOAST_URL}v2/train_schedule/{schedule_id}/")
    if response.status_code // 100 != 2:
        raise RuntimeError(f"Schedule error {response.status_code}: {response.content}, id={schedule_id}")
    response = requests.get(f"{EDITOAST_URL}v2/train_schedule/{schedule_id}/simulation?infra_id={small_infra.id}")
    simulation_report = response.json()
    assert simulation_report["base"]["energy_consumption"] == simulation_report["final_output"]["energy_consumption"]

    response = _update_simulation_with_mareco_allowances(EDITOAST_URL, schedule_id)
    response = requests.get(f"{EDITOAST_URL}v2/train_schedule/{schedule_id}/")
    if response.status_code // 100 != 2:
        raise RuntimeError(f"Schedule error {response.status_code}: {response.content}, id={schedule_id}")

    response = requests.get(f"{EDITOAST_URL}v2/train_schedule/{schedule_id}/simulation?infra_id={small_infra.id}")
    simulation_report = response.json()
    assert simulation_report["base"]["energy_consumption"] != simulation_report["final_output"]["energy_consumption"]
    assert (
        simulation_report["provisional"]["energy_consumption"]
        == simulation_report["final_output"]["energy_consumption"]
    )


def test_editoast_delete(west_to_south_east_simulations: Sequence[Any]):
    trains = west_to_south_east_simulations[0:2]
    trains_ids = [train["id"] for train in trains]
    r = requests.delete(f"{EDITOAST_URL}v2/train_schedule/", json={"ids": trains_ids})
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Schedule error {r.status_code}: {r.content}, payload={json.dumps(trains_ids)}")
    r = requests.get(
        f"{EDITOAST_URL}v2/train_schedule/{trains_ids[0]}/",
    )
    assert r.status_code == 404
    r = requests.get(
        f"{EDITOAST_URL}v2/train_schedule/{trains_ids[1]}",
    )
    assert r.status_code == 404
