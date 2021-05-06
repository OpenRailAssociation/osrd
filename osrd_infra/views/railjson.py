from rest_framework.response import Response
from rest_framework.generics import get_object_or_404
from rest_framework.views import APIView

from osrd_infra.models import (
    Infra,
    ApplicableDirection,
    BufferStopEntity,
    DetectorEntity,
    SwitchEntity,
    ScriptFunctionEntity,
    SignalEntity,
    TrackSectionEntity,
    TrackSectionLinkEntity,
    TVDSectionEntity,
    Endpoint,
    OperationalPointEntity,
    OperationalPointPartEntity,
    SpeedSectionEntity,
    SpeedSectionPartEntity,
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


def serialize_endpoint(endpoint: int, track_section_id: int):
    return {
        "endpoint": Endpoint(endpoint).name,
        "section": format_track_section_id(track_section_id),
    }


def serialize_applicable_direction(applicable_direction: int):
    return ApplicableDirection(applicable_direction).name


def serialize_signal(entity):
    applicable_direction = entity.applicable_direction_set.get().applicable_direction
    position = entity.point_location_set.get().offset
    return {
        "id": format_signal_id(entity.entity_id),
        "applicable_direction": serialize_applicable_direction(applicable_direction),
        "position": position,
        "sight_distance": entity.sight_distance.distance,
        "expr": entity.rail_script.script,
    }


def serialize_detector(entity):
    applicable_direction = entity.applicable_direction_set.get().applicable_direction
    position = entity.point_location_set.get().offset
    return {
        "id": format_detector_id(entity.entity_id),
        "applicable_direction": serialize_applicable_direction(applicable_direction),
        "position": position,
        "type": "detector",
    }


def serialize_buffer_stop(entity):
    applicable_direction = entity.applicable_direction_set.get().applicable_direction
    position = entity.point_location_set.get().offset
    return {
        "id": format_buffer_stop_id(entity.entity_id),
        "applicable_direction": serialize_applicable_direction(applicable_direction),
        "position": position,
        "type": "buffer_stop",
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
    applicable_direction = entity.applicable_direction_set.get().applicable_direction
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
    detectors = cached_entities["detectors"]
    buffer_stops = cached_entities["buffer_stops"]
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
            serialize_detector(detectors[point_object.entity_id])
            for point_object in point_objects
            if point_object.entity_id in detectors
        ]
        + [
            serialize_buffer_stop(buffer_stops[point_object.entity_id])
            for point_object in point_objects
            if point_object.entity_id in buffer_stops
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
    track_section_link = track_section_link_entity.track_section_link_set.get()
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
    links = list(switch_entity.track_section_link_set.all())

    # for now, a switch can only have two links
    assert len(links) == 2

    # amongst these two links, there has to be a single common base and no more
    endpoints = []
    for link in links:
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


def serialize_script_function(function_entity):
    return function_entity.rail_script.script


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

    cached_detectors = cached_entities["detectors"]

    detectors = []
    buffer_stops = []

    for component in tvd_section_components:
        if component.entity_id in cached_detectors:
            detectors.append(format_detector_id(component.entity_id))
        else:
            buffer_stops.append(format_buffer_stop_id(component.entity_id))

    return {
        "id": format_tvd_section_id(tvd_section_entity.entity_id),
        "is_berthing_track": tvd_section_entity.berthing.is_berthing,
        "buffer_stops": buffer_stops,
        "train_detectors": detectors,
    }


def fetch_and_map(entity_type, namespace):
    return {
        entity.entity_id: entity for entity in fetch_entities(entity_type, namespace)
    }


class InfraRailJSONView(APIView):
    def get(self, request, pk):
        infra = get_object_or_404(Infra, pk=pk)
        namespace = infra.namespace

        cached_entities = {
            "signals": fetch_and_map(SignalEntity, namespace),
            "detectors": fetch_and_map(DetectorEntity, namespace),
            "buffer_stops": fetch_and_map(BufferStopEntity, namespace),
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
                    serialize_script_function(entity)
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
                "version": "0.1.0",
            }
        )
