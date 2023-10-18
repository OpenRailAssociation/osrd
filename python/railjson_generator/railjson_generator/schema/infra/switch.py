from dataclasses import dataclass, field

from osrd_schemas import infra

from railjson_generator.schema.infra.direction import Direction
from railjson_generator.schema.infra.endpoint import Endpoint, TrackEndpoint


def _switch_id():
    res = f"switch.{Switch._INDEX}"
    Switch._INDEX += 1
    return res


@dataclass
class SwitchGroup:
    switch: "Switch"
    group: str


@dataclass
class Switch:
    _INDEX = 0
    # overridden by subclasses
    PORT_NAMES = []
    SWITCH_TYPE = ""

    label: str = field(default_factory=_switch_id)
    delay: float = field(default=0)

    def set_coords(self, x: float, y: float):
        for port_name in self.PORT_NAMES:
            getattr(self, port_name).set_coords(x, y)

    def group(self, group_id: str):
        return SwitchGroup(self, group_id)

    def add_signal_on_port(self, port_name, port_distance, *args, **kwargs):
        port: TrackEndpoint = getattr(self, port_name)
        track_section = port.track_section

        if port.endpoint == Endpoint.BEGIN:
            position = port_distance
            direction = Direction.STOP_TO_START
        else:
            position = track_section.length - port_distance
            direction = Direction.START_TO_STOP

        return track_section.add_signal(
            *args,
            position=position,
            direction=direction,
            **kwargs,
        )

    def add_detector_on_port(self, port_name, port_distance, *args, **kwargs):
        port: TrackEndpoint = getattr(self, port_name)
        track_section = port.track_section

        if port.endpoint == Endpoint.BEGIN:
            # STOP_TO_START
            position = port_distance
        else:
            # START_TO_STOP
            position = track_section.length - port_distance

        return track_section.add_detector(*args, position=position, **kwargs)

    def to_rjs(self):
        return infra.Switch(
            id=self.label,
            switch_type=self.SWITCH_TYPE,
            group_change_delay=self.delay,
            ports={port_name: getattr(self, port_name).to_rjs() for port_name in self.PORT_NAMES},
            extensions={"sncf": {"label": self.label}},
        )


@dataclass
class Link(Switch):
    a: TrackEndpoint = None
    b: TrackEndpoint = None

    PORT_NAMES = ["a", "b"]
    SWITCH_TYPE = "link"


@dataclass
class PointSwitch(Switch):
    a: TrackEndpoint = None
    b_1: TrackEndpoint = None
    b_2: TrackEndpoint = None

    PORT_NAMES = ["a", "b_1", "b_2"]
    SWITCH_TYPE = "point_switch"


@dataclass
class Crossing(Switch):
    a_1: TrackEndpoint = None
    b_1: TrackEndpoint = None
    a_2: TrackEndpoint = None
    b_2: TrackEndpoint = None

    PORT_NAMES = ["a_1", "b_1", "a_2", "b_2"]
    SWITCH_TYPE = "crossing"


@dataclass
class DoubleSlipSwitch(Switch):
    a_1: TrackEndpoint = None
    a_2: TrackEndpoint = None
    b_1: TrackEndpoint = None
    b_2: TrackEndpoint = None

    PORT_NAMES = ["a_1", "a_2", "b_1", "b_2"]
    SWITCH_TYPE = "double_slip_switch"


@dataclass
class SingleSlipSwitch(Switch):
    a_1: TrackEndpoint = None
    a_2: TrackEndpoint = None
    b_1: TrackEndpoint = None
    b_2: TrackEndpoint = None

    PORT_NAMES = ["a_1", "a_2", "b_1", "b_2"]
    SWITCH_TYPE = "single_slip_switch"
