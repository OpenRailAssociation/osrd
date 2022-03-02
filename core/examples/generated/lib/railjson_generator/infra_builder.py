from dataclasses import dataclass, field
from typing import Mapping, Tuple

from railjson_generator.schema.infra.endpoint import Endpoint
from railjson_generator.schema.infra.infra import Infra
from railjson_generator.schema.infra.link import Link
from railjson_generator.schema.infra.operational_point import OperationalPoint
from railjson_generator.schema.infra.speed_section import SpeedSection
from railjson_generator.schema.infra.switch import Switch
from railjson_generator.schema.infra.track_section import TrackSection
from railjson_generator.utils import generate_routes


@dataclass
class InfraBuilder:
    infra: Infra = field(default_factory=Infra)
    switches_group_map: Mapping[Tuple[int, Endpoint, int], Tuple[Switch, str]] = field(default_factory=dict)

    def add_track_section(self, *args, **kwargs):
        track = TrackSection(index=len(self.infra.track_sections), *args, **kwargs)
        self.infra.track_sections.append(track)
        return track

    def add_switch(self, base, left, right, **kwargs):
        switch = Switch(base, left, right, **kwargs)
        l1 = self.add_link(base, left)
        self.switches_group_map[l1.get_key()] = (switch, "LEFT")
        l2 = self.add_link(base, right)
        self.switches_group_map[l2.get_key()] = (switch, "RIGHT")
        self.infra.switches.append(switch)
        return switch

    def add_link(self, *args, **kwargs):
        link = Link(*args, **kwargs)
        self.infra.links.append(link)
        TrackSection.register_link(link)
        return link

    def add_operational_point(self, *args, **kwargs):
        self.infra.operational_points.append(OperationalPoint(*args, **kwargs))
        return self.infra.operational_points[-1]

    def add_speed_section(self, *args, **kwargs):
        self.infra.speed_sections.append(SpeedSection(*args, **kwargs))
        return self.infra.speed_sections[-1]

    def _auto_gen_buffer_stops(self):
        for track in self.infra.track_sections:
            if track.contains_buffer_stop():
                continue
            if len(track.begin().get_neighbors()) == 0:
                track.add_buffer_stop(position=0)
            if len(track.end().get_neighbors()) == 0:
                track.add_buffer_stop(position=track.length)

    def build(self):
        # Add buffer stops where needed
        self._auto_gen_buffer_stops()

        # Sort track sections waypoints and signals
        for track in self.infra.track_sections:
            track.sort_signals()
            track.sort_waypoints()

        # Generate routes
        generate_routes(self)

        return self.infra
