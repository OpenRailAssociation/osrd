import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping

import pytest
import requests

from tests.services import API_URL, EDITOAST_URL
from tests.utils.timetable import create_op_study, create_project, create_scenario


@dataclass(frozen=True)
class Scenario:
    project: int
    op_study: int
    scenario: int
    infra: int
    timetable: int


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
def scenarios():
    # Setup project and operational study
    project_id = create_project(API_URL)
    op_study_id = create_op_study(API_URL, project_id)

    # Setup dummy infra with scenario
    result = subprocess.check_output(
        ["docker", "exec", "osrd-api", "python", "manage.py", "setup_dummy_db"],
    )
    infra_id = int(result)
    scenario_id, timetable_id = create_scenario(API_URL, infra_id, project_id, op_study_id)

    # Setup dummy, small and tiny infra with their scenarios
    scenarios = {}
    scenarios["dummy"] = Scenario(project_id, op_study_id, scenario_id, infra_id, timetable_id)
    for infra in ["small_infra", "tiny_infra"]:
        infra_id = _load_generated_infra(infra)
        scenario_id, timetable_id = create_scenario(API_URL, infra_id, project_id, op_study_id)
        scenarios[infra] = Scenario(project_id, op_study_id, scenario_id, infra_id, timetable_id)
    yield scenarios
    project = scenarios["dummy"].project
    response = requests.delete(API_URL + f"projects/{project}/")
    for scenario in scenarios.values():
        infra_id = scenario.infra
        response = requests.delete(EDITOAST_URL + f"infra/{infra_id}/")
        if response.status_code // 100 != 2:
            raise RuntimeError(f"Cleanup failed, code {response.status_code}: {response.content}")


@pytest.fixture
def dummy_scenario(scenarios: Mapping[str, Scenario]) -> Scenario:
    yield scenarios["dummy"]


@pytest.fixture
def small_scenario(scenarios: Mapping[str, Scenario]) -> Scenario:
    yield scenarios["small_infra"]


@pytest.fixture
def tiny_infra(scenarios: Mapping[str, Scenario]) -> Scenario:
    yield scenarios["tiny_infra"]
