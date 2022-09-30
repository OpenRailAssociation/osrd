from dataclasses import dataclass, field
from typing import Mapping, Tuple

from railjson_generator.schema.infra.direction import Direction
from railjson_generator.schema.infra.endpoint import Endpoint, TrackEndpoint

import infra

# Reference distances, in meters
SIGNAL_TO_SWITCH = 200
DETECTOR_TO_SWITCH = 180


def _switch_id():
    res = f"switch.{Switch._INDEX}"
    Switch._INDEX += 1
    return res


@dataclass
class Switch:
    _INDEX = 0
    # overriden by subclasses
    PORT_NAMES = []
    SWITCH_TYPE = ""

    label: str = field(default_factory=_switch_id)
    delay: float = field(default=0)

    def set_coords(self, x: float, y: float):
        for port_name in self.PORT_NAMES:
            getattr(self, port_name).set_coords(x, y)

    def add_signals_detectors_to_ports(self, ports: Mapping[str, Tuple[str, str]]):
        """Add signals and detectors to given ports.
        Args:
            ports: A dictionary of port names to (detector_label, signal_label) pairs.
        """
        for port_name in self.PORT_NAMES:
            if port_name not in ports:
                continue
            detector_label, signal_label = ports[port_name]
            port: TrackEndpoint = getattr(self, port_name)
            track_section = port.track_section

            if port.endpoint == Endpoint.BEGIN:
                detector_position = DETECTOR_TO_SWITCH
                signal_position = SIGNAL_TO_SWITCH
                signal_direction = Direction.STOP_TO_START
            else:
                detector_position = track_section.length - DETECTOR_TO_SWITCH
                signal_position = track_section.length - SIGNAL_TO_SWITCH
                signal_direction = Direction.START_TO_STOP

            detector = track_section.add_detector(label=detector_label, position=detector_position)
            track_section.add_signal(
                label=signal_label,
                position=signal_position,
                direction=signal_direction,
                linked_detector=detector,
            )

    def to_rjs(self):
        return infra.Switch(
            id=self.label,
            switch_type=self.SWITCH_TYPE,
            group_change_delay=self.delay,
            ports={port_name: getattr(self, port_name).to_rjs() for port_name in self.PORT_NAMES},
            extensions={"sncf": {"label": self.label}},
        )


@dataclass
class PointSwitch(Switch):
    base: TrackEndpoint = None
    left: TrackEndpoint = None
    right: TrackEndpoint = None

    PORT_NAMES = ["base", "left", "right"]
    SWITCH_TYPE = "point"


@dataclass
class CrossSwitch(Switch):
    north: TrackEndpoint = None
    south: TrackEndpoint = None
    east: TrackEndpoint = None
    west: TrackEndpoint = None

    PORT_NAMES = ["north", "south", "east", "west"]
    SWITCH_TYPE = "cross"


@dataclass
class DoubleCrossSwitch(Switch):
    north_1: TrackEndpoint = None
    north_2: TrackEndpoint = None
    south_1: TrackEndpoint = None
    south_2: TrackEndpoint = None

    PORT_NAMES = ["north_1", "north_2", "south_1", "south_2"]
    SWITCH_TYPE = "double_cross"
