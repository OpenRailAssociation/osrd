from collections import defaultdict
from dataclasses import dataclass, field
from typing import List

from osrd_schemas_auto import models

from railjson_generator.schema.infra.electrification import Electrification
from railjson_generator.schema.infra.neutral_section import NeutralSection
from railjson_generator.schema.infra.operational_point import OperationalPoint
from railjson_generator.schema.infra.level_crossing import LevelCrossing
from railjson_generator.schema.infra.route import Route
from railjson_generator.schema.infra.speed_section import SpeedSection
from railjson_generator.schema.infra.switch import Switch
from railjson_generator.schema.infra.track_section import TrackSection
from railjson_generator.schema.infra.waypoint import BufferStop, Detector


@dataclass
class Infra:
    track_sections: List[TrackSection] = field(default_factory=list)
    switches: List[Switch] = field(default_factory=list)
    operational_points: List[OperationalPoint] = field(default_factory=list)
    level_crossings: List[LevelCrossing] = field(default_factory=list)
    routes: List[Route] = field(default_factory=list)
    speed_sections: List[SpeedSection] = field(default_factory=list)
    electrifications: List[Electrification] = field(default_factory=list)
    neutral_sections: List[NeutralSection] = field(default_factory=list)

    VERSION = "3.5.3"

    def add_route(self, *args, **kwargs):
        self.routes.append(Route(*args, **kwargs))
        return self.routes[-1]

    def to_rjs(self) -> models.RailJson:
        return models.RailJson(
            version=self.VERSION,
            track_sections=[track.to_rjs() for track in self.track_sections],
            switches=[switch.to_rjs() for switch in self.switches],
            routes=[route.to_rjs() for route in self.routes],
            signals=list(self.make_rjs_signals()),
            buffer_stops=list(self.make_rjs_buffer_stops()),
            detectors=list(self.make_rjs_detectors()),
            operational_points=self.make_rjs_operational_points(),
            level_crossings=[lc.to_rjs() for lc in self.level_crossings],
            extended_switch_types=[],
            speed_sections=[
                speed_section.to_rjs() for speed_section in self.speed_sections
            ],
            electrifications=[
                electrification.to_rjs() for electrification in self.electrifications
            ],
            neutral_sections=[
                neutral_section.to_rjs() for neutral_section in self.neutral_sections
            ],
        )

    def save(self, path):
        with open(path, "w") as f:
            print(self.to_rjs().model_dump_json(indent=4, exclude_unset=True), file=f)

    def make_rjs_signals(self):
        for track in self.track_sections:
            for signal in track.signals:
                yield signal.to_rjs(track)

    def make_rjs_buffer_stops(self):
        for track in self.track_sections:
            for waypoint in track.waypoints:
                if isinstance(waypoint, BufferStop):
                    yield waypoint.to_rjs(track)

    def make_rjs_detectors(self):
        for track in self.track_sections:
            for waypoint in track.waypoints:
                if isinstance(waypoint, Detector):
                    yield waypoint.to_rjs(track)

    def make_rjs_operational_points(self):
        parts_per_op = defaultdict(list)
        for track in self.track_sections:
            for op_part in track.operational_points:
                parts_per_op[op_part.operational_point.id].append(op_part.to_rjs(track))
        ops = []
        for op in self.operational_points:
            new_op = models.OperationalPoint(
                id=op.id,
                parts=parts_per_op[op.id],
                weight=op.weight,
                name=op.label,
                uic=op.uic,
                plc=models.Plc(op.plc) if op.plc is not None else None,
                country_code=op.country_code,
                main_code=op.main_code,
                secondary_code=models.SecondaryCode(op.secondary_code)
                if op.secondary_code is not None
                else None,
                is_passenger_station=op.is_passenger_station,
                secondary_name=models.SecondaryName("0"),
            )
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
            self.operational_points,
            self.routes,
            self.speed_sections,
            sum([ts.signals for ts in self.track_sections], []),
            sum([ts.waypoints for ts in self.track_sections], []),
        ]:
            seen_ids = set()
            for instance in instance_list:
                unique_id = getattr(instance, "id", instance.label)
                if unique_id in seen_ids:
                    duplicates.append(instance)
                else:
                    seen_ids.add(unique_id)
        return duplicates
