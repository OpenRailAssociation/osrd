from dataclasses import dataclass
from typing import Annotated, List, Optional

from pydantic import StringConstraints

from osrd_schemas_auto import models

NonBlankStr = Annotated[str, StringConstraints(min_length=1)]


@dataclass
class OperationalPoint:
    label: NonBlankStr
    id: str
    parts: List
    weight: Optional[int]
    uic: Optional[int]
    plc: Optional[NonBlankStr]
    country_code: NonBlankStr
    main_code: NonBlankStr
    secondary_code: Optional[NonBlankStr]
    is_passenger_station: bool

    def __init__(
        self,
        label: str,
        id: Optional[str] = None,
        main_code: Optional[NonBlankStr] = None,
        uic: Optional[int] = 8700,
        plc: Optional[NonBlankStr] = None,
        weight: Optional[int] = None,
        secondary_code: Optional[NonBlankStr] = "BV",
        country_code: NonBlankStr = "FR",
        is_passenger_station: bool = True,
    ):
        self.label = label
        self.main_code = main_code or label[:3].upper()
        self.parts = list()
        self.uic = uic
        self.weight = weight
        self.id = id or label
        self.secondary_code = secondary_code
        self.plc = plc
        self.country_code = country_code
        self.is_passenger_station = is_passenger_station

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
        return models.OperationalPointPart(
            track=track.id,
            position=self.position,
            local_track_name=self.local_track_name,
        )
