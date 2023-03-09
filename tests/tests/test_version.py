import pytest
import requests

from .services import API_URL


@pytest.mark.parametrize("endpoint", ("api/", "core/"))
def test_version_endpoint(endpoint: str):
    r = requests.get(f"{API_URL}version/{endpoint}")
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Error {r.status_code} on get {API_URL}: {r.content}")
    body = r.json()
    assert "git_describe" in body
