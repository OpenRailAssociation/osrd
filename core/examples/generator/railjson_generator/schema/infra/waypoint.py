import schemas
from dataclasses import dataclass, field
from typing import Optional

from railjson_generator.schema.infra.direction import ApplicableDirection
from railjson_generator.schema.infra.placeholders import placeholder_geo_points


@dataclass
class Waypoint:
    position: float
    waypoint_type: str
    label: str
    applicable_direction: ApplicableDirection = field(default=ApplicableDirection.BOTH)
    left_tvd: Optional["TVDSection"] = field(default=None, repr=False)
    right_tvd: Optional["TVDSection"] = field(default=None, repr=False)

    def make_rjs_ref(self):
        return schemas.ObjectReference(
            id=self.label,
            type="waypoint"
        )

    def to_rjs(self, track_reference):
        rjs_type = schemas.BufferStop if self.waypoint_type == "buffer_stop" else schemas.Detector
        return rjs_type(
            id=self.label,
            track=track_reference,
            position=self.position,
            applicable_directions=schemas.ApplicableDirections[self.applicable_direction.name],
            **placeholder_geo_points()
        )


def _buffer_stop_id():
    res = f"buffer_stop.{BufferStop._INDEX}"
    BufferStop._INDEX += 1
    return res


@dataclass
class BufferStop(Waypoint):
    waypoint_type: str = "buffer_stop"
    label: str = field(default_factory=_buffer_stop_id)

    _INDEX = 0


def _detector_id():
    res = f"detector.{Detector._INDEX}"
    Detector._INDEX += 1
    return res


@dataclass
class Detector(Waypoint):
    waypoint_type: str = "detector"
    label: str = field(default_factory=_detector_id)

    _INDEX = 0
