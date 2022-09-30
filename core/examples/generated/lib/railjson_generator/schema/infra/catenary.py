import infra
from dataclasses import dataclass, field
from typing import List

from railjson_generator.schema.infra.track_section import TrackSection


@dataclass
class Catenary:
    id: str
    voltage: int
    tracks: List[TrackSection]

    def to_rjs(self):
        track_ranges = []
        for track in self.tracks:
            track_ranges.append(infra.ApplicableDirectionsTrackRange(
                track=track.make_rjs_ref(),
                begin=0,
                end=track.length,
                applicable_directions=infra.ApplicableDirections.BOTH,
            ))
        return infra.Catenary(
            id=self.id,
            voltage=self.voltage,
            track_ranges=track_ranges,
        )

