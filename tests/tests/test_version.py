import requests

from .services import EDITOAST_URL


def test_version_endpoint():
    r = requests.get(f"{EDITOAST_URL}version")
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Error {r.status_code} on get {EDITOAST_URL}: {r.content}")
    body = r.json()
    assert "git_describe" in body
