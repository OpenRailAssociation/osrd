from dataclasses import dataclass, field
from typing import Optional

from railjson_generator.schema.location import Location


@dataclass
class Stop:
    duration: float
    location: Optional[Location] = field(default=None)
    position: Optional[float] = field(default=None)

    def __init__(self, duration, location=None, position=None):
        self.duration = duration
        if (location is None) == (position is None):
            raise RuntimeError(
                "Stop instantiation: only one of the attributes 'location' and"
                "'position' must be defined."
            )
        self.location = location
        self.position = position

    def format(self):
        if self.location is None:
            return {
                "duration": self.duration,
                "position": self.position,
            }
        return {
            "duration": self.duration,
            "location": self.location.format(),
        }
