from copy import deepcopy
from dataclasses import dataclass, field
from typing import Dict

from railjson_generator.rjs_static import SIGNAL_EXPR
from railjson_generator.schema.infra.direction import ApplicableDirection
from railjson_generator.schema.infra.waypoint import Detector


def _signal_id():
    res = f"signal.{Signal._INDEX}"
    Signal._INDEX += 1
    return res


@dataclass
class Signal:
    position: float
    applicable_direction: ApplicableDirection
    linked_detector: Detector
    sight_distance: float = field(default=400)
    label: str = field(default_factory=_signal_id)

    _INDEX = 0

    def format(self) -> Dict:
        expr = deepcopy(SIGNAL_EXPR)
        expr["arguments"][0]["signal"] = self.label

        return {
            "id": self.label,
            "linked_detector": self.linked_detector.label,
            "applicable_direction": self.applicable_direction.name,
            "position": self.position,
            "sight_distance": self.sight_distance,
            "expr": expr,
        }
