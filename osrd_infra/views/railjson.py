from rest_framework.response import Response

from osrd_infra.utils import Benchmarker
from osrd_infra.models import (
    ApplicableDirection,
    AspectEntity,
    EdgeDirection,
    Endpoint,
    OperationalPointEntity,
    OperationalPointPartEntity,
    ReleaseGroupComponent,
    RouteEntity,
    ScriptFunctionEntity,
    SignalEntity,
    SpeedSectionEntity,
    SpeedSectionPartEntity,
    SwitchEntity,
    SwitchPosition,
    TVDSectionEntity,
    TrackSectionEntity,
    TrackSectionLinkEntity,
    WaypointEntity,
    WaypointType,
    fetch_entities,
)

from collections import Counter, defaultdict
import logging


logger = logging.getLogger(__name__)


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


def serialize_edge_direction(edge_direction: int):
    return EdgeDirection(edge_direction).name


def serialize_signal(cached_entities, entity):
    applicable_direction = entity.applicable_direction.applicable_direction
    position = entity.point_location.offset
    res = {
        "id": format_signal_id(entity.entity_id),
        "applicable_direction": serialize_applicable_direction(applicable_direction),
        "position": position,
        "sight_distance": entity.signal.sight_distance,
        "expr": entity.rail_script.script,
    }

    if entity.signal.linked_detector_id is not None:
        detector = cached_entities["waypoints"][entity.signal.linked_detector_id]
        res["linked_detector"] = format_waypoint_id(detector)

    return res


def serialize_waypoint(cached_entities, entity):
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


def serialize_op_part(cached_entities, op_part_entity):
    # .all() is used instead of .get to make django's orm use prefetching
    op_part_component = op_part_entity.operational_point_part
    op_id = op_part_component.operational_point_id
    op = cached_entities["op"][op_id]
    position = op_part_entity.point_location.offset
    return {
        "position": position,
        "ref": format_operation_point_id(op.entity_id),
    }


