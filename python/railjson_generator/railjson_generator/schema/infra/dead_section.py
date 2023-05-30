from dataclasses import dataclass, field
from typing import List

from osrd_schemas import infra

from railjson_generator.utils.pathfinding import PathElement


def _dead_section_id():
    res = f"dead_section.{DeadSection._INDEX}"
    DeadSection._INDEX += 1
    return res


@dataclass
class DeadSection:
    track_ranges: List[PathElement] = field(default_factory=list)
    backside_pantograph_track_ranges: List[PathElement] = field(default_factory=list)
    is_pantograph_drop_zone: bool = field(default=False)
    label: str = field(default_factory=_dead_section_id)

    _INDEX = 0

    def add_track_range(self, track, begin, end, direction):
        self.track_ranges.append(
            PathElement(
                begin=begin,
                end=end,
                track_section=track,
                direction=direction,
            )
        )

    def to_rjs(self):
        return infra.DeadSection(
            id=self.label,
            track_ranges=[track.to_rjs() for track in self.track_ranges],
            backside_pantograph_track_ranges=[track.to_rjs() for track in self.backside_pantograph_track_ranges],
            is_pantograph_drop_zone=self.is_pantograph_drop_zone,
        )
