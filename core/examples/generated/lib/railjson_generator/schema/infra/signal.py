from copy import deepcopy
from dataclasses import dataclass, field

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

    _INDEX = 0

    def to_rjs(self, track):
        return infra.Signal(
            id=self.label,
            track=track.make_rjs_ref(),
            position=self.position,
            direction=infra.Direction[self.direction.name],
            sight_distance=self.sight_distance,
            linked_detector=self.linked_detector.make_rjs_ref(),
            angle_geo=0,
            angle_sch=0,
            side="CENTER",
        )
