from collections import defaultdict
from dataclasses import dataclass, field
from typing import List

from railjson_generator.rjs_static import SWITCH_TYPES
from railjson_generator.schema.infra.catenary import Catenary
from railjson_generator.schema.infra.link import Link
from railjson_generator.schema.infra.operational_point import OperationalPoint
from railjson_generator.schema.infra.route import Route
from railjson_generator.schema.infra.speed_section import SpeedSection
from railjson_generator.schema.infra.switch import Switch
from railjson_generator.schema.infra.track_section import TrackSection

from osrd_schemas import infra


@dataclass
class Infra:
    track_sections: List[TrackSection] = field(default_factory=list)
    switches: List[Switch] = field(default_factory=list)
    links: List[Link] = field(default_factory=list)
    operational_points: List[OperationalPoint] = field(default_factory=list)
    routes: List[Route] = field(default_factory=list)
    speed_sections: List[SpeedSection] = field(default_factory=list)
    catenaries: List[Catenary] = field(default_factory=list)

    VERSION = "3.1.0"

    def add_route(self, *args, **kwargs):
        self.routes.append(Route(*args, **kwargs))
        return self.routes[-1]

    def to_rjs(self) -> infra.RailJsonInfra:
        return infra.RailJsonInfra(
            version=self.VERSION,
            track_sections=[track.to_rjs() for track in self.track_sections],
            switches=[switch.to_rjs() for switch in self.switches],
            track_section_links=[link.to_rjs() for link in self.links],
            routes=[route.to_rjs() for route in self.routes],
            signals=self.make_rjs_signals(),
            buffer_stops=self.make_rjs_buffer_stops(),
            detectors=self.make_rjs_detectors(),
            operational_points=self.make_rjs_operational_points(),
            switch_types=SWITCH_TYPES,
            speed_sections=[speed_section.to_rjs() for speed_section in self.speed_sections],
            catenaries=[catenary.to_rjs() for catenary in self.catenaries],
        )

    def save(self, path):
        with open(path, "w") as f:
            print(self.to_rjs().json(indent=2), file=f)

    def make_rjs_signals(self):
        for track in self.track_sections:
            for signal in track.signals:
                yield signal.to_rjs(track)

    def make_rjs_buffer_stops(self):
        for track in self.track_sections:
            for waypoint in track.waypoints:
                if waypoint.waypoint_type == "buffer_stop":
                    yield waypoint.to_rjs(track)

    def make_rjs_detectors(self):
        for track in self.track_sections:
            for waypoint in track.waypoints:
                if waypoint.waypoint_type == "detector":
                    yield waypoint.to_rjs(track)

    def make_rjs_operational_points(self):
        parts_per_op = defaultdict(list)
        for track in self.track_sections:
            for op_part in track.operational_points:
                parts_per_op[op_part.operational_point.label].append(op_part.to_rjs(track))
        ops = []
        for op in self.operational_points:
            new_op = infra.OperationalPoint(
                id=op.label,
                parts=parts_per_op[op.label],
                name=op.label,
            )
            new_op.extensions["sncf"] = infra.OperationalPointSncfExtension(
                ci=0, ch="aa", ch_short_label="aa", ch_long_label="0", trigram=op.trigram
            )
            new_op.extensions["identifier"] = infra.OperationalPointIdentifierExtension(uic=0, name=op.label)
            ops.append(new_op)
        return ops

    def find_duplicates(self):
        """
        Checks for duplicates in all objects.
        """
        duplicates = []
        for instance_list in [
            self.track_sections,
            self.switches,
            self.links,
            self.operational_points,
            self.routes,
            self.speed_sections,
            sum([ts.signals for ts in self.track_sections], []),
            sum([ts.waypoints for ts in self.track_sections], []),
        ]:
            seen_ids = set()
            for instance in instance_list:
                if instance.label in seen_ids:
                    duplicates.append(instance)
                else:
                    seen_ids.add(instance.label)
        return duplicates
