from dataclasses import dataclass, field
from typing import List, Mapping, Optional

from osrd_schemas import infra

from railjson_generator.schema.infra.range_elements import (
    ApplicableDirectionsTrackRange,
)


def _speed_section_id():
    # pytype: disable=name-error
    res = f"speed_section.{SpeedSection._INDEX}"
    SpeedSection._INDEX += 1
    # pytype: enable=name-error
    return res


@dataclass
class SpeedSection:
    speed_limit: float
    speed_limit_by_tag: Mapping[str, float] = field(default_factory=dict)
    track_ranges: List[ApplicableDirectionsTrackRange] = field(default_factory=list)
    label: str = field(default_factory=_speed_section_id)
    on_routes: Optional[List[str]] = None

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

    def add_applicable_track_ranges(self, *track_ranges: ApplicableDirectionsTrackRange):
        self.track_ranges += track_ranges

    def to_rjs(self):
        return infra.SpeedSection(
            id=self.label,
            speed_limit=self.speed_limit,
            speed_limit_by_tag=self.speed_limit_by_tag,
            track_ranges=[track.to_rjs() for track in self.track_ranges],
            on_routes=self.on_routes,
        )
