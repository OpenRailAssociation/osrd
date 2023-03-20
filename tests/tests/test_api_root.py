import requests

from .services import API_URL


def test_api_root():
    r = requests.get(API_URL)
    assert r.status_code == 200
    assert len(r.json()) > 0
