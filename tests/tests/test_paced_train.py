import json
from collections.abc import Sequence
from typing import Any

from requests import Session

from tests.infra import Infra
from .scenario import Scenario

from .services import EDITOAST_URL
from .test_train_schedule import (
    _get_etcs_braking_curves_train_data,
    _check_etcs_braking_curves_response,
)


def _update_simulation_with_mareco_allowances(
    editoast_url, paced_train_id, session: Session
):
    response = session.get(editoast_url + f"/paced_train/{paced_train_id}/")
    assert response.status_code == 200
    paced_train = response.json()
    paced_train["margins"] = {
        "boundaries": [],
        "values": ["3%"],
    }
    paced_train["constraint_distribution"] = "MARECO"
    r = session.put(editoast_url + f"/paced_train/{paced_train_id}", json=paced_train)
    if r.status_code // 102 != 2:
        raise RuntimeError(
            f"Paced train error {r.status_code}: {r.content}, payload={json.dumps(paced_train)}"
        )
    r = session.get(editoast_url + f"/paced_train/{paced_train_id}/")
    body = r.json()
    assert body["constraint_distribution"] == "MARECO"
    return body


def test_put_paced_train(
    west_to_south_east_paced_train: Sequence[Any],
    session: Session,
    small_infra: Infra,
):
    paced_train = west_to_south_east_paced_train[0]
    paced_train_id = paced_train["id"]

    exception = {
        "key": "exception_key",
        "disabled": False,
        "rolling_stock": {
            "rolling_stock_name": "etcs_rolling_stock",
            "comfort": "AIR_CONDITIONING",
        },
    }

    paced_train["train_name"] = "update_train_name"
    paced_train["exceptions"] = [exception]

    update_response = session.put(
        f"{EDITOAST_URL}paced_train/{paced_train_id}", json=paced_train
    )
    update_response.raise_for_status()

    updated_paced_train = session.get(
        f"{EDITOAST_URL}paced_train/{paced_train_id}"
    ).json()

    assert updated_paced_train["train_name"] == "update_train_name"
    assert updated_paced_train["exceptions"] == [exception]


def test_get_paced_train_with_exception_path(
    west_to_south_east_paced_train: Sequence[Any], small_infra: Infra, session: Session
):
    paced_train = west_to_south_east_paced_train[0]
    paced_train_id = paced_train["id"]

    # Get base paced train path
    paced_train_path_result = session.get(
        f"{EDITOAST_URL}paced_train/{paced_train_id}/path?infra_id={small_infra.id}"
    ).json()

    # Add exception to the paced train
    exception = {
        "key": "exception_key",
        "disabled": False,
        "path_and_schedule": {
            "power_restrictions": [],
            "schedule": [],
            "path": [
                {"id": "id1", "deleted": False, "track": "TA0", "offset": 470000},
                {"id": "id2", "deleted": False, "track": "TG4", "offset": 1993000},
            ],
            "margins": {
                "boundaries": [],
                "values": ["5%"],
            },
        },
        "initial_speed": {"value": 20.0},
    }
    paced_train["exceptions"] = [exception]
    update_response = session.put(
        f"{EDITOAST_URL}paced_train/{paced_train_id}", json=paced_train
    )
    assert update_response.status_code == 204
    # Get exception path
    exception_path_result = session.get(
        f"{EDITOAST_URL}paced_train/{paced_train_id}/path?infra_id={small_infra.id}&exception_key=exception_key"
    ).json()
    base_track_sections = [
        tsr["track_section"]
        for tsr in paced_train_path_result["path"]["track_section_ranges"]
    ]
    exception_track_sections = [
        tsr["track_section"]
        for tsr in exception_path_result["path"]["track_section_ranges"]
    ]

    # Check if the response is different from paced train
    assert base_track_sections != exception_track_sections
    assert base_track_sections == [
        "TA2",
        "TA5",
        "TA7",
        "TC2",
        "TD1",
        "TD3",
        "TH0",
        "TH1",
    ]
    # Check if the exception path is present in track_sections, the first is TA0 and last is TG4
    assert exception_track_sections == [
        "TA0",
        "TA6",
        "TC1",
        "TD0",
        "TD2",
        "TG0",
        "TG1",
        "TG4",
    ]


