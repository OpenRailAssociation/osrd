from __future__ import annotations

import itertools
import math
from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass, field

from railjson_generator.schema.infra.direction import Direction
from railjson_generator.schema.infra.endpoint import Endpoint, TrackEndpoint
from railjson_generator.schema.infra.infra import Infra
from railjson_generator.schema.infra.route import Route
from railjson_generator.schema.infra.signal import Signal
from railjson_generator.schema.infra.switch import SwitchGroup
from railjson_generator.schema.infra.track_section import TrackSection
from railjson_generator.schema.infra.waypoint import BufferStop, Waypoint


def follow_track_link(
    connections: list[tuple[TrackEndpoint, SwitchGroup | None]],
) -> TrackEndpoint | None:
    """Follow a track link. If there is no track link on this endpoint, return None."""
    if not connections:
        return None
    (endpoint, switch_group) = connections[0]
    if switch_group is not None:
        return None
    return endpoint


def _explore_signals(
    track: TrackSection, det_i: int | None, signal_direction: Direction
) -> Iterable[tuple[TrackSection, Signal]]:
    """Find signals which are associated with a given detector."""
    signal_iterator = (
        reversed(track.signals)
        if signal_direction == Direction.START_TO_STOP
        else iter(track.signals)
    )

    continue_exploring: bool

    if det_i is None:
        # if we didn't start on this track
        if not track.waypoints:
            continue_exploring = True

            def pos_filter(pos: float) -> bool:
                return True

        else:
            continue_exploring = False
            if signal_direction == Direction.START_TO_STOP:

                def pos_filter(pos: float) -> bool:
                    return pos > track.waypoints[-1].position

            else:

                def pos_filter(pos: float) -> bool:
                    return pos < track.waypoints[0].position

    else:
        # if we're starting on this track
        waypoint_pos = track.waypoints[det_i].position
        if signal_direction == Direction.START_TO_STOP:
            if det_i == 0:
                continue_exploring = True
                prev_waypoint_pos = -math.inf
            else:
                continue_exploring = False
                prev_waypoint_pos = track.waypoints[det_i - 1].position

            def pos_filter(pos: float) -> bool:
                return prev_waypoint_pos < pos <= waypoint_pos

        else:
            if det_i == len(track.waypoints) - 1:
                continue_exploring = True
                prev_waypoint_pos = math.inf
            else:
                continue_exploring = False
                prev_waypoint_pos = track.waypoints[det_i + 1].position

            def pos_filter(pos: float) -> bool:
                return waypoint_pos <= pos < prev_waypoint_pos

    # explore the signals in range on the track
    for signal in signal_iterator:
        if signal.direction != signal_direction:
            continue
        if not pos_filter(signal.position):
            continue
        yield (track, signal)

    if not continue_exploring:
        return

    # if this track is linked with another one, explore further
    neighbor_endpoint = follow_track_link(track.neighbors(signal_direction.opposite()))
    if neighbor_endpoint is None:
        return

    neighbor_dir = (
        Direction.START_TO_STOP
        if neighbor_endpoint.endpoint == Endpoint.END
        else Direction.STOP_TO_START
    )
    yield from _explore_signals(neighbor_endpoint.track_section, None, neighbor_dir)


@dataclass
class DetectorProps:
    incr_is_route_delim: bool
    incr_signals: list[Signal]
    decr_is_route_delim: bool
    decr_signals: list[Signal]


def find_detector_properties(infra: Infra) -> dict[str, DetectorProps]:
    det_props: dict[str, DetectorProps] = {}
    for track in infra.track_sections:
        for det_i, det in enumerate(track.waypoints):
            incr_signals = [
                sig
                for _, sig in _explore_signals(track, det_i, Direction.START_TO_STOP)
            ]
            decr_signals = [
                sig
                for _, sig in _explore_signals(track, det_i, Direction.STOP_TO_START)
            ]
            incr_is_route_delim = any(sig.is_route_delimiter for sig in incr_signals)
            decr_is_route_delim = any(sig.is_route_delimiter for sig in decr_signals)
            det_props[det.id] = DetectorProps(
                incr_is_route_delim, incr_signals, decr_is_route_delim, decr_signals
            )
    return det_props


@dataclass
class ZonePath:
    entry_det: Waypoint
    entry_dir: Direction
    exit_det: Waypoint
    exit_dir: Direction
    switches_directions: dict[str, str] = field(default_factory=dict)

    @property
    def entry(self) -> tuple[str, Direction]:
        return (self.entry_det.label, self.entry_dir)

    @property
    def exit(self) -> tuple[str, Direction]:
        return (self.exit_det.label, self.exit_dir)


@dataclass
class ZonePathStep:
    track_section: TrackSection
    direction: Direction
    switch_direction: SwitchGroup | None = field(default=None)
    previous: ZonePathStep | None = field(default=None)

    def build(
        self,
        entry_det: Waypoint,
        entry_dir: Direction,
        exit_det: Waypoint,
        exit_dir: Direction,
    ) -> ZonePath:
        switches_directions = {}
        step = self
        while step is not None:
            switch_group = step.switch_direction
            if switch_group is not None:
                switches_directions[switch_group.switch.label] = switch_group.group
            step = step.previous
        return ZonePath(entry_det, entry_dir, exit_det, exit_dir, switches_directions)


