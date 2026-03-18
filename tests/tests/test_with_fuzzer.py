import pytest

# TODO: we should clean up the package and imports structure
from fuzzer import fuzzer, fuzzer_stdcm_single_timetable
from requests import Session

from .scenario import Scenario
from .services import EDITOAST_URL


@pytest.mark.usefixtures("fast_rolling_stock")
@pytest.mark.parametrize("seed", range(5))
def test_with_fuzzer(tiny_scenario: Scenario, seed: int, session: Session):
    fuzzer.run(
        EDITOAST_URL,
        tiny_scenario,
        session,
        "fast_rolling_stock",
        n_test=1,
        seed=seed + 1,
    )


@pytest.mark.usefixtures("fast_rolling_stock")
@pytest.mark.parametrize("seed", range(5))
def test_with_stdcm_fuzzer(tiny_scenario: Scenario, seed: int, session: Session):
    """
    Just a smoke test to make sure the fuzzer is updated on breaking API changes.
    It won't catch everything though, some invalid inputs are returned as
    "preprocessing pathfinding errors", which are ignored (the generated paths aren't always valid).
    """
    fuzzer_stdcm_single_timetable.run(
        editoast_url=EDITOAST_URL,
        towed_rs=None,
        scenario=tiny_scenario,
        session=session,
        n_test=1,
        seed=seed + 1,
    )
