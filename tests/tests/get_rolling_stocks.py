import requests


def get_rolling_stock(base_url):
    r = requests.get(base_url + "rolling_stock/?page_size=1000")
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Rolling stock error {r.status_code}: {r.content}")
    stocks = r.json()["results"]
    for stock in stocks:
        if stock["name"] == "fast_rolling_stock":
            return stock["id"]
    raise RuntimeError("Missing rolling stock")


def run(*args, **kwargs):
    base_url = kwargs["url"]
    get_rolling_stock(base_url)
    return True, ""
