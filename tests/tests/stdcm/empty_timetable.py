import requests

from tests.get_rolling_stocks import get_rolling_stock
from tests.utils.timetable import (
    create_op_study,
    create_project,
    create_scenario,
    delete_project,
)


def run(*args, **kwargs):
    base_url = kwargs["url"]
    infra_id = kwargs["all_scenarios"]["small_infra"].infra
    project = create_project(base_url)
    op_study = create_op_study(base_url, project)
    _, timetable = create_scenario(base_url, infra_id, project, op_study)
    payload = {
        "infra": infra_id,
        "rolling_stock": get_rolling_stock(base_url),
        "timetable": timetable,
        "start_time": 0,
        "name": "foo",
        "start_points": [{"track_section": "TE1", "offset": 0}],
        "end_points": [{"track_section": "TE0", "offset": 0}],
    }
    r = requests.post(base_url + "stdcm/", json=payload)
    delete_project(base_url, project)
    if r.status_code // 100 != 2:
        raise RuntimeError(f"STDCM error {r.status_code}: {r.content}")
    return True, ""
