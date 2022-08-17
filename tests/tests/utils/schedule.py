from tests.get_timetable import get_timetable


def make_payload_schedule(base_url, infra, path, rolling_stock, departure_time=0, timetable=None):
    if timetable is None:
        timetable = get_timetable(base_url, infra)
    return {
        "timetable": timetable,
        "path": path,
        "schedules": [
            {
                "train_name": "foo",
                "labels": [],
                "allowances": [],
                "departure_time": departure_time,
                "initial_speed": 0,
                "rolling_stock": rolling_stock,
                "speed_limit_category": "foo",
            }
        ],
    }
