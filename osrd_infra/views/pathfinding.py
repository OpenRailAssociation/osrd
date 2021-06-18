from django.contrib.gis.geos import LineString, Point
from rest_framework.generics import get_object_or_404
from rest_framework.viewsets import GenericViewSet
from rest_framework import mixins
from rest_framework.exceptions import ParseError
import requests
from django.conf import settings
from osrd_infra.views.railjson import format_track_section_id
from rest_framework.response import Response
from osrd_infra.utils import geo_transform, reverse_format

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


def payload_reverse_format(payload):
    for route in payload["path"]:
        route["route"] = reverse_format(route["route"])
        for track in route["track_sections"]:
            track["track_section"] = reverse_format(track["track_section"])
    for step in payload["steps"]:
        step["position"]["track_section"] = reverse_format(
            step["position"]["track_section"]
        )
    return payload


def payload_fill_steps(payload, step_stop_times, track_map):
    stop_time_index = 0
    for step in payload["steps"]:
        if not step["suggestion"]:
            step["stop_time"] = step_stop_times[stop_time_index]
            stop_time_index += 1
        else:
            step["stop_time"] = 0

        track = track_map[step["position"]["track_section"]]
        offset = step["position"]["offset"] / track.track_section.length

        geo = geo_transform(track.geo_line_location.geographic)
        step["geographic"] = geo.interpolate_normalized(offset).coords

        schema = geo_transform(track.geo_line_location.schematic)
        step["schematic"] = schema.interpolate_normalized(offset).coords

    return payload


def request_pathfinding(payload):
    response = requests.post(
        settings.OSRD_BACKEND_URL + "pathfinding/routes",
        headers={"Authorization": "Bearer " + settings.OSRD_BACKEND_TOKEN},
        json=payload,
    )
    if not response:
        raise ParseError(response.content)
    return response.json()


def fetch_track_sections(ids):

    related_names = ["geo_line_location", "track_section"]
    tracks = TrackSectionEntity.objects.prefetch_related(*related_names).filter(
        pk__in=ids
    )

    return {track.pk: track for track in tracks}


def fetch_track_sections_from_payload(payload):
    ids = []
    for route in payload["path"]:
        for track in route["track_sections"]:
            ids.append(track["track_section"])
    return fetch_track_sections(ids)


def line_string_slice(line_string, begin_normalized, end_normalized):
    if begin_normalized > end_normalized:
        # Compute the line string from end to start then reverse the result
        res = line_string_slice(line_string, end_normalized, begin_normalized)
        res.reverse()
        return res

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


def get_geojson_path(payload, track_map):
    geographic, schematic = [], []

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


def parse_steps_input(steps):
    track_ids = []
    for step in steps:
        [track_ids.append(waypoint["track_section"]) for waypoint in step["waypoints"]]
    track_map = fetch_track_sections(track_ids)
    waypoints = []
    step_stop_times = []
    for step in steps:
        step_result = []
        step_stop_times.append(step["stop_time"])
        for waypoint in step["waypoints"]:
            try:
                track = track_map[waypoint["track_section"]]
            except KeyError:
                raise ParseError(
                    f"Track section '{waypoint['track_section']}' doesn't exists"
                )

            geo = geo_transform(track.geo_line_location.geographic)
            offset = geo.project_normalized(Point(waypoint["geo_coordinate"]))
            offset = offset * track.track_section.length
            parsed_waypoint = {
                "track_section": format_track_section_id(track.pk),
                "offset": offset,
            }
            # Allow both direction
            step_result.append({**parsed_waypoint, "direction": "START_TO_STOP"})
            step_result.append({**parsed_waypoint, "direction": "STOP_TO_START"})
        waypoints.append(step_result)

    return waypoints, step_stop_times


def compute_path(path, data, owner):
    infra = data["infra"]

    waypoints, step_stop_times = parse_steps_input(data["steps"])
    payload = request_pathfinding({"infra": infra.pk, "waypoints": waypoints})

    # Post treatment
    payload = payload_reverse_format(payload)
    track_map = fetch_track_sections_from_payload(payload)
    payload = payload_fill_steps(payload, step_stop_times, track_map)
    geographic, schematic = get_geojson_path(payload, track_map)

    path.name = data["name"]
    path.owner = owner
    path.namespace = infra.namespace
    path.payload = payload
    path.geographic = geographic
    path.schematic = schematic

    path.save()


class PathfindingView(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
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
            "steps": path.payload["steps"],
        }

    def retrieve(self, request, pk=None):
        queryset = self.get_queryset().all()
        path = get_object_or_404(queryset, pk=pk)
        return Response(self.format_response(path))

    def update(self, request, pk):
        input_serializer = PathInputSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        data = input_serializer.validated_data
        path = self.get_object()

        compute_path(path, data, self.request.user.sub)
        return Response(self.format_response(path))

    def create(self, request):
        input_serializer = PathInputSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        data = input_serializer.validated_data

        path = Path()
        compute_path(path, data, self.request.user.sub)
        return Response(self.format_response(path))
