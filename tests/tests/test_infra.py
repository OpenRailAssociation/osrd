from dataclasses import dataclass
from typing import Any
from collections.abc import Iterable, Mapping

import pytest
from requests import Session

from .services import EDITOAST_URL


@dataclass(frozen=True)
class _InfraDetails:
    id: int
    name: str
    railjson_version: str
    version: str
    generated_version: str | None
    locked: bool
    created: str
    modified: str


@dataclass(frozen=True)
class _InfraResponse:
    count: int
    page_size: int
    page_count: int
    current: int
    previous: int | None
    next: int | None
    results: Iterable[Mapping[str, Any]]


@pytest.mark.usefixtures("tiny_infra")
def test_get_infra(session: Session):
    page = 1
    names = []
    while page is not None:
        response = session.get(EDITOAST_URL + "infra/", params={"page": page})
        assert response.status_code == 200
        body = response.json()
        infra_response = _InfraResponse(**body)
        names.extend(_InfraDetails(**infra).name for infra in infra_response.results)
        page = body.get("next")
    assert "tiny_infra" in names
