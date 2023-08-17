from enum import Enum
from typing import Annotated, List, Literal, Union

from pydantic import BaseModel, Field, RootModel, StringConstraints

# Labels


class TrainScheduleLabels(RootModel):
    """This class defines train schedule labels."""

    root: List[Annotated[str, StringConstraints(max_length=128)]]


# MRSP

"""The MRSP is a static envelope giving the limit speed at each point to perform the standalone simulation."""


class MRSPPoint(BaseModel):
    """This class defines each point used to compute the Most restricted speed profile (MRSP)."""

    position: float = Field(
        description="Relative position of the point in meters with respect to the track section", ge=0
    )
    speed: float = Field(description="Speed at the point considered in meters per second", ge=0)


class MRSP(RootModel):
    """This class is used to compute the MRSP."""

    root: List[MRSPPoint] = Field(description="List of each point used to calculate the MRSP envelope")


# Allowances
"""Allowances are times added to the standalone simulation to take into account certain parameters that may occur.
Otherwise, a train leaving late would always arrive late."""


class AllowanceTimePerDistanceValue(BaseModel):
    """This class defines the value (in minutes per 100 kilometers) of an allowance."""

    value_type: Literal["time_per_distance"] = Field(default="time_per_distance")
    minutes: float = Field(description="min/100km", gt=0)


class AllowanceTimeValue(BaseModel):
    """This class defines the value (in seconds) of an allowance."""

    value_type: Literal["time"] = Field(default="time")
    seconds: float = Field(description="s", gt=0)


class AllowancePercentValue(BaseModel):
    """This class defines the value (but in percentage) of an allowance."""

    value_type: Literal["percentage"] = Field(default="percentage")
    percentage: float = Field(description="%", gt=0)


class AllowanceValue(RootModel):
    """This class allows to choose the different present types of values used to apply an allowance."""

    root: Union[AllowanceTimeValue, AllowancePercentValue, AllowanceTimePerDistanceValue] = Field(
        discriminator="value_type"
    )


class AllowanceDistribution(str, Enum):
    """This class defines the two distributions of allowances that can be applied to the standalone simulation.
    The first one is LINEAR, which means that an allowance is applied that will be the same for the whole simulation.
    The second one is based on the MARECO algorithm, which consists in distributing the allowance as economically
    as possible in terms of energy consumption.
    """

    mareco = "MARECO"
    linear = "LINEAR"


class RangeAllowance(BaseModel):
    """This class defines the addition of an allowance between two specific points and not on the complete path."""

    begin_position: float = Field(
        description="Offset in meters corresponding to the beginning of the addition of the allowance", ge=0
    )
    end_position: float = Field(description="Offset in meters corresponding to the end of the allowance", ge=0)
    value: AllowanceValue = Field(description="The type of value of the allowance")


class EngineeringAllowance(RangeAllowance):
    """This class determines the engineering allowance.
    This corresponds to time added on a specific interval, in addition to the standard allowance,
    but this time for operational reasons."""

    allowance_type: Literal["engineering"] = Field(default="engineering")
    distribution: AllowanceDistribution = Field(description="The considered distribution of an allowance")
    capacity_speed_limit: float = Field(
        description="Speed (m/s) that cannot be exceeded (defaults to -1 for no maximum)",
        default=-1,
    )


class StandardAllowance(BaseModel):
    """This class determines the standard allowance.
    This corresponds to additional time added to the basic standalone simulation to take into account
    the inaccuracy of the speed measurement,
    to compensate for the consequences of external incidents disrupting the theoretical run of the trains,
    and to maintain the regularity of the traffic."""

    allowance_type: Literal["standard"] = Field(default="standard")
    default_value: AllowanceValue = Field(description="Type of value of the allowance")
    ranges: List[RangeAllowance] = Field(description="List of the different application ranges of the allowances")
    distribution: AllowanceDistribution = Field(description="The considered distribution of an allowance")
    capacity_speed_limit: float = Field(
        description="Speed (m/s) that cannot be exceeded (defaults to -1 for no maximum)",
        default=-1,
    )


class Allowance(RootModel):
    """This class allows to choose the two different types of allowance."""

    root: Union[EngineeringAllowance, StandardAllowance] = Field(discriminator="allowance_type")


class Allowances(RootModel):
    """This class defines all the final allowances contained on the considered path."""

    root: List[Allowance] = Field(description="List of all well-defined allowances of the path")


# Scheduled points


class ScheduledPoint(BaseModel):
    """A schedule point is a point on the path where the train must be at a given time."""

    path_offset: float = Field(description="Offset on a path. If negative then represents the end of the path.")
    time: float = Field(
        description="Time in seconds (elapsed since the train's departure) at which the train must be.", ge=0
    )


class ScheduledPoints(RootModel):
    """A list of schedule point"""

    root: List[ScheduledPoint] = Field(description="List of schedule point")


# Power restrictions
"""Power restrictions are used to limit the power consumption of trains on some parts of the infrastructure.
Infrastructure managers use them to prevent power grid overloads.
We model power restrictions by assigning some power restriction codes to some parts of the train path.
Rolling stocks then have an attribute that maps power restriction codes to power usages."""


class PowerRestrictionRange(BaseModel):
    """A user-specified range of the train path where a power restriction is applied.
    Ideally, this should come from infrastructure data."""

    begin_position: float = Field(description="Offset in meters from the beginning of the path", ge=0)
    end_position: float = Field(description="Offset in meters from the beginning of the path", ge=0)
    power_restriction_code: str = Field(description="The code of the power restriction to apply")


class PowerRestrictionRanges(RootModel):
    """A list of power restriction ranges."""

    root: List[PowerRestrictionRange]


class TrainScheduleOptions(BaseModel):
    """Optional arguments for the standalone simulation."""

    ignore_electrical_profiles: bool = Field(
        default=False,
        description="If true, the electrical profiles are ignored in the standalone simulation",
    )


if __name__ == "__main__":
    print(MRSP.schema_json(indent=2))
