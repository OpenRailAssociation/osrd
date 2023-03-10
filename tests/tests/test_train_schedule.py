import requests

from .scenario import Scenario
from .services import API_URL
from .utils.simulation import run_simulation, update_simulation_with_mareco_allowances


def test_get_and_update_schedule_result(dummy_scenario: Scenario):
    schedule_id = run_simulation(API_URL, dummy_scenario)
    response = requests.get(f"{API_URL}train_schedule/{schedule_id}/result/")
    if response.status_code // 100 != 2:
        raise RuntimeError(f"Schedule error {response.status_code}: {response.content}, id={schedule_id}")
    simulation_report = response.json()
    assert "base" in simulation_report
    assert "eco" not in simulation_report

    response = update_simulation_with_mareco_allowances(API_URL, schedule_id)
    response = requests.get(f"{API_URL}train_schedule/{schedule_id}/result/")
    if response.status_code // 100 != 2:
        raise RuntimeError(f"Schedule error {response.status_code}: {response.content}, id={schedule_id}")
    simulation_report = response.json()
    assert "base" in simulation_report
    assert "eco" in simulation_report
