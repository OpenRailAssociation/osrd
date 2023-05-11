from dataclasses import dataclass

from railjson_generator.schema.infra.direction import Direction
from railjson_generator.schema.infra.track_section import TrackSection


@dataclass
class Location:
    track_section: TrackSection
    offset: float

    def format(self):
        return {
            "track_section": self.track_section.label,
            "offset": self.offset,
        }


@dataclass
class DirectedLocation(Location):
    direction: Direction

    def format(self):
        return {
            **super().format(),
            "direction": self.direction.name,
        }

    @staticmethod
    def from_location(location: Location, direction: Direction):
        return DirectedLocation(location.track_section, location.offset, direction)
