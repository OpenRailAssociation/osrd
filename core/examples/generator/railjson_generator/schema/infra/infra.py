import json
from dataclasses import dataclass, field
from typing import List, Tuple, Dict

from railjson_generator.rjs_static import (ASPECTS, SCRIPT_FUNCTIONS,
                                           SWITCH_TYPES)
from railjson_generator.schema.infra.endpoint import TrackEndpoint
from railjson_generator.schema.infra.operational_point import OperationalPoint
from railjson_generator.schema.infra.route import Route
from railjson_generator.schema.infra.switch import Switch
from railjson_generator.schema.infra.track_section import TrackSection
from railjson_generator.schema.infra.tvd_section import TVDSection


@dataclass
class Infra:
    track_sections: List[TrackSection] = field(default_factory=list)
    switches: List[Switch] = field(default_factory=list)
    links: List[Tuple[TrackEndpoint, TrackEndpoint]] = field(default_factory=list)
    operational_points: List[OperationalPoint] = field(default_factory=list)
    tvd_sections: List[TVDSection] = field(default_factory=list)
    routes: List[Route] = field(default_factory=list)

    VERSION = "1.0"

    def add_tvd_section(self, *args, **kwargs):
        self.tvd_sections.append(TVDSection(*args, **kwargs))
        return self.tvd_sections[-1]

    def add_route(self, *args, **kwargs):
        self.routes.append(Route(*args, **kwargs))
        return self.routes[-1]

    def _format_speed_limits(self):
        res = []
        seen_limits = set()
        for track in self.track_sections:
            for limit in track.speed_limits:
                speed = limit.max_speed
                if speed in seen_limits:
                    continue
                seen_limits.add(speed)
                res.append({
                    "id": str(speed),
                    "is_signalized": True,
                    "speed": speed
                })
        return res

    def format(self):
        return {
            "version": self.VERSION,
            "operational_points": [op.format() for op in self.operational_points],
            "track_sections": [track.format() for track in self.track_sections],
            "switches": [switch.format() for switch in self.switches],
            "track_section_links": [link.format() for link in self.links],
            "tvd_sections": [tvd.format() for tvd in self.tvd_sections],
            "routes": [route.format() for route in self.routes],
            "aspects": ASPECTS,
            "switch_types": SWITCH_TYPES,
            "script_functions": SCRIPT_FUNCTIONS,
            "speed_sections": self._format_speed_limits()
        }

    def save(self, path):
        with open(path, "w") as f:
            json.dump(self.format(), f)
