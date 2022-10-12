from enum import Enum
from typing import List, Literal

from pydantic import (
    BaseModel,
    Extra,
    Field,
    PositiveFloat,
    confloat,
    conint,
    conlist,
    constr,
    root_validator,
)

from .infra import LoadingGaugeType

RAILJSON_ROLLING_STOCK_VERSION = "2.2"


class RollingResistance(BaseModel, extra=Extra.forbid):
    type: Literal["davis"]
    A: confloat(ge=0)
    B: confloat(ge=0)
    C: confloat(ge=0)


class EffortCurve(BaseModel, extra=Extra.forbid):
    speeds: conlist(confloat(ge=0), min_items=2)
    max_efforts: conlist(confloat(ge=0), min_items=2)

    @root_validator
    def check_size(cls, v):
        assert len(v.get("speeds")) == len(v.get("max_efforts")), "speeds and max_efforts must be the same length"
        return v


class GammaType(str, Enum):
    CONST = "CONST"
    MAX = "MAX"


class Gamma(BaseModel, extra=Extra.forbid):
    type: GammaType
    value: PositiveFloat


class RollingStock(BaseModel, extra=Extra.forbid):
    version: Literal[RAILJSON_ROLLING_STOCK_VERSION] = Field(default=RAILJSON_ROLLING_STOCK_VERSION)
    name: constr(max_length=255)
    effort_curve: EffortCurve = Field(description="A curve mapping speed (in m/s) to maximum traction (in newtons)")
    length: PositiveFloat = Field(description="The length of the train, in m")
    max_speed: PositiveFloat = Field(description="Maximum speed in m/s")
    startup_time: confloat(ge=0) = Field(description="The time the train takes before it can start accelerating in s")
    startup_acceleration: confloat(ge=0) = Field(description="The maximum acceleration during startup in m/s^2")
    comfort_acceleration: PositiveFloat = Field(description="The maximum operational acceleration in m/s^2")
    gamma: Gamma = Field(description="The max or const braking coefficient in m/s^2")
    inertia_coefficient: float = Field(gt=0)
    power_class: conint(ge=0)
    features: List[constr(max_length=255)] = Field(description="A list of features the train exhibits")
    mass: PositiveFloat = Field(description="The mass of the train, in kg")
    rolling_resistance: RollingResistance = Field(description="The formula to use to compute rolling resistance")
    loading_gauge: LoadingGaugeType
    electric_only: bool = Field(description="If true, the train can only use tracks with compatible catenaries")
    compatible_voltages: List[int] = Field(description="A list of compatible voltage (in V)")


if __name__ == "__main__":
    print(RollingStock.schema_json())
