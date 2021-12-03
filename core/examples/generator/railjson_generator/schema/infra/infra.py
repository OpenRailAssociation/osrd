import json
from collections import defaultdict

import schemas
from dataclasses import dataclass, field
from typing import List, Tuple, Dict

from railjson_generator.rjs_static import (ASPECTS, SCRIPT_FUNCTIONS,
                                           SWITCH_TYPES)
from railjson_generator.schema.infra.link import Link
from railjson_generator.schema.infra.operational_point import OperationalPoint
from railjson_generator.schema.infra.route import Route
from railjson_generator.schema.infra.switch import Switch
from railjson_generator.schema.infra.track_section import TrackSection
from railjson_generator.schema.infra.tvd_section import TVDSection


@dataclass
class Infra:
    track_sections: List[TrackSection] = field(default_factory=list)
    switches: List[Switch] = field(default_factory=list)
    links: List[Link] = field(default_factory=list)
    operational_points: List[OperationalPoint] = field(default_factory=list)
    tvd_sections: List[TVDSection] = field(default_factory=list)
    routes: List[Route] = field(default_factory=list)

    VERSION = "2.0.0"

    def add_tvd_section(self, *args, **kwargs):
        self.tvd_sections.append(TVDSection(*args, **kwargs))
        return self.tvd_sections[-1]

    def add_route(self, *args, **kwargs):
        self.routes.append(Route(*args, **kwargs))
        return self.routes[-1]

    def to_rjs(self) -> schemas.RailJsonInfra:
        return schemas.RailJsonInfra(
            version=self.VERSION,
            track_sections=[track.to_rjs() for track in self.track_sections],
            switches=[switch.to_rjs() for switch in self.switches],
            track_section_links=[link.to_rjs() for link in self.links],
            tvd_sections=[tvd.to_rjs() for tvd in self.tvd_sections],
            routes=[route.to_rjs() for route in self.routes],
            signals=self.make_rjs_signals(),
            buffer_stops=self.make_rjs_buffer_stops(),
            detectors=self.make_rjs_detectors(),
            operational_points=self.make_rjs_operational_points(),
            aspects=ASPECTS,
            switch_types=SWITCH_TYPES,
            script_functions=SCRIPT_FUNCTIONS,
        )
    
    def save(self, path):
        with open(path, "w") as f:
            print(self.to_rjs().json(), file=f)

    def make_rjs_signals(self):
        for track in self.track_sections:
            for signal in track.signals:
                yield signal.to_rjs(track.make_rjs_ref())

    def make_rjs_buffer_stops(self):
        for track in self.track_sections:
            for waypoint in track.waypoints:
                if waypoint.waypoint_type == "buffer_stop":
                    yield waypoint.to_rjs(track.make_rjs_ref())

    def make_rjs_detectors(self):
        for track in self.track_sections:
            for waypoint in track.waypoints:
                if waypoint.waypoint_type == "detector":
                    yield waypoint.to_rjs(track.make_rjs_ref())

    def make_rjs_operational_points(self):
        parts_per_op = defaultdict(list)
        for track in self.track_sections:
            ref = track.make_rjs_ref()
            for op_part in track.operational_points:
                parts_per_op[op_part.operarational_point.label].append(op_part.to_rjs(ref))
        for op in self.operational_points:
            yield schemas.OperationalPoint(
                id=op.label,
                parts=parts_per_op[op.label],
                ci=0,
                ch="aa",
                name="placeholder name"
            )
