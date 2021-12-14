import requests
from django.conf import settings
from django.contrib.gis.geos import GEOSGeometry, LineString, Point
from intervaltree import IntervalTree
from rest_framework import mixins
from rest_framework.exceptions import ParseError
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from osrd_infra.models import PathModel, TrackSectionModel
from osrd_infra.serializers import PathInputSerializer, PathSerializer
from osrd_infra.utils import geo_transform, line_string_slice_points, reverse_format


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
        step["position"]["track_section"] = reverse_format(step["position"]["track_section"])
    return payload


def payload_fill_steps(payload, step_stop_times, track_map):
    stop_time_index = 0
    for step in payload["steps"]:
        if not step["suggestion"]:
            step["stop_time"] = step_stop_times[stop_time_index]
            stop_time_index += 1
        else:
            step["stop_time"] = 0

        if "id" in step:
            step["id"] = reverse_format(step["id"])
            """TODO: Fix for new models
            op = OperationalPointEntity.objects.get(entity_id=step["id"])
            step["name"] = op.operational_point.name
            """

        track = track_map[step["position"]["track_section"]]
        offset = step["position"]["offset"] / track.track_section.length

        geo = geo_transform(track.geo_line_location.geographic)
        step["geographic"] = geo.interpolate_normalized(offset).coords

        schema = geo_transform(track.geo_line_location.schematic)
        step["schematic"] = schema.interpolate_normalized(offset).coords

    return payload


def request_pathfinding(payload):
    response = requests.post(
        f"{settings.OSRD_BACKEND_URL}/pathfinding/routes",
        headers={"Authorization": "Bearer " + settings.OSRD_BACKEND_TOKEN},
        json=payload,
    )
    if not response:
        raise ParseError(response.content)
    return response.json()


def fetch_track_sections(ids, infra):
    tracks = TrackSectionModel.objects.filter(obj_id__in=ids, infra=infra)
    return {track.obj_id: track.into_obj() for track in tracks}


def fetch_track_sections_from_payload(payload):
    ids = []
    for route in payload["path"]:
        for track in route["track_sections"]:
            ids.append(track["track_section"])
    return fetch_track_sections(ids)


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

            geographic += line_string_slice_points(geo, begin, end)
            schematic += line_string_slice_points(schema, begin, end)
    return LineString(geographic).json, LineString(schematic).json


def parse_steps_input(steps, infra):
    track_ids = []
    for step in steps:
        [track_ids.append(waypoint["track_section"]) for waypoint in step["waypoints"]]
    track_map = fetch_track_sections(track_ids, infra)
    waypoints = []
    step_stop_times = []
    for step in steps:
        step_result = []
        step_stop_times.append(step["stop_time"])
        for waypoint in step["waypoints"]:
            try:
                track = track_map[waypoint["track_section"]]
            except KeyError:
                raise ParseError(f"Track section '{waypoint['track_section']}' doesn't exists")

            geo = GEOSGeometry(track.geo.json())
            offset = geo.project_normalized(Point(waypoint["geo_coordinate"]))
            offset = offset * track.length
            parsed_waypoint = {
                "track_section": track.id,
                "offset": offset,
            }
            # Allow both direction
            step_result.append({**parsed_waypoint, "direction": "START_TO_STOP"})
            step_result.append({**parsed_waypoint, "direction": "STOP_TO_START"})
        waypoints.append(step_result)

    return waypoints, step_stop_times


def add_chart_point(result, position, value, field_name):
    struct = {"position": position, field_name: value}
    if len(result) < 2 or result[-2][field_name] != result[-1][field_name] or result[-1][field_name] != value:
        result.append(struct)
    else:
        result[-1] = struct


def create_chart(path_payload, track_to_tree, field_name, direction_sensitive=False):
    result = []
    offset = 0
    for route in path_payload:
        for track_range in route["track_sections"]:
            begin = track_range["begin"]
            end = track_range["end"]
            tree = track_to_tree[track_range["track_section"]]
            if begin < end:
                for interval in sorted(tree.overlap(begin, end)):
                    add_chart_point(result, offset, interval.data, field_name)
                    offset += abs(max(begin, interval.begin) - min(end, interval.end))
                    add_chart_point(result, offset, interval.data, field_name)
            else:
                for interval in reversed(sorted(tree.overlap(end, begin))):
                    value = -interval.data if direction_sensitive else interval.data
                    add_chart_point(result, offset, value, field_name)
                    offset += abs(max(end, interval.begin) - min(begin, interval.end))
                    add_chart_point(result, offset, value, field_name)
    return result


def create_tree_from_ranges(range_components, length, get_data, default_value=0):
    tree = IntervalTree()
    tree.addi(0, length, default_value)
    for range_component in range_components:
        start = range_component.start_offset
        end = range_component.end_offset
        if start < end:
            data = get_data(range_component)
            tree.chop(start, end)
            tree.addi(start, end, data)
    return tree


def compute_vmax(payload, track_map):
    tree_vmax = {}
    for track_id, track in track_map.items():
        tree_vmax[track.entity_id] = create_tree_from_ranges(
            track.range_objects.all(),
            track.track_section.length,
            lambda component: component.entity.speed_section_part.speed_section.speed_section.speed,
            -1,
        )
    return create_chart(payload["path"], tree_vmax, "speed")


def compute_slopes(payload, track_map):
    tree_slopes = {}
    for track_id, track in track_map.items():
        tree_slopes[track.entity_id] = create_tree_from_ranges(
            track.slope_set.all(),
            track.track_section.length,
            lambda component: component.gradient,
        )
    return create_chart(payload["path"], tree_slopes, "gradient", direction_sensitive=True)


def compute_curves(payload, track_map):
    tree_curves = {}
    for track_id, track in track_map.items():
        tree_curves[track.entity_id] = create_tree_from_ranges(
            track.curve_set.all(),
            track.track_section.length,
            lambda component: component.radius,
        )
    return create_chart(payload["path"], tree_curves, "radius", direction_sensitive=True)


def compute_path(path, data, owner):
    infra = data["infra"]

    waypoints, step_stop_times = parse_steps_input(data["steps"], infra)
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
    path.vmax = compute_vmax(payload, track_map)
    path.curves = compute_curves(payload, track_map)
    path.slopes = compute_slopes(payload, track_map)

    path.save()


class PathfindingView(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    GenericViewSet,
):
    serializer_class = PathSerializer
    queryset = PathModel.objects.order_by("-created")

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

        path = PathModel()
        compute_path(path, data, self.request.user.sub)
        return Response(self.format_response(path), status=201)
