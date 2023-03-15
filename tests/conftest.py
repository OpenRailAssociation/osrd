import subprocess
import sys
from pathlib import Path

import pytest
import requests

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
def dummy_infra_id() -> int:
    result = subprocess.check_output(
        ["docker", "exec", "osrd-api", "python", "manage.py", "setup_dummy_db"],
    )
    infra_id = int(result)
    yield infra_id
    requests.delete(EDITOAST_URL + f"infra/{infra_id}/")


@pytest.fixture(scope="session")
def tiny_infra_id() -> int:
    infra_id = _load_generated_infra("tiny_infra")
    yield infra_id
    requests.delete(EDITOAST_URL + f"infra/{infra_id}/")


@pytest.fixture(scope="session")
def small_infra_id() -> int:
    infra_id = _load_generated_infra("small_infra")
    yield infra_id
    requests.delete(EDITOAST_URL + f"infra/{infra_id}/")


@pytest.fixture
def foo_project_id() -> int:
    response = requests.post(API_URL + "projects/", json={"name": "foo"})
    project_id = response.json()["id"]
    yield project_id
    requests.delete(API_URL + f"projects/{project_id}/")


@pytest.fixture
def foo_study_id(foo_project_id: int) -> int:
    payload = {"name": "foo", "service_code": "AAA", "business_code": "BBB"}
    res = requests.post(API_URL + f"projects/{foo_project_id}/studies/", json=payload)
    yield res.json()["id"]


@pytest.fixture
def dummy_scenario(dummy_infra_id: int, foo_project_id: int, foo_study_id: int) -> Scenario:
    scenario_id, timetable_id = create_scenario(API_URL, dummy_infra_id, foo_project_id, foo_study_id)
    yield Scenario(foo_project_id, foo_study_id, scenario_id, dummy_infra_id, timetable_id)


@pytest.fixture
def tiny_scenario(tiny_infra_id: int, foo_project_id: int, foo_study_id: int) -> Scenario:
    scenario_id, timetable_id = create_scenario(API_URL, tiny_infra_id, foo_project_id, foo_study_id)
    yield Scenario(foo_project_id, foo_study_id, scenario_id, tiny_infra_id, timetable_id)


@pytest.fixture
def small_scenario(small_infra_id: int, foo_project_id: int, foo_study_id: int) -> Scenario:
    scenario_id, timetable_id = create_scenario(API_URL, small_infra_id, foo_project_id, foo_study_id)
    yield Scenario(foo_project_id, foo_study_id, scenario_id, small_infra_id, timetable_id)
