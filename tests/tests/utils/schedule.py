def make_payload_schedule(base_url, scenario, path, rolling_stock, departure_time=0):
    return {
        "timetable": scenario.timetable,
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
