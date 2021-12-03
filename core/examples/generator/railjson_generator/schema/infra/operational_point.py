from dataclasses import dataclass
from typing import List

import schemas
from railjson_generator.schema.infra.placeholders import placeholder_geo_points


@dataclass
class OperationalPoint:
    label: str
    parts: List

    def __init__(self, label: str):
        self.label = label
        self.parts = list()

    def set_position(self, track, offset):
        op_part = OperationalPointPart(self, offset)
        track.operational_points.append(op_part)
        self.parts.append(op_part)


@dataclass
class OperationalPointPart:
    operarational_point: OperationalPoint
    position: float

    def to_rjs(self, track_reference):
        return schemas.OperationalPointPart(
            track=track_reference,
            position=self.position,
            **placeholder_geo_points()
        )