def test_get_paced_train_with_exception_simulation(
    west_to_south_east_paced_train: Sequence[Any], small_infra: Infra, session: Session
):
    paced_train = west_to_south_east_paced_train[0]
    paced_train_id = paced_train["id"]

    # Get base paced train simulation
    paced_train_simulation_result = session.get(
        f"{EDITOAST_URL}paced_train/{paced_train_id}/simulation?infra_id={small_infra.id}"
    ).json()

    # Add exception to the paced train
    exception = {
        "key": "exception_key",
        "disabled": False,
        "path_and_schedule": {
            "path": [
                {"id": "id1", "deleted": False, "track": "TA0", "offset": 470000},
                {"id": "id2", "deleted": False, "track": "TG4", "offset": 1993000},
            ],
            "schedule": [],
            "margins": {"boundaries": [], "values": ["0%"]},
            "power_restrictions": [],
        },
        "initial_speed": {"value": 20.0},
    }
    paced_train["exceptions"] = [exception]
    update_response = session.put(
        f"{EDITOAST_URL}paced_train/{paced_train_id}", json=paced_train
    )
    assert update_response.status_code == 204
    # Get exception path
    exception_simulation_result = session.get(
        f"{EDITOAST_URL}paced_train/{paced_train_id}/simulation?infra_id={small_infra.id}&exception_key=exception_key"
    ).json()

    # Check if the response is different from paced train
    assert exception_simulation_result != paced_train_simulation_result


def test_get_and_update_paced_train_result(
    west_to_south_east_paced_train: Sequence[Any], small_infra: Infra, session: Session
):
    paced_train = west_to_south_east_paced_train[0]
    paced_train_id = paced_train["id"]
    response = session.get(f"{EDITOAST_URL}paced_train/{paced_train_id}/")
    if response.status_code // 100 != 2:
        raise RuntimeError(
            f"Paced train error {response.status_code}: {response.content}, id={paced_train_id}"
        )
    response = session.get(
        f"{EDITOAST_URL}paced_train/{paced_train_id}/simulation?infra_id={small_infra.id}"
    )
    simulation_report = response.json()
    assert (
        simulation_report["base"]["energy_consumption"]
        == simulation_report["final_output"]["energy_consumption"]
    )

    response = _update_simulation_with_mareco_allowances(
        EDITOAST_URL, paced_train_id, session
    )
    response = session.get(f"{EDITOAST_URL}paced_train/{paced_train_id}/")
    if response.status_code // 100 != 2:
        raise RuntimeError(
            f"Paced train error {response.status_code}: {response.content}, id={paced_train_id}"
        )

    response = session.get(
        f"{EDITOAST_URL}paced_train/{paced_train_id}/simulation?infra_id={small_infra.id}"
    )
    simulation_report = response.json()
    assert (
        simulation_report["base"]["energy_consumption"]
        != simulation_report["final_output"]["energy_consumption"]
    )
    assert (
        simulation_report["provisional"]["energy_consumption"]
        == simulation_report["final_output"]["energy_consumption"]
    )


def test_editoast_delete(
    west_to_south_east_paced_trains: Sequence[Any], session: Session
):
    paced_trains = west_to_south_east_paced_trains[0:2]
    paced_trains_ids = [paced_train["id"] for paced_train in paced_trains]
    r = session.delete(f"{EDITOAST_URL}paced_train/", json={"ids": paced_trains_ids})
    if r.status_code // 100 != 2:
        raise RuntimeError(
            f"Paced train error {r.status_code}: {r.content}, payload={json.dumps(paced_trains_ids)}"
        )
    r = session.get(
        f"{EDITOAST_URL}paced_train/{paced_trains_ids[0]}/",
    )
    assert r.status_code == 404
    r = session.get(
        f"{EDITOAST_URL}paced_train/{paced_trains_ids[1]}",
    )
    assert r.status_code == 404


def test_etcs_paced_train_braking_curves_endpoint(
    etcs_scenario: Scenario, etcs_rolling_stock: int, session: Session
):
    rolling_stock_response = session.get(
        EDITOAST_URL + f"light_rolling_stock/{etcs_rolling_stock}"
    )
    etcs_rolling_stock_name = rolling_stock_response.json()["name"]
    ts_response = session.post(
        f"{EDITOAST_URL}timetable/{etcs_scenario.timetable}/paced_trains/",
        json=[
            {
                **_get_etcs_braking_curves_train_data(etcs_rolling_stock_name),
                "paced": {
                    "time_window": "PT2H",
                    "interval": "PT15M",
                },
            }
        ],
    )

    paced_train = ts_response.json()[0]
    paced_train_id = paced_train["id"]
    paced_train_id_response = session.get(
        f"{EDITOAST_URL}paced_train/{paced_train_id}/"
    )
    paced_train_id_response.raise_for_status()
    etcs_braking_curves_response = session.get(
        f"{EDITOAST_URL}paced_train/{paced_train_id}/etcs_braking_curves?infra_id={etcs_scenario.infra}"
    )
    _check_etcs_braking_curves_response(etcs_braking_curves_response)
