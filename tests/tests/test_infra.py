import pytest
import requests

from .services import API_URL


@pytest.mark.usefixtures("dummy_scenario")
def test_get_infra():
    r = requests.get(API_URL + "infra/")
    if r.status_code // 100 != 2:
        raise RuntimeError(f"infra error {r.status_code}: {r.content}")
    infras = r.json()["results"]
    assert "dummy_infra" in [infra["name"] for infra in infras]
