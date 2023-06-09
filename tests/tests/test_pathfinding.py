from itertools import chain
from typing import Any, Iterable

import pytest

from .path import Path

_EXPECTED_WEST_TO_SOUTH_EAST_PATH = Path(
    **{
        "id": -1,  # not checked
        "owner": "00000000-0000-0000-0000-000000000000",
        "created": "",  # not checked
        "slopes": [
            {"position": 0, "gradient": 0},
            {"position": 5162.966050992638, "gradient": 0},
            {"position": 5162.966050992638, "gradient": -3.0},
            {"position": 5462.966050992638, "gradient": -3.0},
            {"position": 5462.966050992638, "gradient": -6.0},
            {"position": 5862.966050992638, "gradient": -6.0},
            {"position": 5862.966050992638, "gradient": -3.0},
            {"position": 6162.966050992638, "gradient": -3.0},
            {"position": 6162.966050992638, "gradient": 0},
            {"position": 8162.966050992638, "gradient": 0},
            {"position": 8162.966050992638, "gradient": 3.0},
            {"position": 8462.966050992638, "gradient": 3.0},
            {"position": 8462.966050992638, "gradient": 6.0},
            {"position": 8862.966050992638, "gradient": 6.0},
            {"position": 8862.966050992638, "gradient": 3.0},
            {"position": 9162.966050992638, "gradient": 3.0},
            {"position": 9162.966050992638, "gradient": 0},
            {"position": 18162.96605099264, "gradient": 0},
            {"position": 18162.96605099264, "gradient": 3.0},
            {"position": 19162.96605099264, "gradient": 3.0},
            {"position": 19162.96605099264, "gradient": 6.0},
            {"position": 20162.96605099264, "gradient": 6.0},
            {"position": 20162.96605099264, "gradient": 3.0},
            {"position": 21162.96605099264, "gradient": 3.0},
            {"position": 21162.96605099264, "gradient": 0},
            {"position": 26162.96605099264, "gradient": 0},
            {"position": 26162.96605099264, "gradient": -3.0},
            {"position": 27162.96605099264, "gradient": -3.0},
            {"position": 27162.96605099264, "gradient": -6.0},
            {"position": 28162.96605099264, "gradient": -6.0},
            {"position": 28162.96605099264, "gradient": -3.0},
            {"position": 29162.96605099264, "gradient": -3.0},
            {"position": 29162.96605099264, "gradient": 0},
            {"position": 45549.5653000392, "gradient": 0},
        ],
        "curves": [{"position": 0, "radius": 0}, {"position": 45549.5653000392, "radius": 0}],
        "geographic": {
            "type": "LineString",
            "coordinates": [
                [-0.387122554630656, 49.4998],
                [-0.37, 49.4998],
                [-0.365, 49.4999],
                [-0.31, 49.4999],
                [-0.296, 49.4999],
                [-0.172, 49.4999],
                [-0.1354, 49.4999],
                [-0.135, 49.49995],
                [-0.1346, 49.4999],
                [-0.12, 49.4999],
                [-0.115, 49.497],
                [-0.115, 49.487],
                [-0.11, 49.484],
                [-0.095104854807785, 49.484],
            ],
        },
        "schematic": {
            "type": "LineString",
            "coordinates": [
                [-0.387122554630656, 49.4998],
                [-0.37, 49.4998],
                [-0.365, 49.4999],
                [-0.31, 49.4999],
                [-0.296, 49.4999],
                [-0.172, 49.4999],
                [-0.1354, 49.4999],
                [-0.135, 49.49995],
                [-0.1346, 49.4999],
                [-0.12, 49.4999],
                [-0.115, 49.497],
                [-0.115, 49.487],
                [-0.11, 49.484],
                [-0.095104854807785, 49.484],
            ],
        },
        "steps": [
            {
                "track": "TA2",
                "position": 837.033949007362,
                "geo": {"type": "Point", "coordinates": [-0.387122554630656, 49.4998]},
                "sch": {"type": "Point", "coordinates": [-0.387122554630656, 49.4998]},
                "id": None,
                "name": None,
                "suggestion": False,
                "duration": 0.0,
            },
            {
                "track": "TC2",
                "position": 450.0,
                "geo": {"type": "Point", "coordinates": [-0.3037, 49.4999]},
                "sch": {"type": "Point", "coordinates": [-0.3037, 49.4999]},
                "id": "Mid_West_station",
                "name": "Mid_West_station",
                "suggestion": True,
                "duration": 0.0,
            },
            {
                "track": "TD1",
                "position": 14000.0,
                "geo": {"type": "Point", "coordinates": [-0.22656, 49.4999]},
                "sch": {"type": "Point", "coordinates": [-0.22656, 49.4999]},
                "id": "Mid_East_station",
                "name": "Mid_East_station",
                "suggestion": True,
                "duration": 0.0,
            },
            {
                "track": "TH1",
                "position": 4386.599249046556,
                "geo": {"type": "Point", "coordinates": [-0.095104854807785, 49.484]},
                "sch": {"type": "Point", "coordinates": [-0.095104854807785, 49.484]},
                "id": None,
                "name": None,
                "suggestion": False,
                "duration": 1.0,
            },
        ],
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


def assert_steps_are_equals(steps: Iterable[Any], expected_steps: Iterable[Any]):
    assert len(steps) == len(expected_steps)

    for i in range(len(steps)):
        assert_points_are_equals(steps[i].pop("sch"), expected_steps[i].pop("sch"))
        assert_points_are_equals(steps[i].pop("geo"), expected_steps[i].pop("geo"))
        assert steps[i] == expected_steps[i]


def test_west_to_south_east_path(west_to_south_east_path: Path):
    assert west_to_south_east_path.owner == _EXPECTED_WEST_TO_SOUTH_EAST_PATH.owner
    assert west_to_south_east_path.slopes == pytest.approx(_EXPECTED_WEST_TO_SOUTH_EAST_PATH.slopes)
    assert west_to_south_east_path.curves == pytest.approx(_EXPECTED_WEST_TO_SOUTH_EAST_PATH.curves)
    assert_steps_are_equals(west_to_south_east_path.steps, _EXPECTED_WEST_TO_SOUTH_EAST_PATH.steps)

    assert_line_strings_are_equals(west_to_south_east_path.geographic, _EXPECTED_WEST_TO_SOUTH_EAST_PATH.geographic)
    assert_line_strings_are_equals(west_to_south_east_path.schematic, _EXPECTED_WEST_TO_SOUTH_EAST_PATH.schematic)
