from dataclasses import dataclass
from typing import Any, Iterable, Optional

import requests

from .scenario import Scenario
from .services import API_URL


@dataclass(frozen=True)
class _ScenarioResponse:
    id: int
    name: str
    description: str
    timetable: int
    infra: int
    electrical_profile_set: Optional[Any]
    trains_count: int
    creation_date: str
    last_modification: str
    tags: Optional[Any]
    infra_name: str
    electrical_profile_set_name: Optional[Any]
    train_schedules: Iterable[Any]


def test_get_scenario(dummy_scenario: Scenario):
    response = requests.get(
        API_URL
        + f"projects/{dummy_scenario.project}/studies/{dummy_scenario.op_study}/scenarios/{dummy_scenario.scenario}/"
    )
    assert response.status_code == 200
    body = _ScenarioResponse(**response.json())
    assert body.name == "foo"
