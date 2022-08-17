import requests


def get_timetable(base_url, infra):
    r = requests.get(base_url + "timetable/")
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Timetable error {r.status_code}: {r.content}")
    schedules = r.json()["results"]
    schedule = next(filter(lambda s: s["infra"] == infra, schedules))
    return schedule["id"]


def run(*args, **kwargs):
    base_url = kwargs["url"]
    infra_id = kwargs["all_infras"]["dummy"]
    get_timetable(base_url, infra_id)
    return True, ""
