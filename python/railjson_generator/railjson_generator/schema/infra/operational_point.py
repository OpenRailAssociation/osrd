from dataclasses import dataclass
from typing import List

from osrd_schemas import infra


@dataclass
class OperationalPoint:
    label: str
    trigram: str
    parts: List

    def __init__(self, label: str, trigram: str = None):
        self.label = label
        self.trigram = trigram or label[:3].upper()
        self.parts = list()

    def add_part(self, track, offset):
        op_part = OperationalPointPart(self, offset)
        track.operational_points.append(op_part)
        self.parts.append(op_part)


@dataclass
class OperationalPointPart:
    operational_point: OperationalPoint
    position: float

    def to_rjs(self, track):
        return infra.OperationalPointPart(
            track=track.id,
            position=self.position,
        )
