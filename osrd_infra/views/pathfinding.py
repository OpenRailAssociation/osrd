from osrd_infra.serializers import PathSerializer
from django.contrib.gis.geos import LineString, Point
from django.db import transaction
from rest_framework.generics import get_object_or_404
from rest_framework.viewsets import GenericViewSet
from rest_framework import mixins
from rest_framework.exceptions import ParseError
import requests
from django.conf import settings
from osrd_infra.views.railjson import format_track_section_id


from osrd_infra.models import (
    Path,
    Infra,
    TrackSectionEntity,
)


def status_missing_field_keyerror(key_error: KeyError):
    (key,) = key_error.args
    raise ParseError(f"missing field: {key}")


def try_extract_field(manifest, field):
    try:
        return manifest.pop(field)
    except KeyError as e:
        return status_missing_field_keyerror(e)


def request_pathfinding(payload):
    response = requests.post(settings.BACKEND_URL + "pathfinding/routes", json=payload)
    if not response:
        raise ParseError(response.content)
    return response.json()


def fetch_track_sections(formated_ids):
    ids = [int(f_id.split(".")[1]) for f_id in formated_ids]
    related_names = ["geo_line_location", "track_section"]
    tracks = TrackSectionEntity.objects.prefetch_related(*related_names).filter(
        pk__in=ids
    )
    return {format_track_section_id(track.pk): track for track in tracks}


def line_string_slice(line_string, begin_normalized, end_normalized):
    positions = [begin_normalized]
    for point in line_string.tuple:
        projection = line_string.project_normalized(Point(point))
        if projection <= begin_normalized:
            continue
        elif projection >= end_normalized:
            break
        positions.append(projection)
    positions.append(end_normalized)
    return [line_string.interpolate_normalized(pos) for pos in positions]


def get_geojson_path(payload):
    geographic, schematic = [], []
    track_section_ids = []
    for step in payload:
        for track in step["track_sections"]:
            track_section_ids.append(track["track_section"])

    track_map = fetch_track_sections(track_section_ids)

    for step in payload:
        for track in step["track_sections"]:
            track_entity = track_map[track["track_section"]]
            geo = track_entity.geo_line_location.geographic
            schema = track_entity.geo_line_location.schematic
            track_length = track_entity.track_section.length

            # normalize positions
            begin = track["begin_position"] / track_length
            end = track["end_position"] / track_length
            assert begin >= 0.0 and begin <= 1.0
            assert end >= 0.0 and end <= 1.0

            geographic += line_string_slice(geo, begin, end)
            schematic += line_string_slice(schema, begin, end)
    return LineString(geographic).json, LineString(schematic).json


class PathfindingView(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    mixins.ListModelMixin,
    GenericViewSet,
):
    serializer_class = PathSerializer
    queryset = Path.objects.order_by("-created")

    @transaction.atomic
    def perform_create(self, serializer):
        waypoints = try_extract_field(self.request.data, "waypoints")
        infra_id = try_extract_field(self.request.data, "infra")
        infra = get_object_or_404(Infra, pk=infra_id)
        if not isinstance(waypoints, list):
            raise ParseError("waypoints: expected a list of list")
        for stop in waypoints:
            if not isinstance(stop, list):
                raise ParseError("waypoints: expected a list of list")
            for waypoint in stop:
                if not isinstance(waypoint, dict):
                    raise ParseError("waypoint: expected a dict")
                for key in ("track_section", "direction", "offset"):
                    if key not in waypoint:
                        raise ParseError(f"waypoint missing field: {key}")

        payload = request_pathfinding({"infra": infra_id, "waypoints": waypoints})
        geographic, schematic = get_geojson_path(payload)

        serializer.save(
            owner=self.request.user.sub,
            namespace=infra.namespace,
            payload=payload,
            geographic=geographic,
            schematic=schematic,
        )
