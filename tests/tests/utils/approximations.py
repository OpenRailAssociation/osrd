from typing import Any

import pytest


def recursive_approx(expected: Any, actual: Any, rel=1e-3):
    """
    Calls `pytest.approx` recursively on elements of list and keys of dicts.
    Dict keys are not approximated, it's assumed that keys are strings.
    """
    if isinstance(expected, list):
        for a, b in zip(expected, actual):
            recursive_approx(a, b)
        return
    if isinstance(expected, dict):
        assert expected.keys() == actual.keys()
        for key in expected:
            recursive_approx(expected[key], actual[key])
        return
    assert actual == pytest.approx(expected, rel=rel), f"{expected=}, {actual=}"
