import sys
from pathlib import Path

import pytest

from .services import API_URL

sys.path.append(str(Path(__file__).parents[1] / "fuzzer"))

import fuzzer  # noqa


@pytest.mark.parametrize("seed", range(5))
def test_with_fuzzer(tiny_infra, seed):
    fuzzer.run(API_URL, tiny_infra, 1, seed=seed + 1)
