from railjson_generator.schema.infra.direction import Direction
from railjson_generator.schema.infra.endpoint import Endpoint, TrackEndpoint
from railjson_generator.schema.infra.link import Link
from railjson_generator.utils.pathfinding import PathfindingStep, explore_paths


def create_route_from_path(builder, path):
    waypoint_list = []
    track_sections = []
    track_directions = []
    for path_element in path:
        track_sections.append(path_element.track_section)
        track_directions.append(path_element.direction)
        reverse = path_element.direction == Direction.STOP_TO_START
        start = path_element.begin if not reverse else path_element.end
        end = path_element.begin if reverse else path_element.end
        waypoints = []
        for waypoint in path_element.track_section.waypoints:
            if start <= waypoint.position <= end:
                waypoints.append(waypoint)
        if reverse:
            waypoints.reverse()
        for waypoint in waypoints:
            waypoint_list.append((waypoint, path_element.direction))

    waypoints = [w for w, _ in waypoint_list]
    entry_direction = waypoint_list[0][1]
    path[0].begin = waypoints[0].position

    tvd_sections = []
    for waypoint, direction in waypoint_list[:-1]:
        tvd = waypoint.right_tvd
        if direction == Direction.STOP_TO_START:
            tvd = waypoint.left_tvd
        tvd_sections.append(tvd)

    switches_group = {}
    for i, (tiv_a, tiv_b) in enumerate(zip(track_sections[:-1], track_sections[1:])):
        direction_a = track_directions[i]
        direction_b = track_directions[i + 1]
        endpoint_a = Endpoint.END if direction_a is Direction.START_TO_STOP else Endpoint.BEGIN
        endpoint_b = Endpoint.BEGIN if direction_b is Direction.START_TO_STOP else Endpoint.END
        link_key = Link.format_link_key(TrackEndpoint(tiv_a, endpoint_a), TrackEndpoint(tiv_b, endpoint_b))
        if link_key not in builder.switches_group_map:
            continue
        switch, group = builder.switches_group_map[link_key]
        switches_group[switch.label] = group

    builder.infra.add_route(
        waypoints,
        entry_direction,
        switches_group=switches_group,
        path_elements=path,
    )


def create_if_not_seen(builder, path, seen):
    waypoints_tuple = (path[0].track_section.label, path[0].begin, path[-1].track_section.label, path[-1].end)
    if waypoints_tuple in seen:
        return
    seen.add(waypoints_tuple)
    create_route_from_path(builder, path)


def generate_routes(builder):
    seen_paths = set()
    for track in builder.infra.track_sections:
        for signal in track.signals:
            direction = Direction(signal.direction)
            origin = PathfindingStep(track, signal.position, direction)
            for path in explore_paths(origin):
                create_if_not_seen(builder, path, seen_paths)
        for waypoint in track.waypoints:
            if waypoint.waypoint_type == "detector":
                continue
            for direction in waypoint.applicable_direction.directions():
                origin = PathfindingStep(track, waypoint.position, direction)
                for path in explore_paths(origin):
                    create_if_not_seen(builder, path, seen_paths)
