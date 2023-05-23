from dataclasses import dataclass, field
from typing import Mapping, Tuple, Type

from .schema.infra.dead_section import DeadSection
from .schema.infra.endpoint import Endpoint, TrackEndpoint
from .schema.infra.infra import Infra
from .schema.infra.link import Link
from .schema.infra.operational_point import OperationalPoint
from .schema.infra.speed_section import SpeedSection
from .schema.infra.switch import CrossSwitch, DoubleCrossSwitch, PointSwitch, Switch
from .schema.infra.track_section import TrackSection
from .utils import generate_routes


@dataclass
class InfraBuilder:
    """
    @infra: the infra object used.
    @switches_group_map: a mapping from a link between two track end points, to a switch group.
        A swicth group is an available switch position.
    """

    infra: Infra = field(default_factory=Infra)
    switches_group_map: Mapping[Tuple[int, Endpoint, int, Endpoint], Tuple[Type[Switch], str]] = field(
        default_factory=dict
    )

    def add_track_section(self, *args, **kwargs):
        track = TrackSection(index=len(self.infra.track_sections), *args, **kwargs)
        self.infra.track_sections.append(track)
        return track

    def add_point_switch(
        self,
        base: TrackEndpoint,
        left: TrackEndpoint,
        right: TrackEndpoint,
        signal_on_ports: Mapping[str, Tuple[str, str]] = None,
        **kwargs
    ):
        """
        Adds a switch as well as all links between concerned track sections.
        """
        switch = PointSwitch(base=base, left=left, right=right, **kwargs)
        l1 = self.add_link(base, left)
        self.switches_group_map[l1.get_key()] = (switch, "LEFT")
        l2 = self.add_link(base, right)
        self.switches_group_map[l2.get_key()] = (switch, "RIGHT")
        self.infra.switches.append(switch)
        if signal_on_ports is not None:
            switch.add_signals_detectors_to_ports(signal_on_ports)
        return switch

    def add_cross_switch(
        self,
        north: TrackEndpoint,
        south: TrackEndpoint,
        east: TrackEndpoint,
        west: TrackEndpoint,
        signal_on_ports: Mapping[str, Tuple[str, str]] = None,
        **kwargs
    ):
        """
        Adds a switch as well as all links between concerned track sections.
        """
        switch = CrossSwitch(north=north, south=south, east=east, west=west, **kwargs)
        l1 = self.add_link(north, south)
        self.switches_group_map[l1.get_key()] = (switch, "static")
        l2 = self.add_link(east, west)
        self.switches_group_map[l2.get_key()] = (switch, "static")
        self.infra.switches.append(switch)
        if signal_on_ports is not None:
            switch.add_signals_detectors_to_ports(signal_on_ports)
        return switch

    def add_double_cross_switch(
        self,
        north_1: TrackEndpoint,
        north_2: TrackEndpoint,
        south_1: TrackEndpoint,
        south_2: TrackEndpoint,
        signal_on_ports: Mapping[str, Tuple[str, str]] = None,
        **kwargs
    ):
        """
        Adds a switch as well as all links between concerned track sections.
        """
        switch = DoubleCrossSwitch(north_1=north_1, north_2=north_2, south_1=south_1, south_2=south_2, **kwargs)
        for (src, dst), group_name in [
            ((north_1, south_1), "N1_S1"),
            ((north_1, south_2), "N1_S2"),
            ((north_2, south_1), "N2_S1"),
            ((north_2, south_2), "N2_S2"),
        ]:
            link = self.add_link(src, dst)
            self.switches_group_map[link.get_key()] = (switch, group_name)
        self.infra.switches.append(switch)
        if signal_on_ports is not None:
            switch.add_signals_detectors_to_ports(signal_on_ports)
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

    def add_dead_section(self, *args, **kwargs):
        self.infra.dead_sections.append(DeadSection(*args, **kwargs))
        return self.infra.dead_sections[-1]

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

        duplicates = self.infra.find_duplicates()
        if duplicates:
            print("Duplicates were found:")
            for duplicate in duplicates:
                print(duplicate.__class__.__name__, duplicate.label)
            raise ValueError("Duplicates found")

        return self.infra
