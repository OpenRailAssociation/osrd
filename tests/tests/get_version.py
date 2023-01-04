import subprocess
import requests

def test_version_endpoint(url):
    r = requests.get(url)
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Error {r.status_code} on get {url}: {r.content}")
    r = r.json()
    assert type(r) == dict
    assert "git_describe" in r

def run(*args, **kwargs):
    url = kwargs["url"]
    test_version_endpoint(url + '/version/api/')
    test_version_endpoint(url + '/version/core/')
    return True, ""
