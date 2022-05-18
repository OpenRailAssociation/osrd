from copy import deepcopy
from dataclasses import dataclass, field
from enum import Enum

from railjson_generator.schema.infra.direction import ApplicableDirection, Direction
from railjson_generator.schema.infra.waypoint import Detector

import infra


def _signal_id():
    res = f"signal.{Signal._INDEX}"
    Signal._INDEX += 1
    return res


@dataclass
class Signal:
    position: float
    direction: Direction
    linked_detector: Detector
    sight_distance: float = field(default=400)
    label: str = field(default_factory=_signal_id)
    installation_type: str = "CARRE"
    side: infra.Side = infra.Side.LEFT
    angle: int = None

    _INDEX = 0

    def __post_init__(self):
        if self.angle is None:
            self.angle = 90 if self.direction == Direction.START_TO_STOP else -90

    def to_rjs(self, track):
        return infra.Signal(
            id=self.label,
            track=track.make_rjs_ref(),
            position=self.position,
            direction=infra.Direction[self.direction.name],
            sight_distance=self.sight_distance,
            linked_detector=self.linked_detector.make_rjs_ref(),
            angle_geo=self.angle,
            angle_sch=self.angle,
            side=self.side,
            installation_type=self.installation_type,
            label=self.label,
        )
