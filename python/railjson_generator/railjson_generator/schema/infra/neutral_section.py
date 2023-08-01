from dataclasses import dataclass, field
from typing import List

from osrd_schemas import infra

from railjson_generator.schema.infra.direction import Direction
from railjson_generator.schema.infra.track_section import TrackSection


def _neutral_section_id():
    res = f"neutral_section.{NeutralSection._INDEX}"
    NeutralSection._INDEX += 1
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
class NeutralSection:
    track_ranges: List[PathElement] = field(default_factory=list)
    lower_pantograph: bool = field(default=False)
    label: str = field(default_factory=_neutral_section_id)

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
        return infra.NeutralSection(
            id=self.label,
            track_ranges=[track.to_rjs() for track in self.track_ranges],
            lower_pantograph=self.lower_pantograph,
        )
