import pytest
import requests

from .services import API_URL


@pytest.mark.usefixtures("scenarios")
def test_get_rolling_stock():
    r = requests.get(API_URL + "rolling_stock/?page_size=1000")
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Rolling stock error {r.status_code}: {r.content}")
    assert "fast_rolling_stock" in [rolling_stock["name"] for rolling_stock in r.json()["results"]]
