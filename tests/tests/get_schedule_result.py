import requests

from tests.run_simulation import run_simulation


def get_schedule_result(base_url, infra_id):
    schedule_id = run_simulation(base_url, infra_id)
    r = requests.get(f"{base_url}train_schedule/{schedule_id}/result/")
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Schedule error {r.status_code}: {r.content}, id={schedule_id}")


def run(*args, **kwargs):
    base_url = kwargs["url"]
    infra_id = kwargs["infra_id"]
    get_schedule_result(base_url, infra_id)
    return True, ""
