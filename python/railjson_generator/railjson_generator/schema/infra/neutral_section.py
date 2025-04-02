from dataclasses import dataclass, field
from typing import List

from osrd_schemas import infra

from railjson_generator.schema.infra.direction import Direction
from railjson_generator.schema.infra.range_elements import DirectionalTrackRange
from railjson_generator.schema.infra.track_section import TrackSection


def _neutral_section_id():
    res = f"neutral_section.{NeutralSection._index}"
    NeutralSection._index += 1
    return res


@dataclass
class NeutralSection:
    """
    Neutral sections are portions of track where trains aren't allowed to pull power from electrifications.
    They have to rely on inertia to cross such sections.

    In practice, neutral sections are delimited by signs. In OSRD, neutral sections are directional
    to allow accounting for different sign placement depending on the direction.

    For more details see [the documentation](https://osrd.fr/en/docs/explanation/neutral_sections/).
    """

    announcement_track_ranges: List[DirectionalTrackRange] = field(default_factory=list)
    track_ranges: List[DirectionalTrackRange] = field(default_factory=list)
    lower_pantograph: bool = field(default=False)
    label: str = field(default_factory=_neutral_section_id)

    _index = 0

    @staticmethod
    def reset_index():
        NeutralSection._index = 0

    def add_track_range(
        self, track: TrackSection, begin: float, end: float, direction: Direction
    ):
        self.track_ranges.append(
            DirectionalTrackRange(
                begin=begin,
                end=end,
                track=track,
                direction=direction,
            )
        )

    def add_announcement_track_range(
        self, track: TrackSection, begin: float, end: float, direction: Direction
    ):
        self.announcement_track_ranges.append(
            DirectionalTrackRange(
                begin=begin,
                end=end,
                track=track,
                direction=direction,
            )
        )

    def to_rjs(self):
        return infra.NeutralSection(
            id=self.label,
            announcement_track_ranges=[
                track.to_rjs() for track in self.announcement_track_ranges
            ],
            track_ranges=[track.to_rjs() for track in self.track_ranges],
            lower_pantograph=self.lower_pantograph,
        )
