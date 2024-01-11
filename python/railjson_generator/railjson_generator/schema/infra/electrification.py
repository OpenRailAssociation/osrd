from dataclasses import dataclass
from typing import List

from osrd_schemas import infra

from railjson_generator.schema.infra.track_section import TrackSection


@dataclass
class Electrification:
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
        return infra.Electrification(
            id=self.id,
            voltage=self.voltage,
            track_ranges=track_ranges,
        )
