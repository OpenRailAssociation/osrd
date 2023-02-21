from dataclasses import dataclass, field
from typing import Optional

from railjson_generator.schema.infra.direction import ApplicableDirection

from osrd_schemas import infra


@dataclass
class Waypoint:
    position: float
    waypoint_type: str
    label: str
    applicable_direction: ApplicableDirection = field(default=ApplicableDirection.BOTH)
    left_tvd: Optional["TVDSection"] = field(default=None, repr=False)
    right_tvd: Optional["TVDSection"] = field(default=None, repr=False)

    @property
    def id(self):
        return self.label

    def get_waypoint_ref(self):
        if self.waypoint_type == "buffer_stop":
            return infra.BufferStopReference(id=self.label, type="BufferStop")
        return infra.DetectorReference(id=self.label, type="Detector")

    def to_rjs(self, track):
        rjs_type = infra.BufferStop if self.waypoint_type == "buffer_stop" else infra.Detector
        return rjs_type(
            id=self.label,
            track=track.id,
            position=self.position,
            applicable_directions=infra.ApplicableDirections[self.applicable_direction.name],
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
