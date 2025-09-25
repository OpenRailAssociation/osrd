from collections.abc import Sequence
from typing import Any

import pytest

from .path import Path

_EXPECTED_WEST_TO_SOUTH_EAST_PATH = Path(
    **{
        "status": "success",
        "path": {
            "blocks": [
                {
                    "begin": 837034,
                    "end": 1770000,
                    "id": "block.257fce538543c5f960490c7606bbc603",
                },
                {
                    "begin": 0,
                    "end": 3630000,
                    "id": "block.1dbf71a8896e98cd71157a44bb918a9e",
                },
                {
                    "begin": 0,
                    "end": 4800000,
                    "id": "block.97661cd54d96453abdc191d1be184af5",
                },
                {
                    "begin": 0,
                    "end": 1620000,
                    "id": "block.52b46c47a8253001dad72b6907da3a07",
                },
                {
                    "begin": 0,
                    "end": 1000000,
                    "id": "block.26351683b3a305dab1fb15183e256f82",
                },
                {
                    "begin": 0,
                    "end": 3455000,
                    "id": "block.9fd6806a7f1c25dbc9809036f8799c50",
                },
                {
                    "begin": 0,
                    "end": 4612500,
                    "id": "block.6eac7803d789741b4aab9b9d347ab7b0",
                },
                {
                    "begin": 0,
                    "end": 4612500,
                    "id": "block.077f958857f85779fd13430750bfdd80",
                },
                {
                    "begin": 0,
                    "end": 4612500,
                    "id": "block.99f89fff7dabab637ca7e7fb823faa8c",
                },
                {
                    "begin": 0,
                    "end": 4612500,
                    "id": "block.7a8dbf58fefc7795eb972d52f931ee3f",
                },
                {
                    "begin": 0,
                    "end": 3095000,
                    "id": "block.ddd4e5a371d90d2522e86eb3ced76206",
                },
                {
                    "begin": 0,
                    "end": 3000000,
                    "id": "block.1345e674f8d1c39dae0cd05951af5d8d",
                },
                {
                    "begin": 0,
                    "end": 1000000,
                    "id": "block.a69d6a804dfee71d0cc91314b915e0c7",
                },
                {
                    "begin": 0,
                    "end": 1980000,
                    "id": "block.f2b0ac13a7f1d9149ee6df4004cbaac3",
                },
                {
                    "begin": 0,
                    "end": 1600000,
                    "id": "block.374246fd74fffa8a5dc3e2dc11b78b84",
                },
                {
                    "begin": 0,
                    "end": 986000,
                    "id": "block.1fd1a71ba69b41b8849eff642ebfcf61",
                },
            ],
            "routes": [
                {"begin": 837034, "end": 1770000, "id": "rt.buffer_stop.2->DA1"},
                {"begin": 0, "end": 10050000, "id": "rt.DA1->DA6"},
                {"begin": 0, "end": 1000000, "id": "rt.DA6->DC6"},
                {"begin": 0, "end": 25000000, "id": "rt.DC6->DD3"},
                {"begin": 0, "end": 3000000, "id": "rt.DD3->DH0"},
                {"begin": 0, "end": 1000000, "id": "rt.DH0->DH2"},
                {"begin": 0, "end": 4566000, "id": "rt.DH2->buffer_stop.7"},
            ],
            "track_section_ranges": [
                {
                    "track_section": "TA2",
                    "begin": 837034,
                    "end": 1950000,
                    "direction": "START_TO_STOP",
                },
                {
                    "track_section": "TA5",
                    "begin": 0,
                    "end": 50000,
                    "direction": "START_TO_STOP",
                },
                {
                    "track_section": "TA7",
                    "begin": 0,
                    "end": 10000000,
                    "direction": "START_TO_STOP",
                },
                {
                    "track_section": "TC2",
                    "begin": 0,
                    "end": 1000000,
                    "direction": "START_TO_STOP",
                },
                {
                    "track_section": "TD1",
                    "begin": 0,
                    "end": 25000000,
                    "direction": "START_TO_STOP",
                },
                {
                    "track_section": "TD3",
                    "begin": 0,
                    "end": 3000000,
                    "direction": "START_TO_STOP",
                },
                {
                    "track_section": "TH0",
                    "begin": 0,
                    "end": 1000000,
                    "direction": "START_TO_STOP",
                },
                {
                    "track_section": "TH1",
                    "begin": 0,
                    "end": 4386000,
                    "direction": "START_TO_STOP",
                },
            ],
        },
        "length": 45548966,
        "path_item_positions": [0, 45548966],
    }
)


def assert_track_ranges_are_equals(
    track_ranges: Sequence[Any], expected_track_ranges: Sequence[Any]
):
    assert len(track_ranges) == len(expected_track_ranges)

    for i in range(len(track_ranges)):
        assert (
            track_ranges[i]["track_section"]
            == expected_track_ranges[i]["track_section"]
        )
        assert track_ranges[i]["begin"] == expected_track_ranges[i]["begin"]
        assert track_ranges[i]["end"] == expected_track_ranges[i]["end"]
        assert track_ranges[i]["direction"] == expected_track_ranges[i]["direction"]


def test_west_to_south_east_path(west_to_south_east_path: Path):
    assert west_to_south_east_path.status == _EXPECTED_WEST_TO_SOUTH_EAST_PATH.status
    assert west_to_south_east_path.length == pytest.approx(
        _EXPECTED_WEST_TO_SOUTH_EAST_PATH.length, rel=1e-3
    )
    assert west_to_south_east_path.path == _EXPECTED_WEST_TO_SOUTH_EAST_PATH.path
    assert (
        west_to_south_east_path.path_item_positions
        == _EXPECTED_WEST_TO_SOUTH_EAST_PATH.path_item_positions
    )
