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


class RangeAllowance(BaseModel):
    begin_position: float
    end_position: float
    value: AllowanceValue


class ConstructionAllowance(RangeAllowance):
    allowance_type: Literal["construction"] = Field(default="construction")


class MarecoAllowance(BaseModel):
    allowance_type: Literal["mareco"] = Field(default="mareco")
    default_value: AllowanceValue
    ranges: List[RangeAllowance]


class Allowance(BaseModel):
    __root__: Union[ConstructionAllowance, MarecoAllowance] = Field(discriminator="allowance_type")


class Allowances(BaseModel):
    __root__: List[Allowance]
