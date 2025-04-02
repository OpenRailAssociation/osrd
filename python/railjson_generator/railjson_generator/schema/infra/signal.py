from dataclasses import dataclass, field
from typing import Dict, List

from osrd_schemas import infra

from railjson_generator.schema.infra.direction import Direction


def _signal_id():
    res = f"signal.{Signal._index}"
    Signal._index += 1
    return res


@dataclass
class SignalConditionalParameters:
    on_route: str
    parameters: Dict[str, str]

    def to_rjs(self):
        return infra.ConditionalParameter(
            on_route=self.on_route,
            parameters=self.parameters,
        )


@dataclass
class LogicalSignal:
    signaling_system: str
    next_signaling_systems: List[str] = field(default_factory=list)
    settings: Dict[str, str] = field(default_factory=dict)
    default_parameters: Dict[str, str] = field(default_factory=dict)
    conditional_parameters: List[SignalConditionalParameters] = field(
        default_factory=list
    )

    def to_rjs(self):
        if self.signaling_system == "BAL":
            self.default_parameters = (
                {"jaune_cli": "false"}
                if self.default_parameters == {}
                else self.default_parameters
            )

        return infra.LogicalSignal(
            signaling_system=self.signaling_system,
            next_signaling_systems=self.next_signaling_systems,
            settings=self.settings,
            default_parameters=self.default_parameters,
            conditional_parameters=[
                param.to_rjs() for param in self.conditional_parameters
            ],
        )


@dataclass
class Signal:
    position: float
    direction: Direction
    is_route_delimiter: bool

    # relevant for simulation behavior
    sight_distance: float = field(default=400)
    logical_signals: List[LogicalSignal] = field(default_factory=list)

    label: str = field(default_factory=_signal_id)
    installation_type: str = "CARRE"
    side: infra.Side = infra.Side.LEFT

    _index = 0

    @staticmethod
    def reset_index():
        Signal._index = 0

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
            extensions={  # pyright: ignore[reportCallIssue] - 'extensions' exists but is registered through 'register_extension'
                "sncf": {
                    "label": self.label,
                    "side": self.side,
                    "kp": "",
                }
            },
        )
