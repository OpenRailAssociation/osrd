import subprocess
import requests


def run(*args, **kwargs):
    url = kwargs["url"]
    r = requests.get(url)
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Error {r.status_code} on get {url}: {r.content}")
    assert len(r.json()) > 0
    return True, ""
