import schemas
from copy import deepcopy
from dataclasses import dataclass, field

from railjson_generator.rjs_static import SIGNAL_EXPR
from railjson_generator.schema.infra.direction import ApplicableDirection, Direction
from railjson_generator.schema.infra.waypoint import Detector


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
        expr = deepcopy(SIGNAL_EXPR)
        expr["arguments"][0]["signal"] = self.label
        if self.direction == ApplicableDirection.NORMAL:
            self.direction = Direction.START_TO_STOP
        elif self.direction == ApplicableDirection.REVERSE:
            self.direction = Direction.STOP_TO_START
        return schemas.Signal(
            id=self.label,
            direction=schemas.Direction[self.direction.name],
            sight_distance=self.sight_distance,
            linked_detector=self.linked_detector.make_rjs_ref(),
            angle=0,
            expr=expr,
            track=track.make_rjs_ref(),
            position=self.position,
            **track.geo_from_track_offset(self.position)
        )
