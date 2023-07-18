import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping

import pytest


@dataclass
class TestRollingStock:
    name: str
    metadata: Mapping
    base_path: Path


@pytest.mark.e2e
@pytest.mark.names_and_metadata(
    [
        TestRollingStock(
            "_@Test BB 7200GVLOCOMOTIVES",
            {
                "type": "Locomotives électriques",
                "unit": "US",
                "detail": "BB 7200",
                "family": "LOCOMOTIVES",
                "number": "1",
                "series": "BB 7200",
                "grouping": "Locomotives électriques courant continu",
                "reference": "7200",
                "subseries": "GV",
            },
            Path(__file__).parents[2] / "editoast" / "src" / "tests" / "example_rolling_stock_1.json",
        ),
        TestRollingStock(
            "_@Test Locomotives électriques",
            {
                "type": "Locomotives électriques",
                "unit": "US",
                "detail": "BB15000 US",
                "family": "LOCOMOTIVES",
                "number": "1",
                "series": "BB 15000",
                "grouping": "Locomotives électriques monophasé",
                "reference": "15000",
                "subseries": "BB 15000",
            },
            Path(__file__).parents[2] / "editoast" / "src" / "tests" / "example_rolling_stock_1.json",
        ),
        TestRollingStock(
            "_@Test BB 22200",
            {
                "type": "Locomotives électriques",
                "unit": "US",
                "detail": "BB 22200",
                "family": "LOCOMOTIVES",
                "number": "1",
                "series": "BB 22200",
                "grouping": "Locomotives électriques bi courant",
                "reference": "22200",
                "subseries": "V160",
            },
            Path(__file__).parents[2] / "front" / "tests" / "assets" / "example_rolling_stock_1500.json",
        ),
    ]
)
@pytest.mark.usefixtures("small_scenario", "fast_rolling_stocks")
def test_e2e():
    result = subprocess.run(
        ["yarn", "--cwd", "front", "playwright", "test", "--reporter=line"],
        cwd=Path(__file__).parents[2],
        check=False,
    )
    assert result.returncode == 0
