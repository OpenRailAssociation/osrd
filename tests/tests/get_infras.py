import requests


def get_infras(base_url):
    r = requests.get(base_url + "infra/")
    if r.status_code // 100 != 2:
        raise RuntimeError(f"infra error {r.status_code}: {r.content}")
    infras = r.json()["results"]
    return infras


def run(*args, **kwargs):
    base_url = kwargs["url"]
    get_infras(base_url)
    return True, ""
