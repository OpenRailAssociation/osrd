from dataclasses import dataclass, field
from typing import Optional

from osrd_schemas import infra
from osrd_schemas.track_node_type import (
    CROSSING,
    DOUBLE_SLIP_SWITCH,
    LINK,
    POINT_SWITCH,
    SINGLE_SLIP_SWITCH,
)

from railjson_generator.schema.infra.direction import Direction
from railjson_generator.schema.infra.endpoint import Endpoint, TrackEndpoint


def _track_node_id():
    # pytype: disable=name-error
    res = f"track_node.{TrackNode._INDEX}"
    TrackNode._INDEX += 1
    # pytype: enable=name-error
    return res


@dataclass
class TrackNodeGroup:
    track_node: "TrackNode"
    group: str


@dataclass
class TrackNode:
    _INDEX = 0
    # overridden by subclasses
    PORT_NAMES = []
    TRACK_NODE_TYPE = ""

    label: str = field(default_factory=_track_node_id)
    delay: float = field(default=0)

    def set_coords(self, x: float, y: float):
        for port_name in self.PORT_NAMES:
            getattr(self, port_name).set_coords(x, y)

    def group(self, group_id: str):
        return TrackNodeGroup(self, group_id)

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
        return infra.TrackNode(
            id=self.label,
            track_node_type=self.TRACK_NODE_TYPE,
            group_change_delay=self.delay,
            ports={port_name: getattr(self, port_name).to_rjs() for port_name in self.PORT_NAMES},
            extensions={"sncf": {"label": self.label}},
        )


@dataclass
class Link(TrackNode):
    A: Optional[TrackEndpoint] = None
    B: Optional[TrackEndpoint] = None

    PORT_NAMES = LINK.ports
    TRACK_NODE_TYPE = LINK.id


@dataclass
class PointSwitch(TrackNode):
    A: Optional[TrackEndpoint] = None
    B1: Optional[TrackEndpoint] = None
    B2: Optional[TrackEndpoint] = None

    PORT_NAMES = POINT_SWITCH.ports
    TRACK_NODE_TYPE = POINT_SWITCH.id


@dataclass
class Crossing(TrackNode):
    A1: Optional[TrackEndpoint] = None
    B1: Optional[TrackEndpoint] = None
    A2: Optional[TrackEndpoint] = None
    B2: Optional[TrackEndpoint] = None

    PORT_NAMES = CROSSING.ports
    TRACK_NODE_TYPE = CROSSING.id


@dataclass
class DoubleSlipSwitch(TrackNode):
    A1: Optional[TrackEndpoint] = None
    A2: Optional[TrackEndpoint] = None
    B1: Optional[TrackEndpoint] = None
    B2: Optional[TrackEndpoint] = None

    PORT_NAMES = DOUBLE_SLIP_SWITCH.ports
    TRACK_NODE_TYPE = DOUBLE_SLIP_SWITCH.id


@dataclass
class SingleSlipSwitch(TrackNode):
    A1: Optional[TrackEndpoint] = None
    A2: Optional[TrackEndpoint] = None
    B1: Optional[TrackEndpoint] = None
    B2: Optional[TrackEndpoint] = None

    PORT_NAMES = SINGLE_SLIP_SWITCH.ports
    TRACK_NODE_TYPE = SINGLE_SLIP_SWITCH.id
