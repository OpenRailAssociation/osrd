import requests

from .services import EDITOAST_URL


def test_get_rolling_stocks(fast_rolling_stock: int):
    response = requests.get(EDITOAST_URL + f"light_rolling_stock/{fast_rolling_stock}")
    assert response.status_code == 200
    assert response.json()["name"] == "fast_rolling_stock"
