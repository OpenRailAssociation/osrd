import json
from pathlib import Path
from typing import Dict, Iterable, Iterator, List, Optional

import pytest
import requests

from tests.infra import Infra
from tests.path import Path as TrainPath
from tests.scenario import Scenario
from tests.services import EDITOAST_URL
from tests.test_e2e import FAST_ROLLING_STOCK_JSON_PATH, TestRollingStock
from tests.utils.timetable import create_scenario, create_scenario_v2


def _load_generated_infra(name: str) -> int:
    infra_path = Path(__file__).parent / f"data/infras/{name}/infra.json"
    with infra_path.open() as json_infra:
        infra_json = json.load(json_infra)
    res = requests.post(EDITOAST_URL + f"infra/railjson?name={name}&generate_data=true", json=infra_json)
    res.raise_for_status()
    return res.json()["infra"]


@pytest.fixture(scope="session")
def tiny_infra() -> Iterator[Infra]:
    infra_id = _load_generated_infra("tiny_infra")
    yield Infra(infra_id, "tiny_infra")
    requests.delete(EDITOAST_URL + f"infra/{infra_id}/")


@pytest.fixture(scope="session")
def small_infra() -> Iterator[Infra]:
    """small_infra screenshot in `tests/README.md`"""
    infra_id = _load_generated_infra("small_infra")
    yield Infra(infra_id, "small_infra")
    requests.delete(EDITOAST_URL + f"infra/{infra_id}/")


@pytest.fixture
def foo_project_id() -> Iterator[int]:
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
def foo_study_id(foo_project_id: int) -> Iterator[int]:
    payload = {
        "name": "_@Test integration study",
        "state": "Starting",
        "service_code": "AAA",
        "business_code": "BBB",
        "tags": [],
    }
    res = requests.post(EDITOAST_URL + f"projects/{foo_project_id}/studies/", json=payload)
    yield res.json()["id"]


@pytest.fixture
def tiny_scenario(tiny_infra: Infra, foo_project_id: int, foo_study_id: int) -> Iterator[Scenario]:
    scenario_id, timetable_id = create_scenario(EDITOAST_URL, tiny_infra.id, foo_project_id, foo_study_id)
    yield Scenario(foo_project_id, foo_study_id, scenario_id, tiny_infra.id, timetable_id)


@pytest.fixture
def small_scenario(small_infra: Infra, foo_project_id: int, foo_study_id: int) -> Iterator[Scenario]:
    scenario_id, timetable_id = create_scenario(EDITOAST_URL, small_infra.id, foo_project_id, foo_study_id)
    yield Scenario(foo_project_id, foo_study_id, scenario_id, small_infra.id, timetable_id)


@pytest.fixture
def small_scenario_v2(small_infra: Infra, foo_project_id: int, foo_study_id: int) -> Iterator[Scenario]:
    scenario_id, timetable_id = create_scenario_v2(EDITOAST_URL, small_infra.id, foo_project_id, foo_study_id)
    yield Scenario(foo_project_id, foo_study_id, scenario_id, small_infra.id, timetable_id)


def get_rolling_stock(editoast_url: str, rolling_stock_name: str) -> int:
    """
    Returns the ID corresponding to the rolling stock name, if available.
    :param editoast_url: Api url
    :param rolling_stock_name: name of the rolling stock
    :return: ID the rolling stock
    """
    page = 1
    while page is not None:
        # TODO: feel free to reduce page_size when https://github.com/OpenRailAssociation/osrd/issues/5350 is fixed
        r = requests.get(editoast_url + "light_rolling_stock/", params={"page": page, "page_size": 1_000})
        if r.status_code // 100 != 2:
            raise RuntimeError(f"Rolling stock error {r.status_code}: {r.content}")
        rjson = r.json()
        for rolling_stock in rjson["results"]:
            if rolling_stock["name"] == rolling_stock_name:
                return rolling_stock["id"]
        page = rjson.get("next")
    raise ValueError(f"Unable to find rolling stock {rolling_stock_name}")


def create_fast_rolling_stocks(test_rolling_stocks: Optional[List[TestRollingStock]] = None):
    if test_rolling_stocks is None:
        payload = json.loads(FAST_ROLLING_STOCK_JSON_PATH.read_text())
        response = requests.post(f"{EDITOAST_URL}rolling_stock/", json=payload)
        rjson = response.json()
        if response.status_code // 100 == 4 and "NameAlreadyUsed" in rjson["type"]:
            return [get_rolling_stock(EDITOAST_URL, rjson["context"]["name"])]
        assert "id" in rjson, f"Failed to create rolling stock: {rjson}"
        return [rjson["id"]]
    ids = []
    for rs in test_rolling_stocks:
        payload = json.loads(rs.base_path.read_text())
        payload["name"] = rs.name
        payload["metadata"] = rs.metadata
        ids.append(requests.post(f"{EDITOAST_URL}rolling_stock/", json=payload).json()["id"])
    return ids


@pytest.fixture
def fast_rolling_stocks(request: pytest.FixtureRequest) -> Iterator[Iterable[int]]:
    ids = create_fast_rolling_stocks(request.node.get_closest_marker("names_and_metadata").args[0])
    yield ids
    for id in ids:
        requests.delete(f"{EDITOAST_URL}rolling_stock/{id}?force=true")


@pytest.fixture
def fast_rolling_stock() -> Iterator[int]:
    id = create_fast_rolling_stocks()[0]
    yield id
    requests.delete(f"{EDITOAST_URL}rolling_stock/{id}?force=true")


@pytest.fixture
def west_to_south_east_path(small_infra: Infra, fast_rolling_stock: int) -> Iterator[TrainPath]:
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
) -> Iterator[Dict]:
    response = requests.post(
        f"{EDITOAST_URL}train_schedule/standalone_simulation/",
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
                    "rolling_stock_id": fast_rolling_stock,
                    "speed_limit_category": "foo",
                }
            ],
        },
    )
    yield response.json()


@pytest.fixture
def west_to_south_east_simulations(
    small_scenario: Scenario,
    west_to_south_east_path: TrainPath,
    fast_rolling_stock: int,
) -> Iterator[Dict]:
    base = {
        "train_name": "foo",
        "labels": [],
        "allowances": [],
        "departure_time": 0,
        "initial_speed": 0,
        "rolling_stock_id": fast_rolling_stock,
        "speed_limit_category": "foo",
    }
    response = requests.post(
        f"{EDITOAST_URL}train_schedule/standalone_simulation/",
        json={
            "timetable": small_scenario.timetable,
            "path": west_to_south_east_path.id,
            "schedules": [
                {
                    **base,
                    "departure_time": 0,
                },
                {
                    **base,
                    "departure_time": 3600,
                },
                {
                    **base,
                    "departure_time": 5200,
                },
            ],
        },
    )
    yield response.json()


@pytest.fixture
def timetable_v2_id() -> int:
    r = requests.post(f"{EDITOAST_URL}v2/timetable/")
    if not r.ok:
        raise RuntimeError(f"Error creating timetable {r.status_code}: {r.content}")
    return r.json()["timetable_id"]
