from dataclasses import dataclass
from typing import Any, Iterable, Optional

import requests

from .scenario import Scenario
from .services import EDITOAST_URL


@dataclass(frozen=True)
class _ScenarioResponse:
    id: int
    study_id: int
    name: str
    description: str
    timetable_id: int
    infra_id: int
    electrical_profile_set_id: Optional[Any]
    trains_count: int
    creation_date: str
    last_modification: str
    tags: Optional[Any]
    infra_name: str
    electrical_profile_set_name: Optional[Any]
    train_schedules: Iterable[Any]


def test_get_scenario(small_scenario: Scenario):
    response = requests.get(
        EDITOAST_URL
        + f"projects/{small_scenario.project}/studies/{small_scenario.op_study}/scenarios/{small_scenario.scenario}/"
    )
    print(response.content)
    assert response.status_code == 200
    body = _ScenarioResponse(**response.json())
    assert body.name == "Scenario test 1"
