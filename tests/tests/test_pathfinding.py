from .scenario import Scenario
from .services import API_URL
from .utils.simulation import _get_waypoints_dummy_infra, run_pathfinding


def test_pathfinding_small_infra(small_scenario: Scenario):
    run_pathfinding(
        API_URL, small_scenario.infra, [{"track_section": "TE1", "offset": 0}, {"track_section": "TE0", "offset": 0}]
    )


def test_pathfinding_dummy_infra(dummy_scenario: Scenario):
    run_pathfinding(API_URL, dummy_scenario.infra, _get_waypoints_dummy_infra(API_URL, dummy_scenario.infra))
