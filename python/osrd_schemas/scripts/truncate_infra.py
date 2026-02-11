from typing import Mapping, Sequence

from shapely import LineString, Polygon

from osrd_schemas.infra import (
    BufferStop,
    BufferStopReference,
    Detector,
    Direction,
    Electrification,
    Endpoint,
    LevelCrossing,
    NeutralSection,
    OperationalPoint,
    RailJsonInfra,
    Route,
    SpeedSection,
    Switch,
    SwitchType,
    TrackRange,
)
from osrd_schemas.switch_type import CROSSING, DOUBLE_SLIP_SWITCH, LINK, POINT_SWITCH

SWITCH_TYPES: Mapping[str, SwitchType] = {
    "point_switch": POINT_SWITCH,
    "link": LINK,
    "crossing": CROSSING,
    "double_slip_switch": DOUBLE_SLIP_SWITCH,
}


def truncate_infra(infra: RailJsonInfra, boundary: Polygon) -> RailJsonInfra:
    new_infra = RailJsonInfra.empty()

    new_infra.track_sections = [
        track_section
        for track_section in infra.track_sections
        if boundary.intersects(LineString(track_section.geo.coordinates))
    ]

    print(
        f"Keeping {len(new_infra.track_sections)}/{len(infra.track_sections)} track sections"
    )

    track_section_ids_to_keep = {ts.id for ts in new_infra.track_sections}

    new_infra.detectors = [
        detector
        for detector in infra.detectors
        if detector.track in track_section_ids_to_keep
    ]
    new_infra.buffer_stops = [
        buffer_stop
        for buffer_stop in infra.buffer_stops
        if buffer_stop.track in track_section_ids_to_keep
    ]
    new_infra.signals = [
        signal for signal in infra.signals if signal.track in track_section_ids_to_keep
    ]

    new_infra.operational_points = filter_operational_points(
        infra.operational_points, track_section_ids_to_keep
    )

    new_infra.level_crossings = filter_level_crossings(
        infra.level_crossings, track_section_ids_to_keep
    )

    new_infra.electrifications = filter_electrifications(
        infra.electrifications, track_section_ids_to_keep
    )
    new_infra.speed_sections = filter_speed_sections(
        infra.speed_sections, track_section_ids_to_keep
    )
    new_infra.neutral_sections = filter_neutral_sections(
        infra.neutral_sections, track_section_ids_to_keep
    )

    switches, new_buffer_stops, former_switch_id_to_buffer_stop_id = filter_switches(
        infra.switches,
        track_section_ids_to_keep,
        {track.id: track.length for track in new_infra.track_sections},
    )
    new_infra.switches = switches
    new_infra.buffer_stops.extend(new_buffer_stops)

    new_infra.routes = filter_routes(
        new_infra, infra, former_switch_id_to_buffer_stop_id
    )

    return new_infra


def filter_operational_points(
    operational_points: list[OperationalPoint], track_section_ids: set[str]
) -> list[OperationalPoint]:
    res = []
    for op in operational_points:
        included_parts = [part for part in op.parts if part.track in track_section_ids]
        if included_parts:
            new_op = op.model_copy(update={"parts": included_parts})
            res.append(new_op)

    return res


def filter_level_crossings(
    level_crossings: list[LevelCrossing], track_section_ids: set[str]
) -> list[LevelCrossing]:
    res = []
    for lc in level_crossings:
        included_parts = [part for part in lc.parts if part.track in track_section_ids]
        if included_parts:
            new_lc = lc.model_copy(update={"parts": included_parts})
            res.append(new_lc)

    return res


def filter_track_ranges(
    track_ranges: Sequence[TrackRange], track_section_ids: set[str]
) -> list[TrackRange]:
    return [
        track_range
        for track_range in track_ranges
        if track_range.track in track_section_ids
    ]


def filter_electrifications(
    electrifications: list[Electrification], track_section_ids: set[str]
) -> list[Electrification]:
    res = []
    for elec in electrifications:
        new_track_ranges = filter_track_ranges(elec.track_ranges, track_section_ids)
        if new_track_ranges:
            new_elec = elec.model_copy(update={"track_ranges": new_track_ranges})
            res.append(new_elec)

    return res


