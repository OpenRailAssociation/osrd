from dataclasses import dataclass, field
from typing import Union

from osrd_schemas_auto import models

from railjson_generator.schema.infra.direction import Direction

Waypoint = Union["BufferStop", "Detector"]


def _buffer_stop_id():
    res = f"buffer_stop.{BufferStop._index}"
    BufferStop._index += 1
    return res


@dataclass
class BufferStop:
    position: float
    label: str = field(default_factory=_buffer_stop_id)

    _index = 0

    @staticmethod
    def reset_index():
        BufferStop._index = 0

    @property
    def id(self):
        return self.label

    def get_waypoint_ref(self):
        return models.WaypointBufferStop(id=self.label, type="BufferStop")

    def to_rjs(self, track):
        return models.BufferStop(
            id=self.label,
            track=track.id,
            position=self.position,
        )

    def get_direction(self, track) -> Direction:
        if self.position < track.length / 2:
            return Direction.START_TO_STOP
        return Direction.STOP_TO_START


def _detector_id():
    res = f"detector.{Detector._index}"
    Detector._index += 1
    return res


@dataclass
class Detector:
    position: float
    label: str = field(default_factory=_detector_id)

    _index = 0

    @staticmethod
    def reset_index():
        Detector._index = 0

    @property
    def id(self):
        return self.label

    def get_waypoint_ref(self):
        return models.WaypointDetector(id=self.label, type="Detector")

    def to_rjs(self, track):
        return models.Detector(
            id=self.label,
            track=track.id,
            position=self.position,
        )
