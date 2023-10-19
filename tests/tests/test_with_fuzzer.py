import pytest

# TODO: we should clean up the package and imports structure
from fuzzer import fuzzer

from .scenario import Scenario
from .services import EDITOAST_URL


@pytest.mark.usefixtures("fast_rolling_stock")
@pytest.mark.parametrize("seed", range(5))
def test_with_fuzzer(tiny_scenario: Scenario, seed: int):
    fuzzer.run(EDITOAST_URL, tiny_scenario, n_test=1, seed=seed + 1)
