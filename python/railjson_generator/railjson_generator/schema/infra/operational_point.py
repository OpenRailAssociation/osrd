from dataclasses import dataclass
from typing import Annotated, List, Optional

from pydantic import StringConstraints

from osrd_schemas import infra

NonBlankStr = Annotated[str, StringConstraints(min_length=1)]


@dataclass
class OperationalPoint:
    label: str
    trigram: str
    parts: List
    weight: Optional[int]
    uic: int
    ch: str
    id: str
    plc: Optional[NonBlankStr]

    def __init__(
        self,
        label: str,
        id: Optional[str] = None,
        trigram: Optional[str] = None,
        uic: int = 8700,
        weight: Optional[int] = None,
        ch: str = "BV",
        plc: Optional[NonBlankStr] = None,
    ):
        self.label = label
        self.trigram = trigram or label[:3].upper()
        self.parts = list()
        self.uic = uic
        self.weight = weight
        self.id = id or label
        self.ch = ch
        self.plc = plc

    def add_part(self, track, offset, local_track_name):
        op_part = OperationalPointPart(self, offset, local_track_name)
        track.operational_points.append(op_part)
        self.parts.append(op_part)


@dataclass
class OperationalPointPart:
    operational_point: OperationalPoint
    position: float
    local_track_name: str

    def to_rjs(self, track):
        return infra.OperationalPointPart(
            track=track.id,
            position=self.position,
            local_track_name=self.local_track_name,
        )
