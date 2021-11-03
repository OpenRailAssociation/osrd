from dataclasses import dataclass, field

from railjson_generator.schema.infra.direction import ApplicableDirection
from railjson_generator.schema.infra.endpoint import TrackEndpoint, Endpoint


@dataclass
class Link:
    begin: TrackEndpoint
    end: TrackEndpoint
    navigability: ApplicableDirection = field(default=ApplicableDirection.BOTH)

    def format(self):
        return {
            "begin": self.begin.format(),
            "end": self.end.format(),
            "navigability": self.navigability.name,
        }

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
