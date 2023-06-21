import json
from pathlib import Path
from typing import Any, Iterable, List, Mapping, Optional

import pytest
import requests
from railjson_generator.scripts.generate import main

from tests import FAST_ROLLING_STOCK_JSON_PATH
from tests.infra import Infra
from tests.path import Path as TrainPath
from tests.scenario import Scenario
from tests.services import API_URL, EDITOAST_URL
from tests.utils.timetable import create_scenario


def _load_generated_infra(name: str) -> int:
    output = Path("/tmp/osrd-generated-examples")
    infra = output / f"{name}/infra.json"
    main([name], output)
    with open(infra) as json_infra:
        res = requests.post(EDITOAST_URL + f"infra/railjson?name={name}&generate_data=true", json=json.load(json_infra))
    return res.json()["infra"]


@pytest.fixture(scope="session")
def tiny_infra() -> Infra:
    infra_id = _load_generated_infra("tiny_infra")
    yield Infra(infra_id, "tiny_infra")
    requests.delete(EDITOAST_URL + f"infra/{infra_id}/")


@pytest.fixture(scope="session")
def small_infra() -> Infra:
    """small_infra screenshot in `tests/README.md`"""
    infra_id = _load_generated_infra("small_infra")
    yield Infra(infra_id, "small_infra")
    requests.delete(EDITOAST_URL + f"infra/{infra_id}/")


@pytest.fixture
def foo_project_id() -> int:
    response = requests.post(
        EDITOAST_URL + "projects/",
        json={
            "name": "_@Test integration project",
            "description": "",
            "objectives": "",
            "funders": "",
            "tags": [],
            "budget": 0,
        },
    )
    project_id = response.json()["id"]
    yield project_id
    requests.delete(EDITOAST_URL + f"projects/{project_id}/")


@pytest.fixture
def foo_study_id(foo_project_id: int) -> int:
    payload = {
        "name": "_@Test integration study",
        "service_code": "AAA",
        "business_code": "BBB",
        "tags": [],
    }
    res = requests.post(EDITOAST_URL + f"projects/{foo_project_id}/studies/", json=payload)
    yield res.json()["id"]


@pytest.fixture
def tiny_scenario(tiny_infra: Infra, foo_project_id: int, foo_study_id: int) -> Scenario:
    scenario_id, timetable_id = create_scenario(EDITOAST_URL, tiny_infra.id, foo_project_id, foo_study_id)
    yield Scenario(foo_project_id, foo_study_id, scenario_id, tiny_infra.id, timetable_id)


@pytest.fixture
def small_scenario(small_infra: Infra, foo_project_id: int, foo_study_id: int) -> Scenario:
    scenario_id, timetable_id = create_scenario(EDITOAST_URL, small_infra.id, foo_project_id, foo_study_id)
    yield Scenario(foo_project_id, foo_study_id, scenario_id, small_infra.id, timetable_id)


def _create_fast_rolling_stocks(names_and_metadata: Optional[Mapping[str, Mapping[str, str]]] = None):
    payload = json.loads(FAST_ROLLING_STOCK_JSON_PATH.read_text())
    ids = []
    if names_and_metadata is None:
        ids.append(requests.post(f"{EDITOAST_URL}rolling_stock/", json=payload).json()["id"])
    else:
        for name, metadata in names_and_metadata.items():
            payload["name"] = name
            payload["metadata"] = metadata
            ids.append(requests.post(f"{EDITOAST_URL}rolling_stock/", json=payload).json()["id"])
    return ids


@pytest.fixture
def fast_rolling_stocks(request: Any) -> Iterable[int]:
    ids = _create_fast_rolling_stocks(request.node.get_closest_marker("names_and_metadata").args[0])
    yield ids
    for id in ids:
        requests.delete(f"{EDITOAST_URL}rolling_stock/{id}?force=true")


@pytest.fixture
def fast_rolling_stock() -> int:
    id = _create_fast_rolling_stocks()[0]
    yield id
    requests.delete(f"{EDITOAST_URL}rolling_stock/{id}?force=true")


@pytest.fixture
def west_to_south_east_path(small_infra: Infra, fast_rolling_stock: int) -> TrainPath:
    """west_to_south_east_path screenshot in `tests/README.md`"""
    requests.post(f"{EDITOAST_URL}infra/{small_infra.id}/load").raise_for_status()
    response = requests.post(
        f"{EDITOAST_URL}pathfinding/",
        json={
            "infra": small_infra.id,
            "steps": [
                {
                    "duration": 0,
                    "waypoints": [
                        {
                            "track_section": "TA2",
                            "geo_coordinate": [-0.387122554630656, 49.4998],
                        }
                    ],
                },
                {
                    "duration": 1,
                    "waypoints": [
                        {
                            "track_section": "TH1",
                            "geo_coordinate": [-0.095104854807785, 49.484],
                        }
                    ],
                },
            ],
            "rolling_stocks": [fast_rolling_stock],
        },
    )
    yield TrainPath(**response.json())


@pytest.fixture
def west_to_south_east_simulation(
    small_scenario: Scenario,
    west_to_south_east_path: TrainPath,
    fast_rolling_stock: int,
) -> List[int]:
    response = requests.post(
        f"{API_URL}train_schedule/standalone_simulation/",
        json={
            "timetable": small_scenario.timetable,
            "path": west_to_south_east_path.id,
            "schedules": [
                {
                    "train_name": "foo",
                    "labels": [],
                    "allowances": [],
                    "departure_time": 0,
                    "initial_speed": 0,
                    "rolling_stock": fast_rolling_stock,
                    "speed_limit_category": "foo",
                }
            ],
        },
    )
    yield response.json()["ids"]
