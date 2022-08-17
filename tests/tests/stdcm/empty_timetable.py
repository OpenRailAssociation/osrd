import requests

from tests.get_rolling_stocks import get_rolling_stock
from tests.utils.timetable import delete_timetable, create_timetable


def run(*args, **kwargs):
    base_url = kwargs["url"]
    infra_id = kwargs["all_infras"]["small_infra"]
    timetable = create_timetable(base_url, infra_id)
    payload = {
        "infra": infra_id,
        "rolling_stock": get_rolling_stock(base_url),
        "timetable": timetable,
        "start_time": 0,
        "name": "foo",
        "start_points": [{
            "track_section": "TE1",
            "offset": 0
        }],
        "end_points": [{
            "track_section": "TE0",
            "offset": 0
        }]
    }
    r = requests.post(base_url + f"stdcm/", json=payload)
    delete_timetable(base_url, timetable)
    if r.status_code // 100 != 2:
        raise RuntimeError(f"STDCM error {r.status_code}: {r.content}")
    return True, ""
