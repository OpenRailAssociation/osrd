import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import List

from railjson_generator.schema.simulation.train_schedule import TrainSchedule
from railjson_generator.schema.simulation.train_succession_table import TST


ROLLING_STOCKS = {}
for path in (
    Path(__file__)
    .parent.parent.parent.parent.parent.parent.joinpath("rolling_stocks")
    .iterdir()
):
    with open(path) as f:
        rs = json.load(f)
        ROLLING_STOCKS[rs["name"]] = rs


@dataclass
class Simulation:
    train_schedules: List[TrainSchedule] = field(default_factory=list)
    train_succession_tables: List[TST] = field(default_factory=list)

    def format(self):
        rs_names = {train.rolling_stock for train in self.train_schedules}
        return {
            "train_schedules": [train.format() for train in self.train_schedules],
            "train_succession_tables": [
                tst.format() for tst in self.train_succession_tables
            ],
            "rolling_stocks": [ROLLING_STOCKS[name] for name in rs_names],
        }

    def save(self, path):
        with open(path, "w") as f:
            json.dump(self.format(), f, indent=2)
