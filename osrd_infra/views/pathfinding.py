from django.contrib.gis.geos import LineString, Point
from rest_framework.generics import get_object_or_404
from rest_framework.viewsets import GenericViewSet
from rest_framework import mixins
from rest_framework.exceptions import ParseError
import requests
from django.conf import settings
from osrd_infra.views.railjson import format_track_section_id
from rest_framework.response import Response

from osrd_infra.serializers import (
    PathSerializer,
    PathInputSerializer,
)

from osrd_infra.models import (
    Path,
    TrackSectionEntity,
)


def status_missing_field_keyerror(key_error: KeyError):
    (key,) = key_error.args
    raise ParseError(f"missing field: {key}")


def try_get_field(manifest, field):
    try:
        return manifest[field]
    except KeyError as e:
        return status_missing_field_keyerror(e)


def geo_transform(gis_object):
    gis_object.transform(4326)
    return gis_object


def post_treatment(payload):
    for route in payload["path"]:
        route["route"] = int(route["route"].split(".")[1])
        for track in route["track_sections"]:
            track["track_section"] = int(track["track_section"].split(".")[1])
    for op in payload["operational_points"]:
        op["op"] = int(op["op"].split(".")[1])
        op["position"]["track_section"] = int(
            op["position"]["track_section"].split(".")[1]
        )
    return payload


def request_pathfinding(payload):
    response = requests.post(
        settings.OSRD_BACKEND_URL + "pathfinding/routes",
        headers={"Authorization": "Bearer " + settings.OSRD_BACKEND_TOKEN},
        json=payload,
    )
    if not response:
        raise ParseError(response.content)
    return post_treatment(response.json())


def fetch_track_sections(ids):
    related_names = ["geo_line_location", "track_section"]
    tracks = TrackSectionEntity.objects.prefetch_related(*related_names).filter(
        pk__in=ids
    )
    return {track.pk: track for track in tracks}


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
    for route in payload["path"]:
        for track in route["track_sections"]:
            track_section_ids.append(track["track_section"])

    track_map = fetch_track_sections(track_section_ids)

    for route in payload["path"]:
        for track in route["track_sections"]:
            track_entity = track_map[track["track_section"]]
            geo = geo_transform(track_entity.geo_line_location.geographic)
            schema = geo_transform(track_entity.geo_line_location.schematic)
            track_length = track_entity.track_section.length

            # normalize positions
            begin = track["begin"] / track_length
            end = track["end"] / track_length
            assert begin >= 0.0 and begin <= 1.0
            assert end >= 0.0 and end <= 1.0

            geographic += line_string_slice(geo, begin, end)
            schematic += line_string_slice(schema, begin, end)
    return LineString(geographic).json, LineString(schematic).json


def parse_waypoint_input(waypoints):
    track_ids = []
    for step in waypoints:
        [track_ids.append(waypoint["track_section"]) for waypoint in step]
    track_map = fetch_track_sections(track_ids)
    result = []
    for step in waypoints:
        step_result = []
        for waypoint in step:
            try:
                track = track_map[waypoint["track_section"]]
            except KeyError:
                raise ParseError(
                    f"Track section '{waypoint['track_section']}' doesn't exists"
                )

            geo = geo_transform(track.geo_line_location.geographic)
            offset = geo.project_normalized(Point(waypoint["geo_coordinate"]))
            offset = max(min(offset, 1), 0) * track.track_section.length
            parsed_waypoint = {
                "track_section": format_track_section_id(track.pk),
                "offset": offset,
            }
            # Allow both direction
            step_result.append({**parsed_waypoint, "direction": "START_TO_STOP"})
            step_result.append({**parsed_waypoint, "direction": "STOP_TO_START"})
        result.append(step_result)

    return result


class PathfindingView(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    mixins.ListModelMixin,
    GenericViewSet,
):
    serializer_class = PathSerializer
    queryset = Path.objects.order_by("-created")

    def format_response(self, path):
        serializer = self.serializer_class(path)
        return {
            **serializer.data,
            "operational_points": path.payload["operational_points"],
        }

    def retrieve(self, request, pk=None):
        queryset = self.get_queryset().all()
        path = get_object_or_404(queryset, pk=pk)
        return Response(self.format_response(path))

    def create(self, request):
        input_serializer = PathInputSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        data = input_serializer.validated_data

        infra = data["infra"]

        waypoints = parse_waypoint_input(data["waypoints"])
        payload = request_pathfinding({"infra": infra.pk, "waypoints": waypoints})
        geographic, schematic = get_geojson_path(payload)

        path = Path(
            name=data["name"],
            owner=self.request.user.sub,
            namespace=infra.namespace,
            payload=payload,
            geographic=geographic,
            schematic=schematic,
        )
        path.save()
        return Response(self.format_response(path))
