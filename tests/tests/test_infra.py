from dataclasses import dataclass
from typing import Any, Iterable, Mapping, Optional

import pytest
import requests

from .services import API_URL


@dataclass(frozen=True)
class _InfraDetails:
    id: int
    name: str
    railjson_version: str
    owner: str
    version: str
    generated_version: Optional[str]
    locked: bool
    created: str
    modified: str


@dataclass(frozen=True)
class _InfraResponse:
    count: int
    next: Optional[Any]
    previous: Optional[Any]
    results: Iterable[Mapping[str, Any]]


@pytest.mark.usefixtures("tiny_infra")
def test_get_infra():
    response = requests.get(API_URL + "infra/")
    assert response.status_code == 200
    body = response.json()
    infra_response = _InfraResponse(**body)
    assert "tiny_infra" in [_InfraDetails(**infra).name for infra in infra_response.results]
