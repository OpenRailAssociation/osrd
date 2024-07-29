from dataclasses import dataclass, field
from typing import Sequence, Union

from railjson_generator.schema.infra.direction import Direction
from railjson_generator.schema.location import DirectedLocation, Location
from railjson_generator.schema.simulation.simulation import Simulation
from railjson_generator.schema.simulation.train_schedule import (
    TrainSchedule,
    TrainScheduleGroup,
)


@dataclass
class SimulationBuilder:
    simulation: Simulation = field(default_factory=Simulation)

    def add_train_schedule(self, *locations: Location, **kwargs) -> TrainSchedule:
        """Create a train schedule group containing only this train schedule."""
        train_schedule = TrainSchedule(**kwargs)
        self.add_train_schedule_group(locations, train_schedule)
        return train_schedule

    def add_train_schedule_group(
        self, locations: Sequence[Union[Location, DirectedLocation]], *train_schedules: TrainSchedule
    ) -> TrainScheduleGroup:
        """Create a train schedule group containing the given train schedules.

        Simple locations are expanded to directed locations in all directions."""
        if len(locations) < 2:
            raise ValueError(f"Expected at least 2 locations, got {len(locations)}")
        directed_locations = [
            (
                [loc]
                if isinstance(loc, DirectedLocation)
                else [DirectedLocation.from_location(loc, direction) for direction in Direction]
            )
            for loc in locations
        ]
        train_schedule_group = TrainScheduleGroup(list(train_schedules), directed_locations)
        self.simulation.train_schedule_groups.append(train_schedule_group)
        return train_schedule_group

    def build(self) -> Simulation:
        """Return the simulation object."""
        return self.simulation
