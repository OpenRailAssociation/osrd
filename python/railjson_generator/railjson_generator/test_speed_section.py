from osrd_schemas.infra import ApplicableDirections

from railjson_generator.schema.infra.speed_section import (
    ApplicableDirectionsTrackRange,
    SpeedSection,
)
from railjson_generator.schema.infra.track_section import TrackSection


class TestSpeedSection:
    def test_applicable_track_ranges(self):
        track1, track2 = TrackSection(label="track1", length=10.0), TrackSection(label="track2", length=100.0)
        speed, ref = SpeedSection(speed_limit=60, label="speed"), SpeedSection(speed_limit=60, label="speed")

        speed.add_applicable_track_ranges(
            ApplicableDirectionsTrackRange(
                begin=50.0, end=100.0, track=track1, applicable_directions=ApplicableDirections.BOTH
            ),
            ApplicableDirectionsTrackRange(
                begin=0.0, end=200.0, track=track2, applicable_directions=ApplicableDirections.START_TO_STOP
            ),
        )

        ref.add_track_range(begin=50.0, end=100.0, track=track1, applicable_directions=ApplicableDirections.BOTH)
        ref.add_track_range(
            begin=0.0, end=200.0, track=track2, applicable_directions=ApplicableDirections.START_TO_STOP
        )

        assert speed == ref
