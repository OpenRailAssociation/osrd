from dataclasses import dataclass, field
from typing import List, Mapping

from osrd_schemas import infra

from railjson_generator.schema.infra.direction import Direction
from railjson_generator.schema.infra.waypoint import Waypoint


@dataclass
class Route:
    waypoints: List[Waypoint]
    entry_point_direction: Direction
    switches_directions: Mapping[str, str] = field(default_factory=dict)
    label: str = field(default=None)
    path_elements: List["PathElement"] = field(default_factory=list)

    _INDEX = 0

    def __hash__(self):
        return hash(self.label)

    def __eq__(self, other):
        return self.label == other.label

    def __post_init__(self):
        if self.label is None:
            self.label = f"rt.{self.entry_point.label}->{self.waypoints[-1].label}"

    def to_rjs(self):
        return infra.Route(
            id=self.label,
            entry_point=self.entry_point.get_waypoint_ref(),
            entry_point_direction=infra.Direction[self.entry_point_direction.name],
            exit_point=self.exit_point.get_waypoint_ref(),
            release_detectors=[w.id for w in self.waypoints[1:-1]],
            switches_directions=self.switches_directions,
        )

    @property
    def entry_point(self):
        return self.waypoints[0]

    @property
    def exit_point(self):
        return self.waypoints[-1]
