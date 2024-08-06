from collections.abc import Sequence
from itertools import chain
from typing import Any

import pytest

from .path import Path
from .utils.approximations import recursive_approx

_EXPECTED_WEST_TO_SOUTH_EAST_PATH = Path(
    **{
        "id": -1,  # not checked
        "owner": "00000000-0000-0000-0000-000000000000",
        "created": "",  # not checked
        "length": 45549.5653000392,
        "slopes": [
            {"gradient": 0.0, "position": 0.0},
            {"gradient": 0.0, "position": 5162.966050992638},
            {"gradient": -3.0, "position": 5162.966050992638},
            {"gradient": -3.0, "position": 5462.966050992638},
            {"gradient": -6.0, "position": 5462.966050992638},
            {"gradient": -6.0, "position": 5862.966050992638},
            {"gradient": -3.0, "position": 5862.966050992638},
            {"gradient": -3.0, "position": 6162.966050992638},
            {"gradient": 0.0, "position": 6162.966050992638},
            {"gradient": 0.0, "position": 8162.966050992638},
            {"gradient": 3.0, "position": 8162.966050992638},
            {"gradient": 3.0, "position": 8462.966050992638},
            {"gradient": 6.0, "position": 8462.966050992638},
            {"gradient": 6.0, "position": 8862.966050992638},
            {"gradient": 3.0, "position": 8862.966050992638},
            {"gradient": 3.0, "position": 9162.966050992638},
            {"gradient": 0.0, "position": 9162.966050992638},
            {"gradient": 0.0, "position": 18162.96605099264},
            {"gradient": 3.0, "position": 18162.96605099264},
            {"gradient": 3.0, "position": 19162.96605099264},
            {"gradient": 6.0, "position": 19162.96605099264},
            {"gradient": 6.0, "position": 20162.96605099264},
            {"gradient": 3.0, "position": 20162.96605099264},
            {"gradient": 3.0, "position": 21162.96605099264},
            {"gradient": 0.0, "position": 21162.96605099264},
            {"gradient": 0.0, "position": 26162.96605099264},
            {"gradient": -3.0, "position": 26162.96605099264},
            {"gradient": -3.0, "position": 27162.96605099264},
            {"gradient": -6.0, "position": 27162.96605099264},
            {"gradient": -6.0, "position": 28162.96605099264},
            {"gradient": -3.0, "position": 28162.96605099264},
            {"gradient": -3.0, "position": 29162.96605099264},
            {"gradient": 0.0, "position": 29162.96605099264},
            {"gradient": 0.0, "position": 45549.5653000392},
        ],
        "curves": [{"radius": 0.0, "position": 0.0}, {"radius": 0.0, "position": 45549.5653000392}],
        "steps": [
            {
                "id": None,
                "name": None,
                "location": {"track_section": "TA2", "offset": 837.033949007362},
                "duration": 0.0,
                "path_offset": 0.0,
                "suggestion": False,
                "geo": {"coordinates": [-0.387122554630656, 49.49979999999999], "type": "Point"},
                "ch": None,
                "uic": None,
            },
            {
                "id": "Mid_West_station",
                "name": "Mid_West_station",
                "location": {"track_section": "TC2", "offset": 450.0},
                "duration": 0.0,
                "path_offset": 11612.966050992638,
                "suggestion": True,
                "geo": {"coordinates": [-0.30369999999999997, 49.4999], "type": "Point"},
                "ch": "BV",
                "uic": 3,
            },
            {
                "id": "Mid_East_station",
                "name": "Mid_East_station",
                "location": {"track_section": "TD1", "offset": 14000.0},
                "duration": 0.0,
                "path_offset": 26162.96605099264,
                "suggestion": True,
                "geo": {"coordinates": [-0.22656, 49.4999], "type": "Point"},
                "ch": "BV",
                "uic": 4,
            },
            {
                "id": None,
                "name": None,
                "location": {"track_section": "TH1", "offset": 4386.599249046556},
                "duration": 1.0,
                "path_offset": 45549.5653000392,
                "suggestion": False,
                "geo": {"coordinates": [-0.095104854807785, 49.484], "type": "Point"},
                "ch": None,
                "uic": None,
            },
        ],
        "geographic": {
            "coordinates": [
                [-0.38712255384615385, 49.49979999999999],
                [-0.37276923076923074, 49.49979999999999],
                [-0.37, 49.49979999999999],
                [-0.3675, 49.499849999999995],
                [-0.365, 49.4999],
                [-0.36401, 49.4999],
                [-0.35509999999999997, 49.4999],
                [-0.3463, 49.4999],
                [-0.3375, 49.4999],
                [-0.3287, 49.4999],
                [-0.3199, 49.4999],
                [-0.31099, 49.4999],
                [-0.31, 49.4999],
                [-0.30748, 49.4999],
                [-0.29852, 49.4999],
                [-0.296, 49.4999],
                [-0.29510719999999996, 49.4999],
                [-0.28738199999999997, 49.4999],
                [-0.279756, 49.4999],
                [-0.27213, 49.4999],
                [-0.26450399999999996, 49.4999],
                [-0.256878, 49.4999],
                [-0.24925199999999997, 49.4999],
                [-0.241626, 49.4999],
                [-0.234, 49.4999],
                [-0.226374, 49.4999],
                [-0.218748, 49.4999],
                [-0.211122, 49.4999],
                [-0.203496, 49.4999],
                [-0.19587, 49.4999],
                [-0.18824399999999997, 49.4999],
                [-0.180618, 49.4999],
                [-0.1728928, 49.4999],
                [-0.172, 49.4999],
                [-0.16977955951468118, 49.4999],
                [-0.13721309906333873, 49.4999],
                [-0.1354, 49.4999],
                [-0.135, 49.49995],
                [-0.1346, 49.4999],
                [-0.13230601996602367, 49.4999],
                [-0.1227013214559564, 49.4999],
                [-0.12, 49.4999],
                [-0.11868657293430417, 49.499138212301894],
                [-0.115, 49.497],
                [-0.115, 49.48991706549413],
                [-0.115, 49.487],
                [-0.11, 49.484],
                [-0.10564810213659384, 49.484],
                [-0.09599910093668047, 49.484],
            ],
            "type": "LineString",
        },
    }
)


