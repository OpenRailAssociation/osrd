from dataclasses import dataclass, field
from typing import List

from osrd_schemas import infra

from railjson_generator.schema.infra.range_elements import TrackRange


def _dead_section_id():
    res = f"dead_section.{DeadSection._INDEX}"
    DeadSection._INDEX += 1
    return res


@dataclass
class DeadSection:
    track_ranges: List[TrackRange] = field(default_factory=list)
    push_pull_track_ranges: List[TrackRange] = field(default_factory=list)
    is_pantograph_drop_zone: bool = field(default=False)
    label: str = field(default_factory=_dead_section_id)

    _INDEX = 0

    def add_track_range(self, track, begin, end):
        self.track_ranges.append(
            TrackRange(
                begin=begin,
                end=end,
                track=track,
            )
        )

    def to_rjs(self):
        return infra.DeadSection(
            id=self.label,
            track_ranges=[track.to_rjs() for track in self.track_ranges],
            push_pull_track_ranges=[track.to_rjs() for track in self.push_pull_track_ranges],
            is_pantograph_drop_zone=self.is_pantograph_drop_zone,
        )
