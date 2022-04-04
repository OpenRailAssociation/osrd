from dataclasses import dataclass, field
from typing import List, Mapping

from railjson_generator.schema.infra.direction import Direction
from railjson_generator.schema.infra.make_geo_data import make_geo_lines
from railjson_generator.schema.infra.waypoint import Waypoint

import infra


@dataclass
class Route:
    waypoints: List[Waypoint]
    entry_direction: Direction
    switches_group: Mapping[str, str] = field(default_factory=dict)
    label: str = field(default=None)
    path_elements: List["PathElement"] = field(default_factory=list)

    _INDEX = 0

    def __hash__(self):
        return hash(self.label)

    def __eq__(self, other):
        return self.label == other.label

    def to_rjs(self):
        if self.label is None:
            self.label = f"rt.{self.entry_point.label}->{self.waypoints[-1].label}"
        return infra.Route(
            id=self.label,
            entry_point=self.entry_point.make_rjs_ref(),
            exit_point=self.exit_point.make_rjs_ref(),
            release_detectors=[w.make_rjs_ref() for w in self.waypoints[1:-1]],
            path=[element.to_rjs() for element in self.path_elements],
        )

    def _make_geo_lines(self):
        coordinates = []
        for element in self.path_elements:
            coordinates.append(element.track_section.get_coordinates_at_offset(element.begin))
        last_element = self.path_elements[-1]
        coordinates.append(last_element.track_section.get_coordinates_at_offset(last_element.end))
        return make_geo_lines(*coordinates)

    @property
    def entry_point(self):
        return self.waypoints[0]

    @property
    def exit_point(self):
        return self.waypoints[-1]
