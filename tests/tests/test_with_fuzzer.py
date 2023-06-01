import sys
from pathlib import Path

import pytest

from .scenario import Scenario
from .services import API_URL, EDITOAST_URL

sys.path.append(str(Path(__file__).parents[1] / "fuzzer"))

import fuzzer  # noqa


@pytest.mark.usefixtures("fast_rolling_stock")
@pytest.mark.parametrize("seed", range(5))
def test_with_fuzzer(tiny_scenario: Scenario, seed: int):
    fuzzer.run(API_URL, EDITOAST_URL, tiny_scenario, 1, seed=seed + 1)
