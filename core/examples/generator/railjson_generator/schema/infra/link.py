import schemas
from dataclasses import dataclass, field

from railjson_generator.schema.infra.direction import ApplicableDirection
from railjson_generator.schema.infra.endpoint import TrackEndpoint


def _link_id():
    res = f"link.{Link._INDEX}"
    Link._INDEX += 1
    return res


@dataclass
class Link:
    begin: TrackEndpoint
    end: TrackEndpoint
    navigability: ApplicableDirection = field(default=ApplicableDirection.BOTH)
    label: str = field(default_factory=_link_id)

    _INDEX = 0

    def get_key(self):
        return Link.format_link_key(self.begin, self.end)

    def set_coords(self, x: float, y: float):
        for endpoint in (self.begin, self.end):
            endpoint.set_coords(x, y)

    @staticmethod
    def format_link_key(a: TrackEndpoint, b: TrackEndpoint):
        if a.track_section.index < b.track_section.index:
            return a.track_section.index, a.endpoint, b.track_section.index, b.endpoint
        return b.track_section.index, b.endpoint, a.track_section.index, a.endpoint

    def to_rjs(self):
        return schemas.TrackSectionLink(
            id=self.label,
            src=self.begin.to_rjs(),
            dst=self.end.to_rjs(),
            navigability=schemas.ApplicableDirections[self.navigability.name]
        )
