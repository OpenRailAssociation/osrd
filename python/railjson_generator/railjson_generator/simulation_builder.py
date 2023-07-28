from dataclasses import dataclass, field
from typing import List, Union

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

    def add_train_schedule(self, *locations: List[Location], **kwargs) -> TrainSchedule:
        """Creates a train schedule group containing only this train schedule."""
        train_schedule = TrainSchedule(**kwargs)
        self.add_train_schedule_group(locations, train_schedule)
        return train_schedule

    def add_train_schedule_group(
        self, locations: Union[List[Location], List[DirectedLocation]], *train_schedules: List[TrainSchedule]
    ) -> TrainScheduleGroup:
        if len(locations) < 2:
            raise ValueError(f"Expected at least 2 locations, got {len(locations)}")
        if isinstance(locations[0], Location):
            locations = [
                [DirectedLocation.from_location(loc, direction) for direction in Direction] for loc in locations
            ]
        else:
            locations = [[loc] for loc in locations]
        train_schedule_group = TrainScheduleGroup(train_schedules, locations)
        self.simulation.train_schedule_groups.append(train_schedule_group)
        return train_schedule_group

    def build(self) -> Simulation:
        return self.simulation
