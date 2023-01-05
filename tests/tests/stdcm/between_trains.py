import requests

from tests.get_rolling_stocks import get_rolling_stock
from tests.stdcm.utils import add_train


def run(*args, **kwargs):
    base_url = kwargs["url"]
    scenario = kwargs["all_scenarios"]["small_infra"]

    start = {"track_section": "TE1", "offset": 0}
    stop = {"track_section": "TE0", "offset": 0}
    add_train(base_url, scenario, start, stop, 0)
    add_train(base_url, scenario, start, stop, 10000)
    payload = {
        "infra": scenario.infra,
        "rolling_stock": get_rolling_stock(base_url),
        "timetable": scenario.timetable,
        "start_time": 5000,
        "name": "foo",
        "start_points": [start],
        "end_points": [stop],
    }
    r = requests.post(base_url + "stdcm/", json=payload)
    if r.status_code // 100 != 2:
        raise RuntimeError(f"STDCM error {r.status_code}: {r.content}")
    return True, ""
