import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import List

from railjson_generator.schema.simulation.train_schedule import TrainScheduleGroup

ROLLING_STOCKS = {}
for path in Path(__file__).parents[2].joinpath("examples/rolling_stocks").iterdir():
    with open(path) as f:
        rs = json.load(f)
        ROLLING_STOCKS[rs["name"]] = rs


@dataclass
class Simulation:
    train_schedule_groups: List[TrainScheduleGroup] = field(default_factory=list)
    time_step: float = field(default=2.0)

    def format(self):
        rs_names = {sched.rolling_stock for group in self.train_schedule_groups for sched in group.schedules}
        return {
            "train_schedule_groups": [group.format() for group in self.train_schedule_groups],
            "rolling_stocks": [ROLLING_STOCKS[name] for name in rs_names],
            "time_step": self.time_step,
        }

    def save(self, path):
        with open(path, "w") as f:
            json.dump(self.format(), f, indent=2)
