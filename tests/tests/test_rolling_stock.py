import json

import pytest
import requests
from osrd_schemas.rolling_stock import RollingStock

from . import FAST_ROLLING_STOCK_JSON_PATH
from .services import API_URL

_FAST_ROLLING_STOCK = RollingStock(**json.loads(FAST_ROLLING_STOCK_JSON_PATH.read_text()))


@pytest.mark.usefixtures("fast_rolling_stock")
def test_get_rolling_stocks():
    response = requests.get(API_URL + "rolling_stock/?page_size=1000")
    assert response.status_code == 200
    rolling_stock_result = next(
        iter(
            [
                rolling_stock
                for rolling_stock in response.json()["results"]
                if rolling_stock["name"] == "fast_rolling_stock"
            ]
        )
    )
    # no need to check that id is the same
    rolling_stock_result.pop("id")
    assert [] == rolling_stock_result.pop("liveries")
    assert RollingStock(**rolling_stock_result) == _FAST_ROLLING_STOCK
