from dataclasses import dataclass
from enum import IntEnum


class Endpoint(IntEnum):
    BEGIN = 0
    END = 1


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

    def format(self):
        return {
            "endpoint": self.endpoint.name,
            "section": self.track_section.label,
        }

    def set_coords(self, x: float, y: float):
        if self.endpoint == Endpoint.BEGIN:
            self.track_section.begin_coordinates = (x, y)
        else:
            self.track_section.end_coordinates = (x, y)
