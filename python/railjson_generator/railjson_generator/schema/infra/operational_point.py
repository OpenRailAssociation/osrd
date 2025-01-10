from dataclasses import dataclass
from typing import List, Optional

from osrd_schemas import infra


@dataclass
class OperationalPoint:
    label: str
    trigram: str
    parts: List
    weight: Optional[int]
    is_station: bool
    uic: int

    def __init__(
        self,
        label: str,
        trigram: Optional[str] = None,
        uic: int = 0,
        weight: Optional[int] = None,
        is_station: bool = False,
    ):
        self.label = label
        self.trigram = trigram or label[:3].upper()
        self.parts = list()
        self.uic = uic
        self.weight = weight
        self.is_station = is_station

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
