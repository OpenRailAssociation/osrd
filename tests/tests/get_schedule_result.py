import requests

from tests.run_simulation import run_simulation


def get_schedule_result(base_url, scenario):
    schedule_id = run_simulation(base_url, scenario)
    r = requests.get(f"{base_url}train_schedule/{schedule_id}/result/")
    if r.status_code // 100 != 2:
        raise RuntimeError(
            f"Schedule error {r.status_code}: {r.content}, id={schedule_id}"
        )


def run(*args, **kwargs):
    base_url = kwargs["url"]
    scenario = kwargs["all_scenarios"]["dummy"]
    get_schedule_result(base_url, scenario)
    return True, ""
