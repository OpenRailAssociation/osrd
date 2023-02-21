from dataclasses import dataclass
from typing import List

from railjson_generator.schema.infra.track_section import TrackSection

from osrd_schemas import infra


@dataclass
class Catenary:
    id: str
    voltage: str
    tracks: List[TrackSection]

    def to_rjs(self):
        track_ranges = []
        for track in self.tracks:
            track_ranges.append(
                infra.ApplicableDirectionsTrackRange(
                    track=track.id,
                    begin=0,
                    end=track.length,
                    applicable_directions=infra.ApplicableDirections.BOTH,
                )
            )
        return infra.Catenary(
            id=self.id,
            voltage=self.voltage,
            track_ranges=track_ranges,
        )
