import schemas
from dataclasses import dataclass, field

from railjson_generator.schema.infra.endpoint import TrackEndpoint
from railjson_generator.schema.infra.placeholders import placeholder_geo_points


def _switch_id():
    res = f"switch.{Switch._INDEX}"
    Switch._INDEX += 1
    return res


@dataclass
class Switch:
    base: TrackEndpoint
    left: TrackEndpoint
    right: TrackEndpoint
    label: str = field(default_factory=_switch_id)
    delay: float = field(default=0)

    _INDEX = 0

    def set_coords(self, x: float, y: float):
        for endpoint in (self.base, self.left, self.right):
            endpoint.set_coords(x, y)

    def to_rjs(self):
        return schemas.Switch(
            id=self.label,
            switch_type=schemas.ObjectReference(id="classic_switch", type="switch_type"),
            group_change_delay=self.delay,
            ports={port: getattr(self, port).to_rjs() for port in ("base", "left", "right")},
            **placeholder_geo_points()
        )
