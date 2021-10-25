from dataclasses import dataclass, field
from typing import Dict, List, Mapping

from railjson_generator.schema.infra.direction import Direction
from railjson_generator.schema.infra.tvd_section import TVDSection
from railjson_generator.schema.infra.waypoint import Waypoint


def _route_id():
    res = f"route.{Route._INDEX}"
    Route._INDEX += 1
    return res


@dataclass
class Route:
    entry_point: Waypoint
    exit_point: Waypoint
    entry_direction: Direction
    switches_group: Mapping[str, str] = field(default_factory=dict)
    tvd_sections: List[TVDSection] = field(default_factory=list)
    label: str = field(default_factory=_route_id)
    path_elements: List["PathElement"] = field(default_factory=list)

    _INDEX = 0

    def format(self) -> Dict:
        return {
            "id": self.label,
            "entry_point": self.entry_point.label,
            "exit_point": self.exit_point.label,
            "entry_direction": self.entry_direction.name,
            "switches_group": self.switches_group,
            "release_groups": [[tvd.label] for tvd in self.tvd_sections],
        }

    def __hash__(self):
        return hash(self.label)

    def __eq__(self, other):
        return self.label == other.label
