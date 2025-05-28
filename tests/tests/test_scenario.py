from dataclasses import dataclass

from requests import Session

from .scenario import Scenario
from .services import EDITOAST_URL


@dataclass(frozen=True)
class _Project:
    id: int
    name: str
    objectives: str
    description: str
    funders: str
    budget: int
    creation_date: str
    last_modification: str
    tags: list[str]
    image: int | None


@dataclass(frozen=True)
class _Study:
    id: int
    name: str
    description: str
    business_code: str
    service_code: str
    creation_date: str
    last_modification: str
    start_date: str | None
    expected_end_date: str | None
    actual_end_date: str | None
    budget: int
    tags: list[str]
    state: str
    study_type: str
    project_id: int


@dataclass(frozen=True)
class _ScenarioResponse:
    id: int
    study_id: int
    name: str
    description: str
    timetable_id: int
    infra_id: int
    electrical_profile_set_id: int | None
    trains_count: int
    paced_trains_count: int
    creation_date: str
    last_modification: str
    tags: list[str]
    infra_name: str
    project: _Project
    study: _Study


def test_get_scenario(small_scenario: Scenario, session: Session):
    response = session.get(
        EDITOAST_URL
        + f"/projects/{small_scenario.project}/studies/{small_scenario.op_study}/scenarios/{small_scenario.scenario}/"
    )
    assert response.status_code == 200
    res = response.json()
    project, study = res.get("project"), res.get("study")
    if project and study:
        del res["project"]
        del res["study"]
        scenario = _ScenarioResponse(
            **res,
            project=_Project(**project),
            study=_Study(**study),
            electrical_profile_set_id=None,
        )
        assert scenario.name == "_@Test integration scenario"
    else:
        raise ValueError("Missing project or study")
