from dataclasses import dataclass, field
from typing import List

from railjson_generator.schema.location import Location
from railjson_generator.schema.simulation.stop import Stop
from railjson_generator.schema.infra.route import Route


def _train_id():
    res = f"train.{TrainSchedule._INDEX}"
    TrainSchedule._INDEX += 1
    return res


@dataclass
class TrainSchedule:
    initial_location: Location
    end_location: Location
    routes: List[Route]
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
            "rolling_stock": self.rolling_stock,
            "departure_time": self.departure_time,
            "initial_head_location": self.initial_location.format(),
            "initial_speed": self.initial_speed,
            "phases": [
                {
                    "driver_sight_distance": 400,
                    "end_location": self.end_location.format(),
                    "type": "navigate",
                }
            ],
            "stops": [stop.format() for stop in stops],
            "routes": [route.label for route in self.routes],
        }
