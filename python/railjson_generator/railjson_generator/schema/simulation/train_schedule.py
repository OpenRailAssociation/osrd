from dataclasses import dataclass, field
from typing import List

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

    _INDEX = 0

    def add_stop(self, *args, **kwargs):
        stop = Stop(*args, **kwargs)
        self.stops.append(stop)
        return stop

    def format(self):
        stops = list(self.stops)
        stops.append(Stop(duration=1, position=-1))
        return {
            "id": self.label,
            "departure_time": self.departure_time,
            "initial_speed": self.initial_speed,
            "rolling_stock": self.rolling_stock,
            "stops": [s.format() for s in stops],
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
