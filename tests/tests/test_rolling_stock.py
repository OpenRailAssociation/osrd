from dataclasses import dataclass
from typing import Any, Iterable, Mapping, Optional

import pytest
import requests

from .services import API_URL


@dataclass(frozen=True)
class _RollingStock:
    id: int
    liveries: Iterable[Any]
    version: str
    name: str
    effort_curves: Mapping[str, Any]
    base_power_class: str
    power_restrictions: Optional[Any]
    length: float
    max_speed: float
    startup_time: float
    startup_acceleration: float
    comfort_acceleration: float
    gamma: Mapping[str, Any]
    inertia_coefficient: float
    features: Iterable[str]
    mass: float
    rolling_resistance: Mapping[str, Any]
    loading_gauge: str
    metadata: Mapping[str, Any]


_FAST_ROLLING_STOCK = _RollingStock(
    **{
        "id": 485,
        "liveries": [],
        "version": "3.1",
        "name": "fast_rolling_stock",
        "effort_curves": {
            "modes": {
                "thermal": {
                    "curves": [],
                    "is_electric": False,
                    "default_curve": {
                        "speeds": [
                            0.0,
                            5.0,
                            10.0,
                            15.0,
                            20.0,
                            22.0,
                            27.0,
                            32.0,
                            37.0,
                            42.0,
                            47.0,
                            52.0,
                            57.0,
                            62.0,
                            67.0,
                            72.0,
                            77.0,
                        ],
                        "max_efforts": [
                            441666.6666666667,
                            439473.6842105263,
                            435714.28571428574,
                            427777.77777777775,
                            400000.0,
                            350971.5388299929,
                            347206.93642395496,
                            346938.7385068534,
                            344395.0325320009,
                            334314.2138640166,
                            313589.8108101956,
                            283584.5657113532,
                            250604.14937613969,
                            222698.71360301683,
                            204685.35097358702,
                            195984.55717992093,
                            192916.7642524637,
                        ],
                    },
                }
            },
            "default_mode": "thermal",
        },
        "base_power_class": "1",
        "power_restrictions": None,
        "length": 400.0,
        "max_speed": 80.0,
        "startup_time": 10.0,
        "startup_acceleration": 0.05,
        "comfort_acceleration": 0.25,
        "gamma": {"type": "CONST", "value": 0.5},
        "inertia_coefficient": 1.05,
        "features": ["TVM300", "TVM430", "ETCS1", "ETCS2", "KVB"],
        "mass": 900000.0,
        "rolling_resistance": {"A": 5400.0, "B": 200.0, "C": 12.0, "type": "davis"},
        "loading_gauge": "G1",
        "metadata": {
            "unit": "",
            "detail": "",
            "family": "",
            "number": "1",
            "series": "",
            "grouping": "",
            "reference": "",
            "subseries": "",
            "rolling_stock_type": "",
        },
    }
)


@pytest.mark.usefixtures("fast_rolling_stock")
def test_get_rolling_stocks():
    response = requests.get(API_URL + "rolling_stock/?page_size=1000")
    assert response.status_code == 200
    rolling_stock = _RollingStock(
        **next(
            iter(
                [
                    rolling_stock
                    for rolling_stock in response.json()["results"]
                    if rolling_stock["name"] == "fast_rolling_stock"
                ]
            )
        )
    )
    assert rolling_stock == _FAST_ROLLING_STOCK
