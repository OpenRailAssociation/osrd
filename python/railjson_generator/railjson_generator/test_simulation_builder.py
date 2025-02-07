import pytest

from railjson_generator.schema.infra.direction import Direction
from railjson_generator.schema.infra.track_section import TrackSection
from railjson_generator.schema.location import DirectedLocation, Location
from railjson_generator.schema.simulation.train_schedule import (
    TrainSchedule,
    TrainScheduleGroup,
)
from railjson_generator.simulation_builder import SimulationBuilder


class TestSimulationBuilder:
    def test_add_train_schedule(self):
        sb = SimulationBuilder()
        assert sb.simulation.train_schedule_groups == []
        ts = TrackSection(length=1)
        location1 = Location(ts, offset=0)
        location2 = Location(ts, offset=1)

        train_schedule = sb.add_train_schedule(location1, location2)

        assert train_schedule == TrainSchedule(label=train_schedule.label)
        assert sb.simulation.train_schedule_groups == [
            TrainScheduleGroup(
                schedules=[train_schedule],
                waypoints=[
                    [
                        DirectedLocation.from_location(
                            location1, Direction.START_TO_STOP
                        ),
                        DirectedLocation.from_location(
                            location1, Direction.STOP_TO_START
                        ),
                    ],
                    [
                        DirectedLocation.from_location(
                            location2, Direction.START_TO_STOP
                        ),
                        DirectedLocation.from_location(
                            location2, Direction.STOP_TO_START
                        ),
                    ],
                ],
                id=sb.simulation.train_schedule_groups[0].id,
            )
        ]

    def test_add_train_schedule_group_missing_location(self):
        sb = SimulationBuilder()
        locations = [Location(TrackSection(length=1), offset=0)]
        ts = TrainSchedule()

        with pytest.raises(ValueError, match="Expected at least 2 locations, got 1"):
            sb.add_train_schedule_group(locations, ts)

    def test_add_train_schedule_group(self):
        sb = SimulationBuilder()
        assert sb.simulation.train_schedule_groups == []
        ts = TrackSection(length=1)
        location1 = DirectedLocation(ts, offset=0, direction=Direction.START_TO_STOP)
        location2 = DirectedLocation(ts, offset=1, direction=Direction.STOP_TO_START)
        ts = TrainSchedule()

        train_schedule_group = sb.add_train_schedule_group([location1, location2], ts)

        tsg = TrainScheduleGroup(
            schedules=[ts],
            waypoints=[[location1], [location2]],
            id=train_schedule_group.id,
        )
        assert train_schedule_group == tsg
        assert sb.simulation.train_schedule_groups == [tsg]

    def test_build(self):
        sb = SimulationBuilder()
        ts = TrackSection(length=1)
        location1 = Location(ts, offset=0)
        location2 = Location(ts, offset=1)
        train_schedule = sb.add_train_schedule(location1, location2)

        simulation = sb.build()

        assert simulation.train_schedule_groups == [
            TrainScheduleGroup(
                schedules=[train_schedule],
                waypoints=[
                    [
                        DirectedLocation.from_location(
                            location1, Direction.START_TO_STOP
                        ),
                        DirectedLocation.from_location(
                            location1, Direction.STOP_TO_START
                        ),
                    ],
                    [
                        DirectedLocation.from_location(
                            location2, Direction.START_TO_STOP
                        ),
                        DirectedLocation.from_location(
                            location2, Direction.STOP_TO_START
                        ),
                    ],
                ],
                id=sb.simulation.train_schedule_groups[0].id,
            )
        ]
