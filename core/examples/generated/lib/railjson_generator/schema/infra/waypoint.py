from dataclasses import dataclass, field
from typing import Optional, Type, Union

from osrd_schemas import infra
from railjson_generator.schema.infra.direction import (ApplicableDirection,
                                                       Direction)

Waypoint = Union[Type["BufferStop"], Type["Detector"]]


def _buffer_stop_id():
    res = f"buffer_stop.{BufferStop._INDEX}"
    BufferStop._INDEX += 1
    return res


@dataclass
class BufferStop:
    position: float
    label: str = field(default_factory=_buffer_stop_id)
    left_tvd: Optional["TVDSection"] = field(default=None, repr=False)
    right_tvd: Optional["TVDSection"] = field(default=None, repr=False)

    _INDEX = 0

    @property
    def id(self):
        return self.label

    def get_waypoint_ref(self):
        return infra.BufferStopReference(id=self.label, type="BufferStop")

    def to_rjs(self, track):
        return infra.BufferStop(
            id=self.label,
            track=track.id,
            position=self.position,
        )

    def get_direction(self, track) -> Direction:
        if self.position < track.length / 2:
            return Direction.START_TO_STOP
        return Direction.STOP_TO_START


def _detector_id():
    res = f"detector.{Detector._INDEX}"
    Detector._INDEX += 1
    return res


@dataclass
class Detector:
    position: float
    applicable_direction: ApplicableDirection = field(default=ApplicableDirection.BOTH)
    label: str = field(default_factory=_detector_id)
    left_tvd: Optional["TVDSection"] = field(default=None, repr=False)
    right_tvd: Optional["TVDSection"] = field(default=None, repr=False)

    _INDEX = 0

    @property
    def id(self):
        return self.label

    def get_waypoint_ref(self):
        return infra.DetectorReference(id=self.label, type="Detector")

    def to_rjs(self, track):
        return infra.Detector(
            id=self.label,
            track=track.id,
            position=self.position,
            applicable_directions=infra.ApplicableDirections[self.applicable_direction.name],
        )
