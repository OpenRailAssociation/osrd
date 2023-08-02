from dataclasses import dataclass, field

from osrd_schemas import infra

from railjson_generator.schema.infra.endpoint import TrackEndpoint


def _link_id():
    res = f"link.{Link._INDEX}"
    Link._INDEX += 1
    return res


@dataclass
class Link:
    begin: TrackEndpoint
    end: TrackEndpoint
    label: str = field(default_factory=_link_id)

    _INDEX = 0

    def set_coords(self, x: float, y: float):
        for endpoint in (self.begin, self.end):
            endpoint.set_coords(x, y)

    def to_rjs(self):
        return infra.TrackSectionLink(
            id=self.label,
            src=self.begin.to_rjs(),
            dst=self.end.to_rjs(),
        )