def search_zone_paths(infra: Infra) -> list[ZonePath]:
    """Enumerate all possible paths inside zones."""

    res = []
    for track in infra.track_sections:
        if len(track.waypoints) == 0:
            continue
        waypoints = track.waypoints

        # create paths between inner waypoints
        for cur_waypoint, next_waypoint in itertools.pairwise(waypoints):
            res.append(
                ZonePath(
                    entry_det=cur_waypoint,
                    entry_dir=Direction.START_TO_STOP,
                    exit_det=next_waypoint,
                    exit_dir=Direction.START_TO_STOP,
                )
            )
            res.append(
                ZonePath(
                    entry_det=next_waypoint,
                    entry_dir=Direction.STOP_TO_START,
                    exit_det=cur_waypoint,
                    exit_dir=Direction.STOP_TO_START,
                )
            )

        # explore outwards from the first and last waypoints
        # if one of these is a buffer stop, the path will never complete and get discarded
        starting_points = [
            (waypoints[0], Direction.STOP_TO_START),
            (waypoints[-1], Direction.START_TO_STOP),
        ]
        for start_waypoint, start_direction in starting_points:
            incomplete_paths = [ZonePathStep(track, start_direction)]
            while incomplete_paths:
                step = incomplete_paths.pop()
                for neighbor, switch_group in step.track_section.neighbors(
                    step.direction
                ):
                    neighbor_track = neighbor.track_section
                    if neighbor.endpoint == Endpoint.BEGIN:
                        neighbor_dir = Direction.START_TO_STOP
                    else:
                        neighbor_dir = Direction.STOP_TO_START

                    new_step = ZonePathStep(
                        neighbor_track, neighbor_dir, switch_group, step
                    )

                    if not neighbor_track.waypoints:
                        incomplete_paths.append(new_step)
                        continue

                    neighbor_waypoint = neighbor_track.waypoints[
                        0 if neighbor_dir == Direction.START_TO_STOP else -1
                    ]
                    res.append(
                        new_step.build(
                            start_waypoint,
                            start_direction,
                            neighbor_waypoint,
                            neighbor_dir,
                        )
                    )
    return res


@dataclass(frozen=True)
class IncompleteRoute:
    path: list[ZonePath]
    switches_directions: dict[str, str]

    @staticmethod
    def from_zonepath(zone_path: ZonePath) -> IncompleteRoute:
        return IncompleteRoute(
            path=[zone_path], switches_directions={**zone_path.switches_directions}
        )

    def fork(self, new_zone_path: ZonePath) -> IncompleteRoute | None:
        if any(
            switch in self.switches_directions
            for switch in new_zone_path.switches_directions
        ):
            return None
        new_path = [*self.path, new_zone_path]
        new_switches_directions = {
            **self.switches_directions,
            **new_zone_path.switches_directions,
        }
        return IncompleteRoute(
            path=new_path, switches_directions=new_switches_directions
        )

    def dir_waypoints(self) -> list[tuple[Waypoint, Direction]]:
        return [
            (self.path[0].entry_det, self.path[0].entry_dir),
            *((zone_path.exit_det, zone_path.exit_dir) for zone_path in self.path),
        ]

    def waypoints(self) -> list[Waypoint]:
        return [waypoint for waypoint, _ in self.dir_waypoints()]


def generate_route_paths(
    det_props: dict[str, DetectorProps], zone_paths: list[ZonePath]
) -> Iterable[IncompleteRoute]:
    graph = defaultdict(list)
    for zone_path in zone_paths:
        graph[zone_path.entry].append(zone_path)

    def is_route_delim(det: Waypoint, direction: Direction) -> bool:
        if isinstance(det, BufferStop):
            return True
        props = det_props[det.label]
        if direction == Direction.START_TO_STOP:
            return props.incr_is_route_delim
        return props.decr_is_route_delim

    for zone_path in zone_paths:
        if not is_route_delim(zone_path.entry_det, zone_path.entry_dir):
            continue

        incomplete_routes = [IncompleteRoute.from_zonepath(zone_path)]
        explored = {zone_path.entry}
        while incomplete_routes:
            route = incomplete_routes.pop()
            path = route.path
            exit_zone_path = path[-1]
            path_exit = exit_zone_path.exit
            if path_exit in explored:
                continue
            explored.add(path_exit)
            if is_route_delim(exit_zone_path.exit_det, exit_zone_path.exit_dir):
                yield route
                continue
            neighbors = graph.get(path_exit)
            if neighbors is None:
                continue
            for neighbor in neighbors:
                if (new_route := route.fork(neighbor)) is not None:
                    incomplete_routes.append(new_route)


def generate_routes(infra: Infra, progressive_release: bool = True) -> Iterable[Route]:
    det_props = find_detector_properties(infra)

    zone_paths = search_zone_paths(infra)
    for incomplete_route in generate_route_paths(det_props, zone_paths):
        waypoints = incomplete_route.waypoints()
        release_waypoints = waypoints[1:-1] if progressive_release else []
        path = incomplete_route.path
        yield Route(
            waypoints,
            release_waypoints,
            path[0].entry_dir,
            switches_directions=incomplete_route.switches_directions,
        )
