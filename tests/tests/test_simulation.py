from .scenario import Scenario
from .services import API_URL
from .utils.simulation import run_simulation


def test_dummy_simulation(dummy_scenario: Scenario):
    run_simulation(API_URL, dummy_scenario)
