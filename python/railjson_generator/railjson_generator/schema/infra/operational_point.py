from dataclasses import dataclass
from typing import Annotated

from osrd_schemas import models
from pydantic import StringConstraints

NonBlankStr = Annotated[str, StringConstraints(min_length=1)]


@dataclass
class OperationalPoint:
    label: NonBlankStr
    id: str
    parts: list
    weight: int | None
    uic: int | None
    plc: NonBlankStr | None
    country_code: NonBlankStr
    main_code: NonBlankStr
    secondary_code: NonBlankStr | None
    secondary_name: NonBlankStr | None
    is_passenger_station: bool

    def __init__(
        self,
        label: str,
        id: str | None = None,
        main_code: NonBlankStr | None = None,
        uic: int | None = 8700,
        plc: NonBlankStr | None = None,
        weight: int | None = None,
        secondary_code: NonBlankStr | None = "BV",
        secondary_name: NonBlankStr | None = "0",
        country_code: NonBlankStr = "FR",
        is_passenger_station: bool = True,
    ):
        self.label = label
        self.main_code = main_code or label[:3].upper()
        self.parts = []
        self.uic = uic
        self.weight = weight
        self.id = id or label
        self.secondary_code = secondary_code
        self.secondary_name = secondary_name
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
