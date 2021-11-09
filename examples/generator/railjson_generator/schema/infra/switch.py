from dataclasses import dataclass, field

from railjson_generator.schema.infra.endpoint import TrackEndpoint


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

    def format(self):
        return {
            "id": self.label,
            "switch_type": "classic_switch",
            "group_change_delay": self.delay,
            "ports": {
                port: getattr(self, port).format() for port in ("base", "left", "right")
            },
        }
