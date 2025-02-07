from railjson_generator.schema.infra.direction import Direction
from railjson_generator.schema.infra.track_section import TrackSection
from railjson_generator.schema.location import DirectedLocation, Location


class TestLocation:
    def test_format(self):
        ts = TrackSection(label="ts", length=1)
        location = Location(ts, offset=0)

        assert location.format() == {"track_section": "ts", "offset": 0}


class TestDirectedLocation:
    def test_from_location(self):
        ts = TrackSection(label="ts", length=1)
        location = Location(ts, offset=0)

        assert DirectedLocation.from_location(
            location, Direction.START_TO_STOP
        ) == DirectedLocation(ts, offset=0, direction=Direction.START_TO_STOP)
        assert DirectedLocation.from_location(
            location, Direction.STOP_TO_START
        ) == DirectedLocation(ts, offset=0, direction=Direction.STOP_TO_START)

    def test_format(self):
        ts = TrackSection(label="ts", length=1)
        location = DirectedLocation(ts, offset=0, direction=Direction.START_TO_STOP)

        assert location.format() == {
            "track_section": "ts",
            "offset": 0,
            "direction": "START_TO_STOP",
        }
