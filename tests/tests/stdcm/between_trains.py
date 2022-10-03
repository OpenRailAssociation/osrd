import requests
from tests.get_rolling_stocks import get_rolling_stock
from tests.stdcm.utils import (add_train, get_schedule_arrival_time,
                               get_schedule_longest_occupancy)
from tests.utils.timetable import create_timetable, delete_timetable


def run(*args, **kwargs):
    base_url = kwargs["url"]
    infra_id = kwargs["all_infras"]["small_infra"]
    timetable = create_timetable(base_url, infra_id)
    start = {
        "track_section": "TE1",
        "offset": 0
    }
    stop = {
        "track_section": "TE0",
        "offset": 0
    }
    add_train(base_url, infra_id, timetable, start, stop, 0)
    add_train(base_url, infra_id, timetable, start, stop, 10000)
    payload = {
        "infra": infra_id,
        "rolling_stock": get_rolling_stock(base_url),
        "timetable": timetable,
        "start_time": 5000,
        "name": "foo",
        "start_points": [start],
        "end_points": [stop]
    }
    r = requests.post(base_url + f"stdcm/", json=payload)
    delete_timetable(base_url, timetable)
    if r.status_code // 100 != 2:
        raise RuntimeError(f"STDCM error {r.status_code}: {r.content}")
    return True, ""