def filter_speed_sections(
    speed_sections: list[SpeedSection], track_section_ids: set[str]
) -> list[SpeedSection]:
    res = []
    for speed_section in speed_sections:
        new_track_ranges = filter_track_ranges(
            speed_section.track_ranges, track_section_ids
        )
        if new_track_ranges:
            new_speed_section = speed_section.model_copy(
                update={"track_ranges": new_track_ranges}
            )
            res.append(new_speed_section)

    return res


def filter_neutral_sections(
    neutral_sections: list[NeutralSection], track_section_ids: set[str]
) -> list[NeutralSection]:
    res = []
    for neutral_section in neutral_sections:
        new_track_ranges = filter_track_ranges(
            neutral_section.track_ranges, track_section_ids
        )
        if new_track_ranges:
            new_announcement_ranges = filter_track_ranges(
                neutral_section.announcement_track_ranges, track_section_ids
            )
            new_neutral_section = neutral_section.model_copy(
                update={
                    "track_ranges": new_track_ranges,
                    "announcement_track_ranges": new_announcement_ranges,
                }
            )
            res.append(new_neutral_section)

    return res


def filter_switches(
    switches: list[Switch],
    track_section_ids: set[str],
    track_length_by_track: dict[str, float],
) -> tuple[list[Switch], list[BufferStop], dict[str, tuple[str, Direction]]]:
    """Remove switches that are not on the track sections to keep and add buffer stops if needed.

    Returns the new list of switches, the list of buffer stops created and a dict mapping the ids of former switches to
    the ids of the buffer stops that replaced them and the direction the buffer stops are facing.
    """

    filtered_switches = []
    new_buffer_stops = []
    former_switch_id_to_buffer_stop_id = {}
    for switch in switches:
        n_ports_included = sum(
            port.track in track_section_ids for port in switch.ports.values()
        )
        if n_ports_included == len(switch.ports):
            # All ports are included, no need to change anything
            filtered_switches.append(switch)
        elif n_ports_included > 1:
            print(
                f"Switch {switch.id} should be included in the boundary, but isn't handled yet"
            )
        elif n_ports_included == 1:
            # Only one port is included, we need to replace the switch by a buffer stop
            the_port = next(
                port
                for port in switch.ports.values()
                if port.track in track_section_ids
            )
            new_buffer_stop = BufferStop(
                id=f"buffer_stop_{switch.id}",
                track=the_port.track,
                position=0
                if the_port.endpoint == Endpoint.BEGIN
                else track_length_by_track[the_port.track],
            )
            former_switch_id_to_buffer_stop_id[switch.id] = (
                new_buffer_stop.id,
                Direction.START_TO_STOP
                if the_port.endpoint == Endpoint.BEGIN
                else Direction.STOP_TO_START,
            )
            new_buffer_stops.append(new_buffer_stop)

    return filtered_switches, new_buffer_stops, former_switch_id_to_buffer_stop_id


