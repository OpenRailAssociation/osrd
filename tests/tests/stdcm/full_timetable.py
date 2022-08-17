import requests

from tests.get_rolling_stocks import get_rolling_stock
from tests.stdcm.utils import add_train, get_schedule_longest_occupancy, get_schedule_arrival_time
from tests.utils.timetable import delete_timetable, create_timetable


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
    train1 = add_train(base_url, infra_id, timetable, start, stop, 0)
    min_interval = get_schedule_longest_occupancy(base_url, train1)
    train2 = add_train(base_url, infra_id, timetable, start, stop, min_interval * 1.5)
    payload = {
        "infra": infra_id,
        "rolling_stock": get_rolling_stock(base_url),
        "timetable": timetable,
        "start_time": 0,
        "name": "foo",
        "start_points": [start],
        "end_points": [stop]
    }
    r = requests.post(base_url + f"stdcm/", json=payload)
    delete_timetable(base_url, timetable)
    if r.status_code // 100 != 2:
        raise RuntimeError(f"STDCM error {r.status_code}: {r.content}")
    response = r.json()
    stdcm_arrival_time = response["simulation"]["base"]["head_positions"][-1]["time"]
    train2_arrival_time = get_schedule_arrival_time(base_url, train2)
    minimum_expected_arrival = train2_arrival_time + min_interval
    assert stdcm_arrival_time >= minimum_expected_arrival
    return True, ""
