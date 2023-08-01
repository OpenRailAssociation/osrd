from dataclasses import dataclass, field
from typing import Iterable, Optional

from .schema.infra.endpoint import TrackEndpoint
from .schema.infra.infra import Infra
from .schema.infra.link import Link
from .schema.infra.neutral_section import NeutralSection
from .schema.infra.operational_point import OperationalPoint
from .schema.infra.route import Route
from .schema.infra.speed_section import SpeedSection
from .schema.infra.switch import (
    CrossSwitch,
    DoubleCrossSwitch,
    PointSwitch,
    SwitchGroup,
)
from .schema.infra.track_section import TrackSection
from .utils import generate_routes


def _check_connections(endpoint, connections):
    links = []
    switches = []
    for connected_endpoint, switch_group in connections:
        if connected_endpoint == endpoint:
            raise RuntimeError("endpoint connected to itself")
        category = links if switch_group is None else switches
        category.append(switch_group)

    if not links and not switches:
        return
    if links and switches:
        raise RuntimeError("endpoint connected to both links and switches")
    if links and not switches:
        if len(links) != 1:
            raise RuntimeError("endpoint connected to multiple track links")
        return

    switch = switches[0].switch
    groups = {switches[0].group}
    for switch_group in switches[1:]:
        if switch_group.switch != switch:
            raise RuntimeError("endpoint connected to multiple switches")
        if switch_group.group in groups:
            raise RuntimeError("ambiguous endpoint connection")
        groups.add(switch_group.group)


def _register_connection(endpoint_a: TrackEndpoint, endpoint_b: TrackEndpoint, switch_group: Optional[SwitchGroup]):
    """Connect two track endpoints together"""
    a_neighbors = endpoint_a.get_neighbors()
    b_neighbors = endpoint_b.get_neighbors()
    a_neighbors.append((endpoint_b, switch_group))
    b_neighbors.append((endpoint_a, switch_group))
    _check_connections(endpoint_a, a_neighbors)
    _check_connections(endpoint_b, b_neighbors)


@dataclass
class InfraBuilder:
    """
    @infra: the infra object used.
    """

    infra: Infra = field(default_factory=Infra)

    def add_track_section(self, *args, **kwargs):
        track = TrackSection(index=len(self.infra.track_sections), *args, **kwargs)
        self.infra.track_sections.append(track)
        return track

    def add_point_switch(self, base: TrackEndpoint, left: TrackEndpoint, right: TrackEndpoint, **kwargs):
        switch = PointSwitch(base=base, left=left, right=right, **kwargs)
        _register_connection(base, left, switch.group("LEFT"))
        _register_connection(base, right, switch.group("RIGHT"))
        self.infra.switches.append(switch)
        return switch

    def add_cross_switch(
        self, north: TrackEndpoint, south: TrackEndpoint, east: TrackEndpoint, west: TrackEndpoint, **kwargs
    ):
        switch = CrossSwitch(north=north, south=south, east=east, west=west, **kwargs)
        _register_connection(north, south, switch.group("static"))
        _register_connection(east, west, switch.group("static"))
        self.infra.switches.append(switch)
        return switch

    def add_double_cross_switch(
        self, north_1: TrackEndpoint, north_2: TrackEndpoint, south_1: TrackEndpoint, south_2: TrackEndpoint, **kwargs
    ):
        switch = DoubleCrossSwitch(north_1=north_1, north_2=north_2, south_1=south_1, south_2=south_2, **kwargs)
        for (src, dst), group_name in [
            ((north_1, south_1), "N1_S1"),
            ((north_1, south_2), "N1_S2"),
            ((north_2, south_1), "N2_S1"),
            ((north_2, south_2), "N2_S2"),
        ]:
            _register_connection(src, dst, switch.group(group_name))
        self.infra.switches.append(switch)
        return switch

    def add_link(self, *args, **kwargs):
        link = Link(*args, **kwargs)
        self.infra.links.append(link)
        _register_connection(link.begin, link.end, None)
        return link

    def add_operational_point(self, *args, **kwargs):
        self.infra.operational_points.append(OperationalPoint(*args, **kwargs))
        return self.infra.operational_points[-1]

    def add_speed_section(self, *args, **kwargs):
        self.infra.speed_sections.append(SpeedSection(*args, **kwargs))
        return self.infra.speed_sections[-1]

    def add_neutral_section(self, *args, **kwargs):
        self.infra.neutral_sections.append(NeutralSection(*args, **kwargs))
        return self.infra.neutral_sections[-1]

    def _auto_gen_buffer_stops(self):
        for track in self.infra.track_sections:
            if track.contains_buffer_stop():
                continue
            if len(track.begin().get_neighbors()) == 0:
                track.add_buffer_stop(position=0)
            if len(track.end().get_neighbors()) == 0:
                track.add_buffer_stop(position=track.length)

    def register_route(self, route: Route):
        """Adds a route to the infrastructure"""
        self.infra.routes.append(route)

    def _prepare_infra(self):
        # Add buffer stops where needed
        self._auto_gen_buffer_stops()

        # Sort track sections waypoints and signals
        for track in self.infra.track_sections:
            track.sort_signals()
            track.sort_waypoints()

    def generate_routes(self, progressive_release=True) -> Iterable[Route]:
        """
        Generate routes using signaling and detectors.
        Route need to be manually registered using register_route.
        Buffer stops will be added where missing.

        Keyword arguments:
        progressive_release -- whether to add release points at all intermediate detectors
        """
        self._prepare_infra()
        return generate_routes(self.infra, progressive_release)

    def build(self, progressive_release=True):
        """Build the RailJSON infrastructure. Routes will be generated if missing."""
        self._prepare_infra()

        # Generate routes
        if not self.infra.routes:
            for route in generate_routes(self.infra, progressive_release):
                self.register_route(route)

        duplicates = self.infra.find_duplicates()
        if duplicates:
            print("Duplicates were found:")
            for duplicate in duplicates:
                print(duplicate.__class__.__name__, duplicate.label)
            raise ValueError("Duplicates found")

        return self.infra
