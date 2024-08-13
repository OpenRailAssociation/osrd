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
from tests.utils.timetable import create_scenario_v2


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
    scenario_id, timetable_id = create_scenario_v2(EDITOAST_URL, tiny_infra.id, foo_project_id, foo_study_id)
    yield Scenario(foo_project_id, foo_study_id, scenario_id, tiny_infra.id, timetable_id)


@pytest.fixture
def small_scenario(small_infra: Infra, foo_project_id: int, foo_study_id: int) -> Iterator[Scenario]:
    scenario_id, timetable_id = create_scenario_v2(EDITOAST_URL, small_infra.id, foo_project_id, foo_study_id)
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
        f"{EDITOAST_URL}/v2/infra/{small_infra.id}/pathfinding/blocks",
        json={
            "path_items": [
                {"offset": 837034, "track": "TA2"},
                {"offset": 4386000, "track": "TH1"},
            ],
            "rolling_stock_is_thermal": True,
            "rolling_stock_loading_gauge": "G1",
            "rolling_stock_supported_electrifications": [],
            "rolling_stock_supported_signaling_systems": ["BAL", "BAPR", "TVM300", "TVM430"],
        },
    )
    yield TrainPath(**response.json())


@pytest.fixture
def west_to_south_east_simulation(
    small_scenario: Scenario,
    fast_rolling_stock: int,
) -> Iterator[Dict]:

    response = requests.get(EDITOAST_URL + f"light_rolling_stock/{fast_rolling_stock}")
    fast_rolling_stock_name = response.json()["name"]
    response = requests.post(
        f"{EDITOAST_URL}v2/timetable/{small_scenario.timetable}/train_schedule/",
        json=[
            {
                "constraint_distribution": "STANDARD",
                "path": [
                    {"offset": 837034, "track": "TA2", "id": "a"},
                    {"offset": 4386000, "track": "TH1", "id": "b"},
                ],
                "rolling_stock_name": fast_rolling_stock_name,
                "train_name": "foo",
                "speed_limit_tag": "foo",
                "start_time": "2024-01-01T07:19:54+00:00",
            }
        ],
    )
    yield response.json()


@pytest.fixture
def west_to_south_east_simulations(
    small_scenario: Scenario,
    fast_rolling_stock: int,
) -> Iterator[Dict]:

    response = requests.get(EDITOAST_URL + f"light_rolling_stock/{fast_rolling_stock}")
    fast_rolling_stock_name = response.json()["name"]

    base = {
        "constraint_distribution": "STANDARD",
        "path": [
            {"offset": 837034, "track": "TA2", "id": "a"},
            {"offset": 4386000, "track": "TH1", "id": "b"},
        ],
        "rolling_stock_name": fast_rolling_stock_name,
        "train_name": "foo",
        "speed_limit_tag": "foo",
    }

    response = requests.post(
        f"{EDITOAST_URL}v2/timetable/{small_scenario.timetable}/train_schedule/",
        json=[
            {
                **base,
                "start_time": "2024-01-01T07:19:54+00:00",
            },
            {
                **base,
                "start_time": "2024-01-01T07:29:54+00:00",
            },
            {
                **base,
                "start_time": "2024-01-01T07:39:59+00:00",
            },
        ],
    )
    yield response.json()


@pytest.fixture
def timetable_v2_id() -> int:
    r = requests.post(f"{EDITOAST_URL}v2/timetable/")
    if not r.ok:
        raise RuntimeError(f"Error creating timetable {r.status_code}: {r.content}")
    return r.json()["timetable_id"]
