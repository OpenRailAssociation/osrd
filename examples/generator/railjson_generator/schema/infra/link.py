from dataclasses import dataclass, field

from railjson_generator.schema.infra.direction import ApplicableDirection
from railjson_generator.schema.infra.endpoint import TrackEndpoint


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
        return Link.format_link_key(self.begin.track_section, self.end.track_section)

    def set_coords(self, x: float, y: float):
        for endpoint in (self.begin, self.end):
            endpoint.set_coords(x, y)

    @staticmethod
    def format_link_key(tiv_a: "TrackSection", tiv_b: "TrackSection"):
        if tiv_a.index < tiv_b.index:
            return (tiv_a.index, tiv_b.index)
        return (tiv_b.index, tiv_a.index)
