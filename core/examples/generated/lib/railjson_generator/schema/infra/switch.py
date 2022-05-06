from dataclasses import dataclass, field

from railjson_generator.schema.infra.endpoint import TrackEndpoint

import infra


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

    def to_rjs(self):
        return infra.Switch(
            id=self.label,
            switch_type=infra.ObjectReference(id=self.SWITCH_TYPE, type="SwitchType"),
            group_change_delay=self.delay,
            ports={
                port_name: getattr(self, port_name).to_rjs() 
                for port_name in self.PORT_NAMES
            },
            label=self.label
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
