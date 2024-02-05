from dataclasses import dataclass, field
from typing import Iterable, Optional, Tuple

from .schema.infra.endpoint import TrackEndpoint
from .schema.infra.infra import Infra
from .schema.infra.neutral_section import NeutralSection
from .schema.infra.operational_point import OperationalPoint
from .schema.infra.route import Route
from .schema.infra.speed_section import SpeedSection
from .schema.infra.track_node import (
    Crossing,
    DoubleSlipSwitch,
    Link,
    PointSwitch,
    TrackNodeGroup,
)
from .schema.infra.track_section import TrackSection
from .utils import generate_routes


def _check_connections(endpoint: TrackEndpoint, connections: Iterable[Tuple[TrackEndpoint, Optional[TrackNodeGroup]]]):
    track_nodes = []
    for connected_endpoint, track_node_group in connections:
        if connected_endpoint == endpoint:
            raise RuntimeError("endpoint connected to itself")
        track_nodes.append(track_node_group)

    if not track_nodes:
        return

    track_node = track_nodes[0].track_node
    groups = {track_nodes[0].group}
    for track_node_group in track_nodes[1:]:
        if track_node_group.track_node != track_node:
            raise RuntimeError("endpoint connected to multiple track_nodes")
        if track_node_group.group in groups:
            raise RuntimeError("ambiguous endpoint connection")
        groups.add(track_node_group.group)


def _register_connection(endpoint_a: TrackEndpoint, endpoint_b: TrackEndpoint, track_node_group: TrackNodeGroup):
    """Connect two track endpoints together"""
    a_neighbors = endpoint_a.get_neighbors()
    b_neighbors = endpoint_b.get_neighbors()
    a_neighbors.append((endpoint_b, track_node_group))
    b_neighbors.append((endpoint_a, track_node_group))
    _check_connections(endpoint_a, a_neighbors)
    _check_connections(endpoint_b, b_neighbors)


@dataclass
class InfraBuilder:
    """
    @infra: the infra object used.
    """

    infra: Infra = field(default_factory=Infra)

    def add_track_section(self, *args, **kwargs) -> TrackSection:
        """Build a track section, add it to the infra, and return it."""
        track = TrackSection(index=len(self.infra.track_sections), *args, **kwargs)
        self.infra.track_sections.append(track)
        return track

    def add_point_switch(self, base: TrackEndpoint, left: TrackEndpoint, right: TrackEndpoint, **kwargs) -> PointSwitch:
        """Build a point switch, add it to the infra, and return it."""
        track_node = PointSwitch(A=base, B1=left, B2=right, **kwargs)
        _register_connection(base, left, track_node.group("A_B1"))
        _register_connection(base, right, track_node.group("A_B2"))
        self.infra.track_nodes.append(track_node)
        return track_node

    def add_crossing(
        self, north: TrackEndpoint, south: TrackEndpoint, east: TrackEndpoint, west: TrackEndpoint, **kwargs
    ) -> Crossing:
        """Build a crossing, add it to the infra, and return it."""
        track_node = Crossing(A1=north, B1=south, B2=east, A2=west, **kwargs)
        _register_connection(north, south, track_node.group("STATIC"))
        _register_connection(east, west, track_node.group("STATIC"))
        self.infra.track_nodes.append(track_node)
        return track_node

    def add_double_slip_switch(
        self, north_1: TrackEndpoint, north_2: TrackEndpoint, south_1: TrackEndpoint, south_2: TrackEndpoint, **kwargs
    ) -> DoubleSlipSwitch:
        """Build a double slip switch, add it to the infra, and return it."""
        track_node = DoubleSlipSwitch(A1=north_1, A2=north_2, B1=south_1, B2=south_2, **kwargs)
        for (src, dst), group_name in [
            ((north_1, south_1), "A1_B1"),
            ((north_1, south_2), "A1_B2"),
            ((north_2, south_1), "A2_B1"),
            ((north_2, south_2), "A2_B2"),
        ]:
            _register_connection(src, dst, track_node.group(group_name))
        self.infra.track_nodes.append(track_node)
        return track_node

    def add_link(self, source: TrackEndpoint, destination: TrackEndpoint, **kwargs) -> Link:
        """Build a link, add it to the infra, and return it."""
        track_node = Link(A=source, B=destination, **kwargs)
        self.infra.track_nodes.append(track_node)
        _register_connection(source, destination, track_node.group("STATIC"))
        return track_node

    def add_operational_point(self, *args, **kwargs) -> OperationalPoint:
        """Build an operational point, add it to the infra, and return it."""
        self.infra.operational_points.append(OperationalPoint(*args, **kwargs))
        return self.infra.operational_points[-1]

    def add_speed_section(self, *args, **kwargs) -> SpeedSection:
        """Build a speed section, add it to the infra, and return it."""
        self.infra.speed_sections.append(SpeedSection(*args, **kwargs))
        return self.infra.speed_sections[-1]

    def add_neutral_section(self, *args, **kwargs) -> NeutralSection:
        """Build a neutral section, add it to the infra, and return it."""
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
        """Add a route to the infrastructure."""
        self.infra.routes.append(route)

    def _prepare_infra(self):
        # Add buffer stops where needed
        self._auto_gen_buffer_stops()

        # Sort track sections waypoints and signals
        for track in self.infra.track_sections:
            track.sort_signals()
            track.sort_waypoints()

    def generate_routes(self, progressive_release: bool = True) -> Iterable[Route]:
        """
        Generate routes using signaling and detectors.
        Routes need to be manually registered using register_route.
        Buffer stops will be added where missing.

        Keyword arguments:
        progressive_release -- whether to add release points at all intermediate detectors
        """
        self._prepare_infra()
        return generate_routes(self.infra, progressive_release)

    def build(self, progressive_release: bool = True) -> Infra:
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
