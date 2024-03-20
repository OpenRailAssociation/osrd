from railjson_generator.schema.infra.direction import ApplicableDirection
from railjson_generator.schema.infra.range_elements import (
    ApplicableDirectionsTrackRange,
)
from railjson_generator.schema.infra.track_section import TrackSection


class TestTrackSection:
    def test_forwards(self):
        length = 100
        track = TrackSection(length)

        assert track.forwards() == ApplicableDirectionsTrackRange(
            begin=0.0, end=length, track=track, applicable_directions=ApplicableDirection.START_TO_STOP
        )
        assert track.forwards(begin=10) == ApplicableDirectionsTrackRange(
            begin=10, end=length, track=track, applicable_directions=ApplicableDirection.START_TO_STOP
        )
        assert track.forwards(begin=5, end=90) == ApplicableDirectionsTrackRange(
            begin=5, end=90, track=track, applicable_directions=ApplicableDirection.START_TO_STOP
        )

    def test_backwards(self):
        length = 100
        track = TrackSection(length)

        assert track.backwards() == ApplicableDirectionsTrackRange(
            begin=0.0, end=length, track=track, applicable_directions=ApplicableDirection.STOP_TO_START
        )
        assert track.backwards(begin=10) == ApplicableDirectionsTrackRange(
            begin=10, end=length, track=track, applicable_directions=ApplicableDirection.STOP_TO_START
        )
        assert track.backwards(begin=5, end=90) == ApplicableDirectionsTrackRange(
            begin=5, end=90, track=track, applicable_directions=ApplicableDirection.STOP_TO_START
        )
