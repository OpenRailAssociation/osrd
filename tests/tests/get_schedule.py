import requests


def get_schedule(base_url, infra):
    r = requests.get(base_url + "timetable/")
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Rolling stock error {r.status_code}: {r.content}")
    schedules = r.json()["results"]
    schedule = next(filter(lambda s: s["infra"] == infra, schedules))
    return schedule["id"]


def run(*args, **kwargs):
    base_url = kwargs["url"]
    infra_id = kwargs["infra_id"]
    get_schedule(base_url, infra_id)
    return True, ""
