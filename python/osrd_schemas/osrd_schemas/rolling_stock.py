from enum import Enum
from typing import List, Literal, Mapping, Optional, Union, get_args

from pydantic import (
    BaseModel,
    Field,
    NonNegativeFloat,
    PositiveFloat,
    RootModel,
    model_validator,
)

from .infra import LoadingGaugeType

RAILJSON_ROLLING_STOCK_VERSION_TYPE = Literal["3.2"]
RAILJSON_ROLLING_STOCK_VERSION = get_args(RAILJSON_ROLLING_STOCK_VERSION_TYPE)[0]


class ComfortType(str, Enum):
    """
    This enum defines the comfort type that can take a train.
    """

    STANDARD = "STANDARD"
    AIR_CONDITIONING = "AIR_CONDITIONING"
    HEATING = "HEATING"


class RollingResistance(BaseModel, extra="forbid"):
    type: Literal["davis"]
    A: NonNegativeFloat
    B: NonNegativeFloat
    C: NonNegativeFloat


class EffortCurve(BaseModel, extra="forbid"):
    speeds: List[NonNegativeFloat] = Field(
        min_length=2, description="Curves mapping speed (in m/s) to maximum traction (in newtons)"
    )
    max_efforts: List[NonNegativeFloat] = Field(min_length=2)

    @model_validator(mode="after")
    def check_size(self):
        assert len(self.speeds) == len(self.max_efforts), "speeds and max_efforts must be the same length"
        return self


class EffortCurveConditions(BaseModel, extra="forbid"):
    comfort: Optional[ComfortType] = None
    electrical_profile_level: Optional[str] = None
    power_restriction_code: Optional[str] = None


class ConditionalEffortCurve(BaseModel, extra="forbid"):
    """Effort curve subject to application conditions"""

    cond: EffortCurveConditions = Field(default=EffortCurveConditions())
    curve: EffortCurve = Field(description="Effort curve to apply if the conditions are met")


class ModeEffortCurves(BaseModel, extra="forbid"):
    """Effort curves for a given mode"""

    curves: List[ConditionalEffortCurve] = Field(
        description="List of conditional effort curves, sorted by match priority"
    )
    default_curve: EffortCurve = Field(description="Curve used if no condition is met")
    is_electric: bool = Field(description="Whether the mode is electric or not")


class EffortCurves(BaseModel, extra="forbid"):
    """
    Effort curves for a given rolling stock.
    This schema handle multiple modes and conditions such as comfort, power restrictions, etc.
    """

    modes: Mapping[str, ModeEffortCurves] = Field(description="Map profiles such as '25kV' to comfort effort curves")
    default_mode: str = Field(description="The default profile to use")

    @model_validator(mode="after")
    def check_default_mode(self):
        assert (
            self.default_mode in self.modes
        ), f"Invalid default mode '{self.default_mode}' expected one of [{', '.join(self.modes.keys())}]"
        return self


class GammaType(str, Enum):
    CONST = "CONST"
    MAX = "MAX"


class Gamma(BaseModel, extra="forbid"):
    type: GammaType
    value: PositiveFloat


class RollingStockLivery(BaseModel):
    name: str = Field(max_length=255)


class PowerRestrictions(RootModel):
    root: Mapping[str, str]


class RefillLaw(BaseModel, extra="forbid"):
    """The EnergyStorage refilling behavior"""

    tau: float = Field(ge=0, description="Time constant of the refill behavior (in seconds)")
    soc_ref: float = Field(ge=0, le=1, description="Reference (target) value of state of charge")


class EnergyStorage(BaseModel, extra="forbid"):
    """If the EnergySource is capable of storing some energy"""

    capacity: float = Field(ge=0, description="How much energy the source can store (in Joules)")
    soc: float = Field(ge=0, le=1, description="The state of charge, SoC·capacity = actual stock of energy")
    soc_min: float = Field(ge=0, le=1, description="The minimum SoC, where the available energy is zero")
    soc_max: float = Field(ge=0, le=1, description="The maximum SoC, where the available energy is capacity")
    refill_law: Optional[RefillLaw] = None


class SpeedDependantPower(BaseModel, extra="forbid"):
    """
    A curve that account for speed-related power (output/availability) behavior of specific energy sources,
    - the pantograph power is lowered at low speed to avoid welding the pantograph to the electrification
    - the power outputted by Hydrogen fuel cells increases with speed
    """

    speeds: List[NonNegativeFloat] = Field(min_length=1, description="speed values")
    powers: List[NonNegativeFloat] = Field(min_length=1, description="power values")

    @model_validator(mode="after")
    def check_size(self):
        assert len(self.speeds) == len(self.powers), "speeds and powers must have the same length"
        return self


class Electrification(BaseModel, extra="forbid"):
    """Electrification used when simulating qualesi trains"""

    energy_source_type: Literal["Electrification"] = Field(default="Electrification")
    max_input_power: SpeedDependantPower
    max_output_power: SpeedDependantPower
    efficiency: float = Field(ge=0, le=1, description="Efficiency of electrification and pantograph transmission")


