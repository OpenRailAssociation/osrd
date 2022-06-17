from enum import Enum
from typing import List, Literal, Union

from pydantic import BaseModel, Field, constr

# Labels


class TrainScheduleLabels(BaseModel):
    __root__: List[constr(max_length=128)]


# MRSP


class MRSPPoint(BaseModel):
    position: float
    speed: float


class MRPS(BaseModel):
    __root__: List[MRSPPoint]


# Allowances


class AllowanceTimePerDistanceValue(BaseModel):
    value_type: Literal["time_per_distance"] = Field(default="time_per_distance")
    minutes: float = Field(description="min/100km")


class AllowanceTimeValue(BaseModel):
    value_type: Literal["time"] = Field(default="time")
    seconds: float


class AllowancePercentValue(BaseModel):
    value_type: Literal["percentage"] = Field(default="percentage")
    percentage: float


class AllowanceValue(BaseModel):
    __root__: Union[AllowanceTimeValue, AllowancePercentValue, AllowanceTimePerDistanceValue] = Field(
        discriminator="value_type"
    )


class AllowanceDistribution(str, Enum):
    mareco = "MARECO"
    linear = "LINEAR"


class RangeAllowance(BaseModel):
    begin_position: float
    end_position: float
    value: AllowanceValue


class EngineeringAllowance(RangeAllowance):
    allowance_type: Literal["engineering"] = Field(default="engineering")
    distribution: AllowanceDistribution
    capacity_speed_limit: float


class StandardAllowance(BaseModel):
    allowance_type: Literal["standard"] = Field(default="standard")
    default_value: AllowanceValue
    ranges: List[RangeAllowance]
    distribution: AllowanceDistribution
    capacity_speed_limit: float


class Allowance(BaseModel):
    __root__: Union[EngineeringAllowance, StandardAllowance] = Field(discriminator="allowance_type")


class Allowances(BaseModel):
    __root__: List[Allowance]
