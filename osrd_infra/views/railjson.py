from rest_framework.response import Response

from osrd_infra.models import (
    ApplicableDirection,
    AspectEntity,
    SwitchEntity,
    ScriptFunctionEntity,
    SignalEntity,
    TrackSectionEntity,
    TrackSectionLinkEntity,
    TVDSectionEntity,
    Endpoint,
    OperationalPointEntity,
    OperationalPointPartEntity,
    RouteEntity,
    SpeedSectionEntity,
    SpeedSectionPartEntity,
    SwitchPosition,
    WaypointEntity,
    WaypointType,
    fetch_entities,
)

from collections import Counter


def format_track_section_id(entity_id: int) -> str:
    return f"track_section.{entity_id}"


def format_switch_id(entity_id: int) -> str:
    return f"switch.{entity_id}"


def format_signal_id(entity_id: int) -> str:
    return f"signal.{entity_id}"


def format_operation_point_id(entity_id: int) -> str:
    return f"operational_point.{entity_id}"


def format_speed_section_id(entity_id: int) -> str:
    return f"speed_section.{entity_id}"


def format_detector_id(entity_id: int) -> str:
    return f"detector.{entity_id}"


def format_buffer_stop_id(entity_id: int) -> str:
    return f"buffer_stop.{entity_id}"


def format_tvd_section_id(entity_id: int) -> str:
    return f"tvd_section.{entity_id}"


def format_route_id(entity_id: int) -> str:
    return f"route.{entity_id}"


def format_aspect_id(entity_id: int) -> str:
    return f"aspect.{entity_id}"


def format_waypoint_id(waypoint: WaypointEntity) -> str:
    if waypoint.waypoint.waypoint_type == WaypointType.BUFFER_STOP:
        return format_buffer_stop_id(waypoint.entity_id)
    return format_detector_id(waypoint.entity_id)


def serialize_endpoint(endpoint: int, track_section_id: int):
    return {
        "endpoint": Endpoint(endpoint).name,
        "section": format_track_section_id(track_section_id),
    }


def serialize_applicable_direction(applicable_direction: int):
    return ApplicableDirection(applicable_direction).name


def serialize_signal(entity):
    applicable_direction = entity.applicable_direction.applicable_direction
    position = entity.point_location_set.get().offset
    linked_detector = None
    if entity.signal.linked_detector:
        linked_detector = format_waypoint_id(entity.signal.linked_detector)

    return {
        "id": format_signal_id(entity.entity_id),
        "applicable_direction": serialize_applicable_direction(applicable_direction),
        "position": position,
        "sight_distance": entity.signal.sight_distance,
        "expr": entity.rail_script.script,
        "linked_detector": linked_detector,
    }


def serialize_waypoint(entity):
    applicable_direction = entity.applicable_direction.applicable_direction
    position = entity.point_location.offset
    entity_type = (
        "detector"
        if entity.waypoint.waypoint_type == WaypointType.DETECTOR
        else "buffer_stop"
    )
    return {
        "id": format_waypoint_id(entity),
        "applicable_direction": serialize_applicable_direction(applicable_direction),
        "position": position,
        "type": entity_type,
    }


def serialize_op_part(op_part_entity):
    op = op_part_entity.operational_point_part_set.get().operational_point
    range_loc = op_part_entity.range_location_set.get()
    return {
        "begin": range_loc.start_offset,
        "end": range_loc.end_offset,
        "ref": format_operation_point_id(op.entity_id),
    }


def serialize_speed_section_part(entity):
    speed_section = entity.speed_section_part_set.get().speed_section
    range_loc = entity.range_location_set.get()
    applicable_direction = entity.applicable_direction.applicable_direction
    return {
        "applicable_direction": serialize_applicable_direction(applicable_direction),
        "begin": range_loc.start_offset,
        "end": range_loc.end_offset,
        "ref": format_speed_section_id(speed_section.entity_id),
    }


def serialize_track_section(track_section_entity, **cached_entities):
    track_section = track_section_entity.track_section

    point_objects = track_section_entity.point_objects.all()
    range_objects = track_section_entity.range_objects.all()
    signals = cached_entities["signals"]
    waypoints = cached_entities["waypoints"]
    op_parts = cached_entities["op_parts"]
    speed_sections = cached_entities["speed_section_parts"]

    return {
        "length": track_section.length,
        "id": format_track_section_id(track_section_entity.entity_id),
        "signals": [
            serialize_signal(signals[point_object.entity_id])
            for point_object in point_objects
            if point_object.entity_id in signals
        ],
        "route_waypoints": [
            serialize_waypoint(waypoints[point_object.entity_id])
            for point_object in point_objects
            if point_object.entity_id in waypoints
        ],
        "operational_points": [
            serialize_op_part(op_parts[range_object.entity_id])
            for range_object in range_objects
            if range_object.entity_id in op_parts
        ],
        "speed_sections": [
            serialize_speed_section_part(speed_sections[range_object.entity_id])
            for range_object in range_objects
            if range_object.entity_id in speed_sections
        ],
    }


