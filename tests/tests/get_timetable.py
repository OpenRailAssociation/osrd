import requests


def get_timetable(base_url, scenario):
    r = requests.get(
        base_url + f"projects/{scenario.project}/studies/{scenario.op_study}/scenarios/{scenario.scenario}/"
    )
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Timetable error {r.status_code}: {r.content}")


def run(*args, **kwargs):
    base_url = kwargs["url"]
    scneario = kwargs["all_scenarios"]["dummy"]
    get_timetable(base_url, scneario)
    return True, ""