def serialize_speed_section_part(cached_entities, entity):
    # .all() is used instead of .get to make django's orm use prefetching
    speed_section_part_component = entity.speed_section_part
    # from the prefetched component, get the reference to the speed section
    speed_section_id = speed_section_part_component.speed_section_id
    speed_section = cached_entities["speed_sections"][speed_section_id]
    (range_loc,) = entity.range_location_set.all()
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
    speed_section_parts = cached_entities["speed_section_parts"]
    slopes = track_section_entity.slope_set.all()
    curves = track_section_entity.curve_set.all()

    return {
        "length": track_section.length,
        "id": format_track_section_id(track_section_entity.entity_id),
        "signals": [
            serialize_signal(cached_entities, signals[point_object.entity_id])
            for point_object in point_objects
            if point_object.entity_id in signals
        ],
        "route_waypoints": [
            serialize_waypoint(cached_entities, waypoints[point_object.entity_id])
            for point_object in point_objects
            if point_object.entity_id in waypoints
        ],
        "operational_points": [
            serialize_op_part(cached_entities, op_parts[point_object.entity_id])
            for point_object in point_objects
            if point_object.entity_id in op_parts
        ],
        "speed_sections": [
            serialize_speed_section_part(
                cached_entities, speed_section_parts[range_object.entity_id]
            )
            for range_object in range_objects
            if range_object.entity_id in speed_section_parts
        ],
        "slopes": [
            {
                "gradient": slope.gradient,
                "begin": slope.start_offset,
                "end": slope.end_offset,
            }
            for slope in slopes
        ],
        "curves": [
            {
                "radius": curve.radius,
                "begin": curve.start_offset,
                "end": curve.end_offset,
            }
            for curve in curves
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


def switch_types():
    """
    Generates the switch models in the infra.
    For now it only contains bidirectional switches
    """
    return {
        "classic_switch": {
            "ports": [
                "base",
                "left",
                "right"
            ],
            "groups": {
                "LEFT": [
                    {
                        "src": "base",
                        "dst": "left",
                        "bidirectional": True
                    }
                ],
                "RIGHT": [
                    {
                        "src": "base",
                        "dst": "right",
                        "bidirectional": True
                    }
                ]
            }
        }
    }


def serialize_classic_switch(cached_entities, switch_entity):
    track_section_links = cached_entities["track_section_links"]
    left_link = track_section_links[switch_entity.switch.left_id].track_section_link
    right_link = track_section_links[switch_entity.switch.right_id].track_section_link

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
        "switch_type": "classic_switch",  # TODO: add different switch types
        "ports": {
            "base": serialize_endpoint(*base_endpoint),
            "left": serialize_endpoint(*left_endpoint),
            "right": serialize_endpoint(*right_endpoint),
        },
        "group_change_delay": 6  # TODO: add change delay
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


def serialize_routes(cached_entities, namespace):
    entities = fetch_entities(RouteEntity, namespace)

    # serializing routes efficiently is a bit more tricky than with other
    # entity types: it involves a many to many relation inside a non-unique component,
    # which the django orm doesn't seem to be able to prefetch efficiently all by itself.
    release_group_ids = set(
        release_group.pk
        for route_entity in entities
        for release_group in route_entity.release_group_set.all()
    )

    prefetched_release_group_rels = (
        ReleaseGroupComponent.tvd_sections.through.objects.filter(
            releasegroupcomponent_id__in=release_group_ids
        )
    )

    prefetched_release_groups = defaultdict(list)
    for rel in prefetched_release_group_rels:
        prefetched_release_groups[rel.releasegroupcomponent_id].append(
            rel.tvdsectionentity_id
        )

    return [
        serialize_route(cached_entities, entity, prefetched_release_groups)
        for entity in entities
    ]


def serialize_route(cached_entities, route_entity, prefetched_release_groups):
    switch_position_components = route_entity.switch_position_set.all()
    release_groups = route_entity.release_group_set.all()
    entry_point = cached_entities["waypoints"][route_entity.route.entry_point_id]
    exit_point = cached_entities["waypoints"][route_entity.route.exit_point_id]
    entry_direction = route_entity.route.entry_direction

    return {
        "id": format_route_id(route_entity.entity_id),
        "switches_group": {
            format_switch_id(position_component.switch_id): SwitchPosition(
                position_component.position
            ).name
            for position_component in switch_position_components
        },
        "release_groups": [
            [
                format_tvd_section_id(tvd_section_id)
                for tvd_section_id in prefetched_release_groups[
                    release_group.component_id
                ]
            ]
            for release_group in release_groups
        ],
        "entry_point": format_waypoint_id(entry_point),
        "entry_direction": serialize_edge_direction(entry_direction),
        "exit_point": format_waypoint_id(exit_point),
    }


def serialize_aspect(aspect_entity):
    constraints = aspect_entity.constraint_set.all()
    return {
        "id": format_aspect_id(aspect_entity.entity_id),
        "constraints": [constraint.constraint for constraint in constraints],
    }


def fetch_and_map(entity_type, namespace, prefetch_related=None):
    query = fetch_entities(entity_type, namespace)
    if prefetch_related is not None:
        query = query.prefetch_related(*prefetch_related)
    return {entity.entity_id: entity for entity in query}


def railjson_serialize_infra(infra):
    return railjson_serialize_infra_namespace(infra.namespace)


def railjson_serialize_infra_namespace(namespace):
    bench = Benchmarker()

    bench.step("caching entities")
    cached_entities = {
        "signals": fetch_and_map(SignalEntity, namespace),
        "waypoints": fetch_and_map(WaypointEntity, namespace),
        "op": fetch_and_map(OperationalPointEntity, namespace),
        "op_parts": fetch_and_map(
            OperationalPointPartEntity,
            namespace,
            prefetch_related=("operational_point_part",),
        ),
        "speed_sections": fetch_and_map(SpeedSectionEntity, namespace),
        "speed_section_parts": fetch_and_map(SpeedSectionPartEntity, namespace),
        "track_section_links": fetch_and_map(TrackSectionLinkEntity, namespace),
    }

    res = {"version": 1}
    bench.step("serializing track sections")
    res["track_sections"] = [
        serialize_track_section(entity, **cached_entities)
        for entity in (
            fetch_entities(TrackSectionEntity, namespace).prefetch_related(
                "point_objects", "range_objects"
            )
        )
    ]

    bench.step("serializing track section links")
    res["track_section_links"] = [
        serialize_track_section_link(entity)
        for entity in fetch_entities(TrackSectionLinkEntity, namespace)
    ]

    bench.step("serializing switches")
    res["switches"] = [
        serialize_classic_switch(cached_entities, entity)
        for entity in fetch_entities(SwitchEntity, namespace)
    ]

    bench.step("serializing switch models")
    res["switch_types"] = switch_types()

    bench.step("serializing script functions")
    res["script_functions"] = [
        entity.rail_script.script
        for entity in fetch_entities(ScriptFunctionEntity, namespace)
    ]

    bench.step("serializing operational points")
    res["operational_points"] = [
        serialize_operational_point(entity)
        for entity in fetch_entities(OperationalPointEntity, namespace)
    ]

    bench.step("serializing speed sections")
    res["speed_sections"] = [
        serialize_speed_section(entity)
        for entity in fetch_entities(SpeedSectionEntity, namespace)
    ]

    bench.step("serializing tvd sections")
    res["tvd_sections"] = [
        serialize_tvd_section(entity, **cached_entities)
        for entity in (
            fetch_entities(TVDSectionEntity, namespace).prefetch_related(
                "tvd_section_components"
            )
        )
    ]

    bench.step("serializing routes")
    res["routes"] = serialize_routes(cached_entities, namespace)

    bench.step("serializing aspects")
    res["aspects"] = [
        serialize_aspect(entity) for entity in fetch_entities(AspectEntity, namespace)
    ]

    bench.step("creating the response")
    response = Response(res)

    bench.stop()
    bench.print_steps(logger.info)

    return response
