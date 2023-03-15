from .infra import Infra
from .services import API_URL
from .utils.simulation import _get_waypoints_dummy_infra, run_pathfinding


def test_pathfinding_small_infra(small_infra: Infra):
    run_pathfinding(
        API_URL, small_infra.id, [{"track_section": "TE1", "offset": 0}, {"track_section": "TE0", "offset": 0}]
    )


def test_pathfinding_dummy_infra(dummy_infra: Infra):
    run_pathfinding(API_URL, dummy_infra.id, _get_waypoints_dummy_infra(API_URL, dummy_infra.id))
