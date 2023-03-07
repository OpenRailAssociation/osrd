import requests
from tests.run_simulation import run_simulation, update_simulation_with_mareco_allowances



def get_and_update_schedule_result(base_url, scenario):
    schedule_id = run_simulation(base_url, scenario)
    response = requests.get(f"{base_url}train_schedule/{schedule_id}/result/")
    if response.status_code // 100 != 2:
        raise RuntimeError(
            f"Schedule error {response.status_code}: {response.content}, id={schedule_id}"
        )
    simulation_report = response.json()
    assert "base" in simulation_report
    assert "eco" not in simulation_report

    response = update_simulation_with_mareco_allowances(base_url, schedule_id)
    response = requests.get(f"{base_url}train_schedule/{schedule_id}/result/")
    if response.status_code // 100 != 2:
        raise RuntimeError(
            f"Schedule error {response.status_code}: {response.content}, id={schedule_id}"
        )
    simulation_report = response.json()
    assert "base" in simulation_report
    assert "eco" in simulation_report


def run(*args, **kwargs):
    base_url = kwargs["url"]
    scenario = kwargs["all_scenarios"]["dummy"]
    get_and_update_schedule_result(base_url, scenario)
    return True, ""
