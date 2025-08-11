from dataclasses import dataclass
from typing import List, Optional

from osrd_schemas import infra


@dataclass
class OperationalPoint:
    label: str
    trigram: str
    parts: List
    weight: Optional[int]
    uic: int
    ch: str
    custom_id: Optional[str]

    def __init__(
        self,
        label: str,
        trigram: Optional[str] = None,
        uic: int = 8700,
        weight: Optional[int] = None,
        id: Optional[str] = None,
        ch: str = "BV",
    ):
        self.label = label
        self.trigram = trigram or label[:3].upper()
        self.parts = list()
        self.uic = uic
        self.weight = weight
        self.custom_id = id
        self.ch = ch

    def id(self) -> str:
        return self.custom_id or self.label

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
