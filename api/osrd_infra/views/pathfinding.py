import json
from collections import defaultdict
from typing import Mapping
from pydantic import Json

import requests
from django.conf import settings
from django.contrib.gis.geos import LineString, Point
from intervaltree import IntervalTree
from rest_framework import mixins
from rest_framework.exceptions import APIException
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from osrd_infra.models import OperationalPointModel, PathModel, TrackSectionModel
from osrd_infra.schemas.infra import Direction, TrackSection
from osrd_infra.schemas.path import PathPayload
from osrd_infra.serializers import PathInputSerializer, PathSerializer
from osrd_infra.utils import line_string_slice_points, make_exception_from_error


class InternalPathfindingError(APIException):
    status_code = 500
    default_detail = "An internal pathfinding error occurred"
    default_code = "internal_pathfinding_error"


class InvalidPathfindingInput(APIException):
    status_code = 400
    default_detail = "The pathfinding had invalid inputs"
    default_code = "pathfinding_invalid_input"


def compute_path_payload(infra, back_payload, step_durations, track_map) -> PathPayload:
    # Adapt steps from back format to middle
    duration_index = 0
    for path_waypoint in back_payload["path_waypoints"]:
        # Add stop time
        if not path_waypoint["suggestion"]:
            path_waypoint["duration"] = step_durations[duration_index]
            duration_index += 1
        else:
            path_waypoint["duration"] = 0

        # Retrieve name from operation point ID
        op_id = path_waypoint.pop("id", None)
        if op_id is not None:
            op = OperationalPointModel.objects.get(infra=infra, obj_id=op_id).into_obj()
            path_waypoint["name"] = op.name

        # Add geometry
        track = track_map[path_waypoint["track"]["id"]]
        norm_offset = path_waypoint["position"] / track["length"]

        path_waypoint["geo"] = json.loads(track["geo"].interpolate_normalized(norm_offset).json)
        path_waypoint["sch"] = json.loads(track["sch"].interpolate_normalized(norm_offset).json)

    return PathPayload.parse_obj(back_payload)


def request_pathfinding(payload):
    response = requests.post(
        f"{settings.OSRD_BACKEND_URL}/pathfinding/routes",
        headers={"Authorization": "Bearer " + settings.OSRD_BACKEND_TOKEN},
        json=payload,
    )
    if not response:
        raise make_exception_from_error(response, InvalidPathfindingInput, InternalPathfindingError)
    return response.json()


def fetch_track_sections(infra, ids):
    tracks = TrackSectionModel.objects.filter(obj_id__in=ids, infra=infra)
    res = {}
    for track in tracks:
        # Avoid recompute line string each time
        track.data["geo"] = LineString(track.data["geo"]["coordinates"])
        track.data["sch"] = LineString(track.data["sch"]["coordinates"])
        res[track.obj_id] = track.data
    return res


def fetch_track_sections_from_payload(infra, payload):
    ids = []
    for route in payload["route_paths"]:
        for track in route["track_sections"]:
            ids.append(track["track"]["id"])
    return fetch_track_sections(infra, ids)


def get_geojson_path(payload: PathPayload, track_map: Mapping[str, TrackSection]):
    geographic, schematic = [], []

    for path_step in payload.route_paths:
        for track_range in path_step.track_sections:
            track = track_map[track_range.track.id]

            # normalize positions
            norm_begin = track_range.begin / track["length"]
            norm_end = track_range.end / track["length"]
            assert norm_begin >= 0.0 and norm_begin <= 1.0
            assert norm_end >= 0.0 and norm_end <= 1.0

            geographic += line_string_slice_points(track["geo"], norm_begin, norm_end)
            schematic += line_string_slice_points(track["sch"], norm_begin, norm_end)
    res = LineString(geographic).json, LineString(schematic).json
    return res


