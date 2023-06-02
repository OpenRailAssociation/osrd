import subprocess
from pathlib import Path

import pytest


@pytest.mark.e2e
@pytest.mark.names_and_metadata(
    {
        "_@Test BB 7200GVLOCOMOTIVES": {
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
        "_@Test Locomotives électriques": {
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
        "_@Test BB 22200": {
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
    },
)
@pytest.mark.usefixtures("small_scenario", "fast_rolling_stocks")
def test_e2e():
    result = subprocess.run(
        ["yarn", "--cwd", "front", "playwright", "test", "--reporter=line"],
        cwd=Path(__file__).parents[2],
        check=False,
    )
    assert result.returncode == 0
