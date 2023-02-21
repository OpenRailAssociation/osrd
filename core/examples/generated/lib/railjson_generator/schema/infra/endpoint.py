from dataclasses import dataclass
from enum import IntEnum

from osrd_schemas import infra


class Endpoint(IntEnum):
    BEGIN = 0
    END = 1

    def opposite(self):
        if self == Endpoint.BEGIN:
            return Endpoint.END
        return Endpoint.BEGIN


@dataclass
class TrackEndpoint:
    track_section: "TrackSection"
    endpoint: Endpoint

    @property
    def index(self):
        if self.endpoint == Endpoint.BEGIN:
            return self.track_section.index * 2
        return self.track_section.index * 2 + 1

    def get_neighbors(self) -> "TrackEndpoint":
        if self.endpoint == Endpoint.BEGIN:
            return self.track_section.begining_links
        return self.track_section.end_links

    def opposite(self):
        return TrackEndpoint(track_section=self.track_section, endpoint=self.endpoint.opposite())

    def get_coords(self):
        if self.endpoint == Endpoint.BEGIN:
            return self.track_section.coordinates[0] or (0, 0)
        else:
            return self.track_section.coordinates[-1] or (0, 0)

    def set_coords(self, x: float, y: float):
        if self.endpoint == Endpoint.BEGIN:
            self.track_section.coordinates[0] = (x, y)
        else:
            self.track_section.coordinates[-1] = (x, y)

    def to_rjs(self):
        return infra.TrackEndpoint(endpoint=infra.Endpoint[self.endpoint.name], track=self.track_section.id)
