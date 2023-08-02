from dataclasses import dataclass, field
from typing import List

from osrd_schemas import infra

from railjson_generator.schema.infra.direction import Direction
from railjson_generator.schema.infra.track_section import TrackSection


def _dead_section_id():
    res = f"dead_section.{DeadSection._INDEX}"
    DeadSection._INDEX += 1
    return res


@dataclass
class PathElement:
    track_section: TrackSection
    direction: Direction
    begin: float
    end: float

    def length(self):
        return abs(self.begin - self.end)

    def to_rjs(self):
        return infra.DirectionalTrackRange(
            track=self.track_section.id,
            begin=min(self.begin, self.end),
            end=max(self.begin, self.end),
            direction=infra.Direction[self.direction.name],
        )


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
