from dataclasses import dataclass, field
from typing import List

from osrd_schemas.train_schedule import (
    Allowance,
    AllowanceDistribution,
    AllowancePercentValue,
    AllowanceTimePerDistanceValue,
    AllowanceTimeValue,
    EngineeringAllowance,
    StandardAllowance,
)

from railjson_generator.schema.location import DirectedLocation
from railjson_generator.schema.simulation.stop import Stop


def _train_id():
    res = f"train.{TrainSchedule._INDEX}"
    TrainSchedule._INDEX += 1
    return res


@dataclass
class TrainSchedule:
    label: str = field(default_factory=_train_id)
    rolling_stock: str = field(default="fast_rolling_stock")
    departure_time: float = field(default=0.0)
    initial_speed: float = field(default=0.0)
    stops: List[Stop] = field(default_factory=list)
    allowances: List[Allowance] = field(default_factory=list)

    _INDEX = 0

    def add_stop(self, *args, **kwargs):
        stop = Stop(*args, **kwargs)
        self.stops.append(stop)
        return stop

    def add_allowance(self, *args, engineering: bool = False, **kwargs):
        """Add an allowance to the train schedule. For more information on allowances, see
        the documentation of the Allowance class in osrd_schemas."""
        if engineering:
            allowance = EngineeringAllowance(*args, **kwargs)
        else:
            allowance = StandardAllowance(*args, **kwargs)
        self.allowances.append(allowance)

    def add_standard_single_value_allowance(self, value_type: str, value: float, distribution: str = "LINEAR"):
        """Add a standard allowance with a single value. For more information on allowances, see
        the documentation of the Allowance class in osrd_schemas."""
        if value_type == "time":
            value = AllowanceTimeValue(seconds=value)
        elif value_type == "time_per_distance":
            value = AllowanceTimePerDistanceValue(minutes=value)
        elif value_type == "percentage":
            value = AllowancePercentValue(percentage=value)
        else:
            raise ValueError(f"Unknown value kind {value_type}")

        distribution = AllowanceDistribution(distribution)

        self.add_allowance(default_value=value, distribution=distribution, ranges=[], capacity_speed_limit=-1)

    def format(self):
        stops = list(self.stops)
        stops.append(Stop(duration=1, position=-1))
        return {
            "id": self.label,
            "departure_time": self.departure_time,
            "initial_speed": self.initial_speed,
            "rolling_stock": self.rolling_stock,
            "stops": [s.format() for s in stops],
            "allowances": [a.dict() for a in self.allowances],
        }


def _group_id():
    res = f"group.{TrainScheduleGroup._INDEX}"
    TrainScheduleGroup._INDEX += 1
    return res


@dataclass
class TrainScheduleGroup:
    """A group of train schedules that share the same waypoints."""

    schedules: List[TrainSchedule] = field(default_factory=list)
    waypoints: List[List[DirectedLocation]] = field(default_factory=list)
    id: str = field(default_factory=_group_id)

    _INDEX = 0

    def format(self):
        return {
            "schedules": [s.format() for s in self.schedules],
            "waypoints": [[w.format() for w in wp] for wp in self.waypoints],
            "id": self.id,
        }

    def add_train_schedule(self, *args, **kwargs):
        train_schedule = TrainSchedule(*args, **kwargs)
        self.schedules.append(train_schedule)
        return train_schedule