def serialize_track_section_link(track_section_link_entity):
    track_section_link = track_section_link_entity.track_section_link
    return {
        "id": f"track_section_link.{track_section_link_entity.entity_id}",
        "begin": serialize_endpoint(
            track_section_link.begin_endpoint, track_section_link.begin_track_section_id
        ),
        "end": serialize_endpoint(
            track_section_link.end_endpoint, track_section_link.end_track_section_id
        ),
        "navigability": "BOTH",
    }


def serialize_switch(switch_entity):
    left_link = switch_entity.switch.left.track_section_link
    right_link = switch_entity.switch.right.track_section_link

    # amongst these two links, there has to be a single common base and no more
    endpoints = []
    for link in (left_link, right_link):
        endpoints.append((link.begin_endpoint, link.begin_track_section_id))
        endpoints.append((link.end_endpoint, link.end_track_section_id))
    endpoint_counter = Counter(endpoints)

    (
        (base_endpoint, base_occ),
        (left_endpoint, left_occ),
        (right_endpoint, right_occ),
    ) = endpoint_counter.most_common()
    assert base_occ == 2
    assert left_occ == 1
    assert right_occ == 1

    return {
        "id": format_switch_id(switch_entity.entity_id),
        "base": serialize_endpoint(*base_endpoint),
        "left": serialize_endpoint(*left_endpoint),
        "right": serialize_endpoint(*right_endpoint),
    }


def serialize_operational_point(entity):
    return {"id": format_operation_point_id(entity.entity_id)}


def serialize_speed_section(entity):
    return {
        "id": format_speed_section_id(entity.entity_id),
        "is_signalized": entity.speed_section.is_signalized,
        "speed": entity.speed_section.speed,
    }


def serialize_tvd_section(tvd_section_entity, **cached_entities):
    tvd_section_components = tvd_section_entity.tvd_section_components.all()

    cached_waypoints = cached_entities["waypoints"]
    detectors = []
    buffer_stops = []
    for component in tvd_section_components:
        waypoint = cached_waypoints[component.entity_id]
        if waypoint.waypoint.waypoint_type == WaypointType.DETECTOR:
            detectors.append(format_detector_id(waypoint.entity_id))
        else:
            buffer_stops.append(format_buffer_stop_id(waypoint.entity_id))

    return {
        "id": format_tvd_section_id(tvd_section_entity.entity_id),
        "is_berthing_track": tvd_section_entity.berthing.is_berthing,
        "buffer_stops": buffer_stops,
        "train_detectors": detectors,
    }


def serialize_route(route_entity):
    switches_position = route_entity.switch_position_set.all()
    release_groups = route_entity.release_group_set.all()
    entry_point = route_entity.route.entry_point

    return {
        "id": format_route_id(route_entity.entity_id),
        "switches_position": {
            format_switch_id(switch.switch.entity_id): SwitchPosition(
                switch.position
            ).name
            for switch in switches_position
        },
        "release_groups": [
            [
                format_tvd_section_id(tvd_section.entity_id)
                for tvd_section in release_group.tvd_sections.all()
            ]
            for release_group in release_groups
        ],
        "entry_point": format_waypoint_id(entry_point),
    }


def serialize_aspect(aspect_entity):
    constraints = aspect_entity.constraint_set.all()
    return {
        "id": format_aspect_id(aspect_entity.entity_id),
        "constraints": [constraint.constraint for constraint in constraints],
    }


def fetch_and_map(entity_type, namespace):
    return {
        entity.entity_id: entity for entity in fetch_entities(entity_type, namespace)
    }


def railjson_serialize_infra(infra):
    namespace = infra.namespace

    cached_entities = {
        "signals": fetch_and_map(SignalEntity, namespace),
        "waypoints": fetch_and_map(WaypointEntity, namespace),
        "op_parts": fetch_and_map(OperationalPointPartEntity, namespace),
        "speed_section_parts": fetch_and_map(SpeedSectionPartEntity, namespace),
    }

    return Response(
        {
            "track_sections": [
                serialize_track_section(entity, **cached_entities)
                for entity in fetch_entities(TrackSectionEntity, namespace)
            ],
            "track_section_links": [
                serialize_track_section_link(entity)
                for entity in fetch_entities(TrackSectionLinkEntity, namespace)
            ],
            "switches": [
                serialize_switch(entity)
                for entity in fetch_entities(SwitchEntity, namespace)
            ],
            "script_functions": [
                entity.rail_script.script
                for entity in fetch_entities(ScriptFunctionEntity, namespace)
            ],
            "operational_points": [
                serialize_operational_point(entity)
                for entity in fetch_entities(OperationalPointEntity, namespace)
            ],
            "speed_sections": [
                serialize_speed_section(entity)
                for entity in fetch_entities(SpeedSectionEntity, namespace)
            ],
            "tvd_sections": [
                serialize_tvd_section(entity, **cached_entities)
                for entity in fetch_entities(TVDSectionEntity, namespace)
            ],
            "routes": [
                serialize_route(entity)
                for entity in fetch_entities(RouteEntity, namespace)
            ],
            "aspects": [
                serialize_aspect(entity)
                for entity in fetch_entities(AspectEntity, namespace)
            ],
            "version": 1,
        }
    )
