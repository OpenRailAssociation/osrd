import requests

from .services import API_URL


def test_api_root():
    r = requests.get(API_URL)
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Error {r.status_code} on get {API_URL}: {r.content}")
    assert len(r.json()) > 0
