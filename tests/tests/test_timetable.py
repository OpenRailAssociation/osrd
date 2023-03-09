import requests

from .services import API_URL


def test_get_timetable(dummy_scenario):
    r = requests.get(
        API_URL
        + f"projects/{dummy_scenario.project}/studies/{dummy_scenario.op_study}/scenarios/{dummy_scenario.scenario}/"
    )
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Timetable error {r.status_code}: {r.content}")
