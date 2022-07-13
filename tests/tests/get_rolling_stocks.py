import requests


def get_rolling_stock(base_url):
    r = requests.get(base_url + "rolling_stock/")
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Rolling stock error {r.status_code}: {r.content}")
    stocks = r.json()["results"]
    return stocks[0]["id"]


def run(*args, **kwargs):
    base_url = kwargs["url"]
    get_rolling_stock(base_url)
    return True, ""
