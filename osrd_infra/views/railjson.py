from rest_framework.response import Response
from rest_framework.generics import get_object_or_404
from rest_framework.views import APIView

from osrd_infra.models import (
    Infra,
    ApplicableDirection,
    SwitchEntity,
    ScriptFunctionEntity,
    SignalEntity,
    TrackSectionEntity,
    TrackSectionLinkEntity,
    Endpoint,
    fetch_entities,
)

from collections import Counter


def format_track_section_id(entity_id: int) -> str:
    return f"track_section.{entity_id}"


def format_switch_id(entity_id: int) -> str:
    return f"switch.{entity_id}"


def format_signal_id(entity_id: int) -> str:
    return f"signal.{entity_id}"


def serialize_endpoint(endpoint: int, track_section_id: int):
    return {
        "endpoint": Endpoint(endpoint).name,
        "section": format_track_section_id(track_section_id),
    }


def serialize_applicable_direction(applicable_direction: int):
    return ApplicableDirection(applicable_direction).name


def serialize_signal(signal_entity):
    applicable_direction = (
        signal_entity.applicable_direction_set.get().applicable_direction
    )
    position = signal_entity.point_location_set.get().offset
    return {
        "id": format_signal_id(signal_entity.entity_id),
        "navigability": serialize_applicable_direction(applicable_direction),
        "position": position,
        "sight_distance": signal_entity.sight_distance.distance,
        "expr": signal_entity.rail_script.script,
    }


def serialize_track_section(track_section_entity, signals):
    track_section = track_section_entity.track_section

    # fetch point_objects
    point_objects = track_section_entity.point_objects.all()

    return {
        "length": track_section.length,
        "id": format_track_section_id(track_section_entity.entity_id),
        "signals": [
            serialize_signal(signals[point_object.entity_id])
            for point_object in point_objects
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


class InfraRailJSONView(APIView):
    def get(self, request, pk):
        infra = get_object_or_404(Infra, pk=pk)
        namespace = infra.namespace

        signals = {
            signal.entity_id: signal
            for signal in fetch_entities(SignalEntity, namespace)
        }

        return Response(
            {
                "track_sections": [
                    serialize_track_section(entity, signals)
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
            }
        )
