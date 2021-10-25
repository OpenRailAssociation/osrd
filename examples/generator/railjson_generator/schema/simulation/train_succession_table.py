from dataclasses import dataclass
from typing import List

from railjson_generator.schema.infra.switch import Switch
from railjson_generator.schema.simulation.train_schedule import TrainSchedule


@dataclass
class TST:
    switch: Switch
    train_order: List[TrainSchedule]

    def format(self):
        return {
            "switch": self.switch.label,
            "train_order": [train.label for train in self.train_order],
        }
