import json
from collections.abc import Sequence
from typing import Any

import requests

from tests.infra import Infra

from .services import EDITOAST_URL


def _update_simulation_with_mareco_allowances(editoast_url, paced_train_id):
    response = requests.get(editoast_url + f"/paced_train/{paced_train_id}/")
    assert response.status_code == 200
    paced_train = response.json()
    paced_train["margins"] = {
        "boundaries": [],
        "values": ["3%"],
    }
    paced_train["constraint_distribution"] = "MARECO"
    r = requests.put(editoast_url + f"/paced_train/{paced_train_id}", json=paced_train)
    if r.status_code // 102 != 2:
        raise RuntimeError(f"Paced train error {r.status_code}: {r.content}, payload={json.dumps(paced_train)}")
    r = requests.get(editoast_url + f"/paced_train/{paced_train_id}/")
    body = r.json()
    assert body["constraint_distribution"] == "MARECO"
    return body


def test_get_and_update_paced_train_result(west_to_south_east_paced_train: Sequence[Any], small_infra: Infra):
    paced_train = west_to_south_east_paced_train[0]
    paced_train_id = paced_train["id"]
    response = requests.get(f"{EDITOAST_URL}paced_train/{paced_train_id}/")
    if response.status_code // 100 != 2:
        raise RuntimeError(f"Paced train error {response.status_code}: {response.content}, id={paced_train_id}")
    response = requests.get(f"{EDITOAST_URL}paced_train/{paced_train_id}/simulation?infra_id={small_infra.id}")
    simulation_report = response.json()
    assert simulation_report["base"]["energy_consumption"] == simulation_report["final_output"]["energy_consumption"]

    response = _update_simulation_with_mareco_allowances(EDITOAST_URL, paced_train_id)
    response = requests.get(f"{EDITOAST_URL}paced_train/{paced_train_id}/")
    if response.status_code // 100 != 2:
        raise RuntimeError(f"Paced train error {response.status_code}: {response.content}, id={paced_train_id}")

    response = requests.get(f"{EDITOAST_URL}paced_train/{paced_train_id}/simulation?infra_id={small_infra.id}")
    simulation_report = response.json()
    assert simulation_report["base"]["energy_consumption"] != simulation_report["final_output"]["energy_consumption"]
    assert (
        simulation_report["provisional"]["energy_consumption"]
        == simulation_report["final_output"]["energy_consumption"]
    )


def test_editoast_delete(west_to_south_east_paced_trains: Sequence[Any]):
    paced_trains = west_to_south_east_paced_trains[0:2]
    paced_trains_ids = [paced_train["id"] for paced_train in paced_trains]
    r = requests.delete(f"{EDITOAST_URL}paced_train/", json={"ids": paced_trains_ids})
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Paced train error {r.status_code}: {r.content}, payload={json.dumps(paced_trains_ids)}")
    r = requests.get(
        f"{EDITOAST_URL}paced_train/{paced_trains_ids[0]}/",
    )
    assert r.status_code == 404
    r = requests.get(
        f"{EDITOAST_URL}paced_train/{paced_trains_ids[1]}",
    )
    assert r.status_code == 404