def assert_line_strings_are_equals(geometry, expected_geometry):
    assert geometry["type"] == expected_geometry["type"]
    assert list(chain.from_iterable(geometry["coordinates"])) == pytest.approx(
        list(chain.from_iterable(expected_geometry["coordinates"]))
    )


def assert_points_are_equals(geometry, expected_geometry):
    assert geometry["type"] == expected_geometry["type"]
    assert geometry["coordinates"] == pytest.approx(expected_geometry["coordinates"])


def assert_steps_are_equals(steps: Sequence[Any], expected_steps: Sequence[Any]):
    assert len(steps) == len(expected_steps)

    for i in range(len(steps)):
        assert_points_are_equals(steps[i].pop("geo"), expected_steps[i].pop("geo"))
        recursive_approx(expected_steps[i], steps[i])


def test_west_to_south_east_path(west_to_south_east_path: Path):
    assert west_to_south_east_path.owner == _EXPECTED_WEST_TO_SOUTH_EAST_PATH.owner
    assert west_to_south_east_path.length == pytest.approx(_EXPECTED_WEST_TO_SOUTH_EAST_PATH.length, rel=1e-3)
    recursive_approx(_EXPECTED_WEST_TO_SOUTH_EAST_PATH.slopes, west_to_south_east_path.slopes)
    recursive_approx(_EXPECTED_WEST_TO_SOUTH_EAST_PATH.curves, west_to_south_east_path.curves)
    assert_steps_are_equals(west_to_south_east_path.steps, _EXPECTED_WEST_TO_SOUTH_EAST_PATH.steps)

    assert_line_strings_are_equals(west_to_south_east_path.geographic, _EXPECTED_WEST_TO_SOUTH_EAST_PATH.geographic)
