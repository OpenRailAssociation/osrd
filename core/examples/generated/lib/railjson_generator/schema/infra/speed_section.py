from dataclasses import dataclass, field
from typing import List

from railjson_generator.schema.infra.range_elements import ApplicableDirectionsTrackRange

from osrd_schemas import infra


def _speed_section_id():
    res = f"speed_section.{SpeedSection._INDEX}"
    SpeedSection._INDEX += 1
    return res


@dataclass
class SpeedSection:
    speed_limit: float
    track_ranges: List[ApplicableDirectionsTrackRange] = field(default_factory=list)
    label: str = field(default_factory=_speed_section_id)

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
        return infra.SpeedSection(
            id=self.label,
            speed_limit=self.speed_limit,
            speed_limit_by_tag={},
            track_ranges=[track.to_rjs() for track in self.track_ranges],
        )
