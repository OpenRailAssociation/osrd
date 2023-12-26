from dataclasses import dataclass
from typing import Any, Dict

from railjson_generator.schema.infra.direction import Direction
from railjson_generator.schema.infra.track_section import TrackSection


@dataclass
class Location:
    track_section: TrackSection
    offset: float

    def format(self) -> Dict[str, Any]:
        """Return a summary of the location as a dictionary."""
        return {
            "track_section": self.track_section.label,
            "offset": self.offset,
        }


@dataclass
class DirectedLocation(Location):
    direction: Direction

    def format(self) -> Dict[str, Any]:
        """Return a summary of the directed location as a dictionary."""
        return {
            **super().format(),
            "direction": self.direction.name,
        }

    @staticmethod
    def from_location(location: Location, direction: Direction) -> "DirectedLocation":
        """Return a directed location with the given direction."""
        return DirectedLocation(location.track_section, location.offset, direction)
