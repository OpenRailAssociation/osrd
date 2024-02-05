from dataclasses import dataclass, field
from typing import List, Mapping, Optional

from osrd_schemas import infra

from .direction import Direction
from .waypoint import Waypoint


@dataclass
class Route:
    waypoints: List[Waypoint]
    release_waypoints: List[Waypoint]
    entry_point_direction: Direction
    track_nodes_directions: Mapping[str, str] = field(default_factory=dict)
    label: Optional[str] = field(default=None)

    def __hash__(self):
        return hash(self.label)

    def __eq__(self, other):
        return self.label == other.label

    @property
    def entry_point(self):
        return self.waypoints[0]

    @property
    def exit_point(self):
        return self.waypoints[-1]

    def __post_init__(self):
        if self.label is None:
            self.label = f"rt.{self.entry_point.label}->{self.exit_point.label}"

    def to_rjs(self):
        return infra.Route(
            id=self.label,
            entry_point=self.entry_point.get_waypoint_ref(),
            entry_point_direction=infra.Direction[self.entry_point_direction.name],
            exit_point=self.exit_point.get_waypoint_ref(),
            release_detectors=[w.id for w in self.release_waypoints],
            track_nodes_directions=self.track_nodes_directions,
        )
