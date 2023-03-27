import json
import subprocess
import sys
from pathlib import Path
from typing import List

import pytest
import requests

from tests import FAST_ROLLING_STOCK_JSON_PATH
from tests.infra import Infra
from tests.path import Path as TrainPath
from tests.scenario import Scenario
from tests.services import API_URL, EDITOAST_URL
from tests.utils.timetable import create_scenario


def _load_generated_infra(name: str) -> int:
    generator = Path(__file__).resolve().parents[1] / "core/examples/generated/generate.py"
    output = Path("/tmp/osrd-generated-examples")
    infra = output / f"{name}/infra.json"
    subprocess.check_call([sys.executable, str(generator), str(output), name])
    subprocess.check_call(["docker", "cp", str(infra), "osrd-api:/infra.json"])
    result = subprocess.check_output(
        [
            "docker",
            "exec",
            "osrd-api",
            "python",
            "manage.py",
            "import_railjson",
            name,
            "/infra.json",
        ],
    )
    id = int(result.split()[-1])
    return id


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
        API_URL + "projects/",
        json={"name": "foo", "description": "", "objectives": "", "funders": "", "tags": [], "budget": 0},
    )
    project_id = response.json()["id"]
    yield project_id
    requests.delete(API_URL + f"projects/{project_id}/")


@pytest.fixture
def foo_study_id(foo_project_id: int) -> int:
    payload = {"name": "foo", "service_code": "AAA", "business_code": "BBB", "tags": []}
    res = requests.post(API_URL + f"projects/{foo_project_id}/studies/", json=payload)
    yield res.json()["id"]


@pytest.fixture
def tiny_scenario(tiny_infra: Infra, foo_project_id: int, foo_study_id: int) -> Scenario:
    scenario_id, timetable_id = create_scenario(API_URL, tiny_infra.id, foo_project_id, foo_study_id)
    yield Scenario(foo_project_id, foo_study_id, scenario_id, tiny_infra.id, timetable_id)


@pytest.fixture
def small_scenario(small_infra: Infra, foo_project_id: int, foo_study_id: int) -> Scenario:
    scenario_id, timetable_id = create_scenario(API_URL, small_infra.id, foo_project_id, foo_study_id)
    yield Scenario(foo_project_id, foo_study_id, scenario_id, small_infra.id, timetable_id)


def _get_or_create_fast_rolling_stock_id():
    response = requests.post(f"{API_URL}/rolling_stock/", json=json.loads(FAST_ROLLING_STOCK_JSON_PATH.read_text()))
    if response.status_code == 200:
        return response.json()["id"]
    # Rolling stock already exists
    response = requests.get(f"{API_URL}rolling_stock/?page_size=1000")
    rolling_stocks = response.json()["results"]
    return next(
        iter([rolling_stock["id"] for rolling_stock in rolling_stocks if rolling_stock["name"] == "fast_rolling_stock"])
    )


@pytest.mark.usefixtures("small_infra")
@pytest.fixture
def fast_rolling_stock() -> int:
    """Return fast_rolling_stock loaded with small infra."""
    yield _get_or_create_fast_rolling_stock_id()


@pytest.fixture
def west_to_south_east_path(small_infra: Infra, fast_rolling_stock: int) -> TrainPath:
    """west_to_south_east_path screenshot in `tests/README.md`"""
    response = requests.post(
        f"{API_URL}pathfinding/",
        json={
            "infra": small_infra.id,
            "steps": [
                {
                    "duration": 0,
                    "waypoints": [{"track_section": "TA2", "geo_coordinate": [-0.387122554630656, 49.4998]}],
                },
                {
                    "duration": 1,
                    "waypoints": [{"track_section": "TH1", "geo_coordinate": [-0.095104854807785, 49.484]}],
                },
            ],
            "rolling_stocks": [fast_rolling_stock],
        },
    )
    yield TrainPath(**response.json())


@pytest.fixture
def west_to_south_east_simulation(
    small_scenario: Scenario, west_to_south_east_path: TrainPath, fast_rolling_stock: int
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
