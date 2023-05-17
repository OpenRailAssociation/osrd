from dataclasses import dataclass, field
from typing import List

from osrd_schemas import infra

from railjson_generator.schema.infra.range_elements import (
    ApplicableDirectionsTrackRange,
)


def _dead_section_id():
    res = f"dead_section.{DeadSection._INDEX}"
    DeadSection._INDEX += 1
    return res


@dataclass
class DeadSection:
    track_ranges: List[ApplicableDirectionsTrackRange] = field(default_factory=list)
    track_ranges_push_pull: List[ApplicableDirectionsTrackRange] = field(default_factory=list)
    is_gap = bool
    label: str = field(default_factory=_dead_section_id)

    _INDEX = 0

    def add_track_range(self, track, begin, end, applicable_directions):
        self.track_ranges.append(
            ApplicableDirectionsTrackRange(
                begin=begin,
                end=end,
                track=track,
                applicable_directions=applicable_directions,
            )
        )

    def to_rjs(self):
        return infra.DeadSection(
            id=self.label,
            track_ranges=[track.to_rjs() for track in self.track_ranges],
            track_ranges_push_pull=[track.to_rjs() for track in self.track_ranges_push_pull],
            is_gap=self.is_gap,
        )
