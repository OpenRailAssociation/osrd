from enum import Enum
from typing import List, Literal, Mapping, Optional

from pydantic import (
    BaseModel,
    Extra,
    Field,
    PositiveFloat,
    confloat,
    conlist,
    constr,
    root_validator,
)

from .infra import LoadingGaugeType

RAILJSON_ROLLING_STOCK_VERSION = "3.0"

class EnergySource(BaseModel, extra=Extra.forbid):
    """EMR QUALESI"""

    p_min: confloat(le=0) = Field(description="Minimum negative power")
    pMax: confloat(ge=0) = Field(description="Maximum positive power")
    OptionalEnergyStorage: Optional[EnergyStorage]
    OptionalPowerConverter: Optional[PowerConverter]

class EnergyStorage(BaseModel, extra=Extra.forbid):
    """If the EnergySource store some energy - EMR QUALESI"""

    capacity: confloat(ge=0) = Field(description="How much energy you can store (in Joules or Watts·Seconds)")
    soc: confloat(ge=0, le=1) = Field(description="The State of Charge of your EnergyStorage, SoC·capacity = actual stock of energy")
    OptionalRefillLaw: Optional[RefillLaw]
    OptionalManagementSystem: Optional[ManagementSystem]

class RefillLaw(BaseModel, extra=Extra.forbid):
    """The EnergyStorage refilling behavior - EMR QUALESI"""

    tauRech: confloat(ge=0) = Field(description="Time constant of the refill behavior https://en.wikipedia.org/wiki/Time_constant")
    socRef: confloat(ge=0, le=1) = Field(description="Setpoint of State of charge https://en.wikipedia.org/wiki/Setpoint_(control_system)")

class ManagementSystem(BaseModel, extra=Extra.forbid):
    """Other - EMR QUALESI"""

   overChargeTreshold: confloat(ge=0, le=1) = Field(description="overcharge limit")
   underChargeTreshold: confloat(ge=0, le=1) = Field(description="undercharge limit")

class PowerConverter(BaseModel, extra=Extra.forbid):
    """The EnergyStorage refilling behavior - EMR QUALESI"""
    efficiency: confloat(ge=0, le=1)

class ComfortType(str, Enum):
    """
    This enum defines the comfort type that can take a train.
    """

    STANDARD = "STANDARD"
    AC = "AC"
    HEATING = "HEATING"


class RollingResistance(BaseModel, extra=Extra.forbid):
    type: Literal["davis"]
    A: confloat(ge=0)
    B: confloat(ge=0)
    C: confloat(ge=0)


class EffortCurve(BaseModel, extra=Extra.forbid):
    speeds: conlist(confloat(ge=0), min_items=2)
    max_efforts: conlist(confloat(ge=0), min_items=2)

    @root_validator(skip_on_failure=True)
    def check_size(cls, v):
        assert len(v["speeds"]) == len(v["max_efforts"]), "speeds and max_efforts must be the same length"
        return v


class EffortCurveConditions(BaseModel, extra=Extra.forbid):
    comfort: Optional[ComfortType]
    electrical_profile_level: Optional[str]


class ConditionalEffortCurve(BaseModel, extra=Extra.forbid):
    """Effort curve subject to application conditions"""

    cond: EffortCurveConditions = Field(default=EffortCurveConditions())
    curve: EffortCurve = Field(description="Effort curve to apply if the conditions are met")


class ModeEffortCurves(BaseModel, extra=Extra.forbid):
    """Effort curves for a given mode"""

    curves: List[ConditionalEffortCurve] = Field(
        description="List of conditional effort curves, sorted by match priority"
    )
    default_curve: EffortCurve = Field(description="Curve used if no condition is met")
    is_electric: bool = Field(description="Whether the mode is electric or not")


class EffortCurves(BaseModel, extra=Extra.forbid):
    """
    Effort curves for a given rolling stock.
    This schema handle multiple modes and conditions such as comfort, power restrictions, etc.
    """

    modes: Mapping[str, ModeEffortCurves] = Field(description="Map profiles such as '25kV' to comfort effort curves")
    default_mode: str = Field(description="The default profile to use")

    @root_validator(skip_on_failure=True)
    def check_default_profile(cls, v):
        assert (
            v["default_mode"] in v["modes"]
        ), f"Invalid default mode '{v['default_mode']}' expected one of [{', '.join(v['modes'].keys())}]"
        return v


class GammaType(str, Enum):
    CONST = "CONST"
    MAX = "MAX"


class Gamma(BaseModel, extra=Extra.forbid):
    type: GammaType
    value: PositiveFloat


class RollingStockLivery(BaseModel):
    name: constr(max_length=255)


class RollingStock(BaseModel, extra=Extra.forbid):
    version: Literal[RAILJSON_ROLLING_STOCK_VERSION] = Field(default=RAILJSON_ROLLING_STOCK_VERSION)
    name: constr(max_length=255)
    effort_curves: EffortCurves = Field(description="Curves mapping speed (in m/s) to maximum traction (in newtons)")
    power_class: Optional[str] = Field(
        description="The power usage class of the train (optional because it is specific to SNCF)"
    )
    length: PositiveFloat = Field(description="The length of the train, in m")
    max_speed: PositiveFloat = Field(description="Maximum speed in m/s")
    startup_time: confloat(ge=0) = Field(description="The time the train takes before it can start accelerating in s")
    startup_acceleration: confloat(ge=0) = Field(description="The maximum acceleration during startup in m/s^2")
    comfort_acceleration: PositiveFloat = Field(description="The maximum operational acceleration in m/s^2")
    gamma: Gamma = Field(description="The max or const braking coefficient in m/s^2")
    inertia_coefficient: float = Field(gt=0)
    features: List[constr(max_length=255)] = Field(description="A list of features the train exhibits")
    mass: PositiveFloat = Field(description="The mass of the train, in kg")
    rolling_resistance: RollingResistance = Field(description="The formula to use to compute rolling resistance")
    loading_gauge: LoadingGaugeType
    metadata: Mapping[str, str] = Field(description="Properties used in the frontend to display the rolling stock")

    battery : Optional[EnergySource]
    catenary : Optional[EnergySource]
    traction_ensemble : Optional[PowerConverter]

if __name__ == "__main__":
    print(RollingStock.schema_json())
