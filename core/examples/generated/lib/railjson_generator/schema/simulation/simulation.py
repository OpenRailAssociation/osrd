import json
from dataclasses import dataclass, field
from typing import List

from railjson_generator.rjs_static import ROLLING_STOCKS
from railjson_generator.schema.simulation.train_schedule import TrainSchedule
from railjson_generator.schema.simulation.train_succession_table import TST


@dataclass
class Simulation:
    train_schedules: List[TrainSchedule] = field(default_factory=list)
    train_succession_tables: List[TST] = field(default_factory=list)

    def format(self):
        return {
            "train_schedules": [train.format() for train in self.train_schedules],
            "train_succession_tables": [
                tst.format() for tst in self.train_succession_tables
            ],
            "rolling_stocks": ROLLING_STOCKS,
        }

    def save(self, path):
        with open(path, "w") as f:
            json.dump(self.format(), f)
