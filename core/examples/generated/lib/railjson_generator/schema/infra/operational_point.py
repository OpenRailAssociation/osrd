from dataclasses import dataclass
from typing import List

import infra


@dataclass
class OperationalPoint:
    label: str
    parts: List

    def __init__(self, label: str):
        self.label = label
        self.parts = list()

    def add_part(self, track, offset):
        op_part = OperationalPointPart(self, offset)
        track.operational_points.append(op_part)
        self.parts.append(op_part)


@dataclass
class OperationalPointPart:
    operarational_point: OperationalPoint
    position: float

    def to_rjs(self, track):
        return infra.OperationalPointPart(
            track=track.make_rjs_ref(),
            position=self.position,
        )