def filter_routes(
    new_infra: RailJsonInfra,
    old_infra: RailJsonInfra,
    former_switch_id_to_buffer_stop_id: dict[str, tuple[str, Direction]],
) -> list[Route]:
    """Keep routes fully included in the boundary and adapt the ones that are partially included."""
    waypoints_ids_kept = {b.id for b in new_infra.buffer_stops} | {
        d.id for d in new_infra.detectors
    }
    switch_ids_kept = {s.id for s in new_infra.switches}

    detectors_by_id = {d.id: d for d in old_infra.detectors}
    buffer_stops_by_id = {b.id: b for b in old_infra.buffer_stops}
    switches_by_id = {s.id: s for s in old_infra.switches}

    res = []
    for route in old_infra.routes:
        entry_included = route.entry_point.id in waypoints_ids_kept
        exit_included = route.exit_point.id in waypoints_ids_kept

        n_switches_included = sum(
            switch_id in switch_ids_kept
            for switch_id in route.switches_directions.keys()
        )

        if entry_included and exit_included:
            if n_switches_included == len(route.switches_directions):
                # The route is fully included, no need to change anything
                res.append(route)
            else:
                # This is an edge case not yet handled
                print(f"Warning: dropping {route.id} that is partially included")

        elif entry_included ^ exit_included:
            # The route is partially included, we need to adapt it
            route = route.model_copy()
            switch_directions = order_switch_directions(
                route, detectors_by_id, buffer_stops_by_id, switches_by_id
            )
            if not exit_included:
                # It means the exit point is not in the boundary so we look from the end
                switch_directions = list(reversed(switch_directions))

            idx = 0
            while idx < len(switch_directions) and (
                switch_directions[idx][0] not in switch_ids_kept
            ):
                idx += 1
            assert all(
                switch_id in switch_ids_kept for switch_id, _ in switch_directions[idx:]
            )

            new_bufferstop_id, direction = former_switch_id_to_buffer_stop_id[
                switch_directions[idx - 1][0]
            ]
            if entry_included:
                route.exit_point = BufferStopReference(id=new_bufferstop_id)
            else:
                route.entry_point = BufferStopReference(id=new_bufferstop_id)
                route.entry_point_direction = direction

            route.switches_directions = dict(switch_directions[idx:])
            route.release_detectors = [
                d for d in route.release_detectors if d in waypoints_ids_kept
            ]

            res.append(route)

        elif not entry_included and not exit_included and n_switches_included > 0:
            # Some edge case that should be included but isn't handled yet
            print(f"Weird route {route.id} that should be included but isn't handled")
    return res


def order_switch_directions(
    route: Route,
    detectors_by_id: dict[str, Detector],
    buffer_stops_by_id: dict[str, BufferStop],
    switches_by_id: dict[str, Switch],
) -> list[tuple[str, str]]:
    """Order the switches and their directions in the route from the entry point to the exit point."""
    res = []

    tracks_by_switch = {
        switch_id: [port.track for port in switch.ports.values()]
        for switch_id, switch in switches_by_id.items()
    }

    switch_directions = list(route.switches_directions.items())
    entry_waypoint = (
        detectors_by_id[route.entry_point.id]
        if route.entry_point.type == "Detector"
        else buffer_stops_by_id[route.entry_point.id]
    )
    track_id = entry_waypoint.track
    while switch_directions != []:
        switch_dir_on_track = [
            (switch_id, dir)
            for switch_id, dir in switch_directions
            if track_id in tracks_by_switch[switch_id]
        ]

        assert len(switch_dir_on_track) == 1
        switch_dir_on_track = switch_dir_on_track[0]

        res.append(switch_dir_on_track)
        switch_directions.remove(switch_dir_on_track)
        switch_id, dir = switch_dir_on_track

        switch = switches_by_id[switch_id]
        track_id = get_connected_track_id(switch, track_id, dir)
    return res


def get_connected_track_id(switch: Switch, current_track_id: str, group: str) -> str:
    """Get the id of the track connected to the given track by this switch."""
    switch_type = SWITCH_TYPES[switch.switch_type]
    connections = switch_type.groups[group]

    connected_track = None
    for connection in connections:
        if switch.ports[connection.src].track == current_track_id:
            connected_track = switch.ports[connection.dst].track
            break
        elif switch.ports[connection.dst].track == current_track_id:
            connected_track = switch.ports[connection.src].track
            break
    if connected_track is None:
        raise ValueError(f"Could not find the connected track for {current_track_id}")
    return connected_track


if __name__ == "__main__":
    import json
    from argparse import ArgumentParser, RawTextHelpFormatter
    from pathlib import Path

    parser = ArgumentParser(formatter_class=RawTextHelpFormatter)
    parser.add_argument("input", help="Input RailJson file", type=Path)
    parser.add_argument("output", help="Output RailJson file", type=Path)
    parser.add_argument(
        "boundary",
        help="Boundary as a GeoJSON polygon coordinates\n"
        'For example: "[[0, 0], [1, 1], [2, 0], [1, -1]]"\n'
        "A way to get it is to use https://geojson.io/",
    )

    args = parser.parse_args()

    print("Reading infra")
    infra = RailJsonInfra.model_validate_json(args.input.read_text())
    boundary = Polygon(json.loads(args.boundary))

    print("Truncating infra")
    new_infra = truncate_infra(infra, boundary)

    print("Writing new infra")
    args.output.write_text(new_infra.model_dump_json(exclude_none=True))
