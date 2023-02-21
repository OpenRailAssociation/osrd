from dataclasses import dataclass, field

from typing import List, Dict
from railjson_generator.schema.infra.direction import Direction
from railjson_generator.schema.infra.waypoint import Detector

from osrd_schemas import infra


def _signal_id():
    res = f"signal.{Signal._INDEX}"
    Signal._INDEX += 1
    return res


@dataclass
class LogicalSignal:
    signaling_system: str
    next_signaling_systems: List[str] = field(default_factory=list)
    settings: Dict[str, str] = field(default_factory=dict)

    def to_rjs(self):
        return infra.LogicalSignal(
            signaling_system=self.signaling_system,
            next_signaling_systems=self.next_signaling_systems,
            settings=self.settings,
        )


@dataclass
class Signal:
    position: float
    direction: Direction
    linked_detector: Detector

    # relevant for simulation behavior
    sight_distance: float = field(default=400)
    logical_signals: List[LogicalSignal] = field(default_factory=list)

    label: str = field(default_factory=_signal_id)
    installation_type: str = "CARRE"
    side: infra.Side = infra.Side.LEFT
    angle: int = None

    _INDEX = 0

    def __post_init__(self):
        if self.angle is None:
            self.angle = 90 if self.direction == Direction.START_TO_STOP else -90

    def add_logical_signal(self, *args, **kwargs) -> LogicalSignal:
        signal = LogicalSignal(*args, **kwargs)
        self.logical_signals.append(signal)
        return signal

    def to_rjs(self, track):
        return infra.Signal(
            id=self.label,
            track=track.id,
            position=self.position,
            direction=infra.Direction[self.direction.name],
            sight_distance=self.sight_distance,
            logical_signals=[sig.to_rjs() for sig in self.logical_signals],
            linked_detector=self.linked_detector.id,
            extensions={
                "sncf": {
                    "angle_geo": self.angle,
                    "angle_sch": self.angle,
                    "aspects": [],
                    "comment": "",
                    "default_aspect": "",
                    "installation_type": self.installation_type,
                    "is_in_service": False,
                    "is_lightable": False,
                    "is_operational": False,
                    "label": self.label,
                    "side": self.side,
                    "support_type": "",
                    "type_code": "",
                    "value": "",
                }
            },
        )