def parse_steps_input(steps, infra):
    track_ids = []
    for step in steps:
        [track_ids.append(waypoint["track_section"]) for waypoint in step["waypoints"]]
    track_map = fetch_track_sections(infra, track_ids)
    waypoints = []
    step_durations = []
    for step in steps:
        step_result = []
        step_durations.append(step["duration"])
        for waypoint in step["waypoints"]:
            try:
                track = track_map[waypoint["track_section"]]
            except KeyError:
                raise InvalidPathfindingInput(f"Track section '{waypoint['track_section']}' doesn't exists")
            if "geo_coordinate" in waypoint:
                offset = track["geo"].project_normalized(Point(waypoint["geo_coordinate"]))
                offset = offset * track["length"]
            elif "offset" in waypoint:
                offset = waypoint["offset"]
            else:
                raise InvalidPathfindingInput("waypoint missing offset or geo_coordinate")
            parsed_waypoint = {
                "track_section": track["id"],
                "offset": offset,
            }
            # Allow both direction
            step_result.append({**parsed_waypoint, "direction": "START_TO_STOP"})
            step_result.append({**parsed_waypoint, "direction": "STOP_TO_START"})
        waypoints.append(step_result)

    return waypoints, step_durations


def add_chart_point(result, position, value, field_name):
    point = {"position": position, field_name: value}
    if len(result) < 2 or result[-2][field_name] != result[-1][field_name] or result[-1][field_name] != value:
        result.append(point)
    else:
        result[-1] = point


def create_chart(path_steps, track_to_tree, field_name, direction_sensitive=False):
    result = []
    offset = 0
    for route in path_steps:
        for track_range in route.track_sections:
            tree = track_to_tree[track_range.track.id]
            if track_range.direction == Direction.START_TO_STOP:
                for interval in sorted(tree.overlap(track_range.begin, track_range.end)):
                    add_chart_point(result, offset, interval.data, field_name)
                    offset += abs(max(track_range.begin, interval.begin) - min(track_range.end, interval.end))
                    add_chart_point(result, offset, interval.data, field_name)
            else:
                for interval in reversed(sorted(tree.overlap(track_range.end, track_range.begin))):
                    value = -interval.data if direction_sensitive else interval.data
                    add_chart_point(result, offset, value, field_name)
                    offset += abs(max(track_range.end, interval.begin) - min(track_range.begin, interval.end))
                    add_chart_point(result, offset, value, field_name)
    return result


def compute_slopes(payload: PathPayload, track_map: Mapping[str, TrackSection]):
    trees = defaultdict(IntervalTree)
    for track_id, track in track_map.items():
        trees[track_id].addi(0, track["length"], 0)
        for slope_section in track["slopes"]:
            assert slope_section["begin"] < slope_section["end"]
            trees[track_id].chop(slope_section["begin"], slope_section["end"])
            trees[track_id].addi(slope_section["begin"], slope_section["end"], slope_section["gradient"])
    return create_chart(payload.route_paths, trees, "gradient", direction_sensitive=True)


def compute_curves(payload: PathPayload, track_map: Mapping[str, TrackSection]):
    trees = defaultdict(IntervalTree)
    for track_id, track in track_map.items():
        trees[track_id].addi(0, track["length"], 0)
        for curve_section in track["curves"]:
            assert curve_section["begin"] < curve_section["end"]
            trees[track_id].chop(curve_section["begin"], curve_section["end"])
            trees[track_id].addi(curve_section["begin"], curve_section["end"], curve_section["radius"])
    return create_chart(payload.route_paths, trees, "radius", direction_sensitive=True)


def compute_path(path, request_data, owner):
    infra = request_data["infra"]

    waypoints, step_durations = parse_steps_input(request_data["steps"], infra)
    payload = request_pathfinding({"infra": infra.pk, "waypoints": waypoints})
    path.geographic = json.dumps(payload.pop("geo_geom"))
    path.schematic = json.dumps(payload.pop("sch_geom"))

    # Post treatment
    track_map = fetch_track_sections_from_payload(infra, payload)
    payload = compute_path_payload(infra, payload, step_durations, track_map)
    # geographic, schematic = get_geojson_path(payload, track_map)

    path.owner = owner
    path.infra = infra
    path.payload = payload.dict()
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
            # TODO: change steps to path_waypoints need front modifications
            "steps": path.payload["path_waypoints"],
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
        request_data = input_serializer.validated_data

        path = PathModel()
        compute_path(path, request_data, self.request.user.sub)
        return Response(self.format_response(path), status=201)