class PowerPack(BaseModel, extra="forbid"):
    """Power pack, either diesel or hydrogen, used when simulating qualesi trains"""

    energy_source_type: Literal["PowerPack"] = Field(default="PowerPack")
    max_input_power: SpeedDependantPower
    max_output_power: SpeedDependantPower
    energy_storage: EnergyStorage
    efficiency: float = Field(ge=0, le=1, description="Efficiency of the power pack")


class Battery(BaseModel, extra="forbid"):
    """Battery used when simulating qualesi trains"""

    energy_source_type: Literal["Battery"] = Field(default="Battery")
    max_input_power: SpeedDependantPower
    max_output_power: SpeedDependantPower
    energy_storage: EnergyStorage
    efficiency: float = Field(ge=0, le=1, description="Battery efficiency")


class EnergySource(RootModel):
    """Energy sources used when simulating qualesi trains"""

    root: Union[Electrification, PowerPack, Battery] = Field(discriminator="energy_source_type")


class EnergySourcesList(RootModel):
    """List of energy sources used when simulating qualesi trains"""

    root: List[EnergySource]


class RollingStock(BaseModel, extra="forbid"):
    """Electrical profiles and power classes are used to model the power loss along a electrification:
    * Rolling stocks are attributed a power class depending on their power usage.
    * Electrical profiles are then computed for each power class along all electrifications.
    The electrical profile's value along the electrification is akin to an "actual available power" value.
    * Then, speed-effort curves can be computed for all electrical profile values.

    To prevent power grid overloads, infrastructure managers can enforce power restrictions on some parts of their
    infrastructure for some trains. These train-specific restrictions are given a code.
    To respect the prescribed power restrictions, the driver has to change the power notch used in the train, which
    changes the power consumption of the train, akin to a car's gear.
    In our model, we consider that trains' power notches and the associated power restriction codes are equivalent.
    Thus power restrictions affect the effort curves, and change the power class of the rolling stock.
    """

    railjson_version: RAILJSON_ROLLING_STOCK_VERSION_TYPE = Field(default=RAILJSON_ROLLING_STOCK_VERSION)
    name: str = Field(max_length=255)
    locked: bool = Field(default=False, description="Whether the rolling stock can be edited/deleted or not")
    effort_curves: EffortCurves = Field(description="Curves mapping speed (in m/s) to maximum traction (in newtons)")
    base_power_class: Optional[str] = Field(
        description="The power usage class of the train (optional because it is specific to SNCF)", default=None
    )
    power_restrictions: Optional[PowerRestrictions] = Field(
        description="Mapping from train's power restriction codes to power classes", default=None
    )
    length: NonNegativeFloat = Field(description="The length of the train, in m")
    max_speed: NonNegativeFloat = Field(description="Maximum speed in m/s")
    startup_time: NonNegativeFloat = Field(description="The time the train takes before it can start accelerating in s")
    startup_acceleration: NonNegativeFloat = Field(description="The maximum acceleration during startup in m/s^2")
    comfort_acceleration: NonNegativeFloat = Field(description="The maximum operational acceleration in m/s^2")
    gamma: Gamma = Field(description="The max or const braking coefficient in m/s^2")
    inertia_coefficient: NonNegativeFloat = Field(description="The coefficient of inertia")
    mass: NonNegativeFloat = Field(description="The mass of the train, in kg")
    rolling_resistance: RollingResistance = Field(description="The formula to use to compute rolling resistance")
    loading_gauge: LoadingGaugeType
    metadata: Mapping[str, str] = Field(description="Properties used in the frontend to display the rolling stock")
    energy_sources: List[EnergySource] = Field(default_factory=list)
    electrical_power_startup_time: Optional[NonNegativeFloat] = Field(
        description="The time the train takes before actually using electrical power (in s). "
        + "Is null if the train is not electric.",
        default=None,
    )
    raise_pantograph_time: Optional[NonNegativeFloat] = Field(
        description="The time it takes to raise this train's pantograph in s. Is null if the train is not electric.",
        default=None,
    )
    supported_signaling_systems: List[str] = Field(default_factory=list)


class TowedRollingStock(BaseModel, extra="forbid"):
    """
    Towed rolling stock don't have power. They therefore are alike a rolling stock without
    all the traction properties.
    """

    name: str = Field(max_length=255)
    railjson_version: RAILJSON_ROLLING_STOCK_VERSION_TYPE = Field(default=RAILJSON_ROLLING_STOCK_VERSION)
    locked: bool = Field(default=False, description="Whether the rolling stock can be edited/deleted or not")
    mass: NonNegativeFloat = Field(description="The mass of the train, in kg")
    length: NonNegativeFloat = Field(description="The length of the train, in m")
    comfort_acceleration: NonNegativeFloat = Field(description="The maximum operational acceleration in m/s^2")
    startup_acceleration: NonNegativeFloat = Field(description="The maximum acceleration during startup in m/s^2")
    inertia_coefficient: NonNegativeFloat = Field(description="The coefficient of inertia")
    rolling_resistance: RollingResistance = Field(description="The formula to use to compute rolling resistance")
    gamma: Gamma = Field(description="The max or const braking coefficient in m/s^2")


if __name__ == "__main__":
    from json import dumps

    print(dumps(RollingStock.model_json_schema(), indent=4, sort_keys=True))
