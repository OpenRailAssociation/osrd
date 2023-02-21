import json
from collections import defaultdict
from typing import Mapping

import requests
from django.conf import settings
from django.contrib.gis.geos import LineString, Point
from intervaltree import IntervalTree
from osrd_schemas.infra import Direction, TrackSection
from osrd_schemas.path import PathPayload
from rest_framework import mixins
from rest_framework.decorators import action
from rest_framework.exceptions import APIException
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from osrd_infra.models import OperationalPointModel, PathModel, TrackSectionModel
from osrd_infra.serializers import (
    PathInputSerializer,
    PathOPInputSerializer,
    PathSerializer,
)
from osrd_infra.utils import make_exception_from_error


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
        op_id = path_waypoint.get("id", None)
        if op_id is not None:
            op = OperationalPointModel.objects.get(infra=infra, obj_id=op_id).into_obj()
            identifier = op.extensions.identifier
            if identifier is not None:
                path_waypoint["name"] = identifier.name

        # Add geometry
        track = track_map[path_waypoint["track"]]
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
            ids.append(track["track"])
    return fetch_track_sections(infra, ids)


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
            step_result += parse_waypoint(waypoint, track_map)
        waypoints.append(step_result)

    return waypoints, step_durations


def parse_steps_op_input(steps, infra):
    # Fetch operational points
    ops = {}
    for op in OperationalPointModel.objects.filter(infra=infra):
        if "extensions" in op.data and "sncf" in op.data["extensions"]:
            ops[op.data["extensions"]["sncf"]["trigram"]] = op

    waypoints = []
    step_durations = []
    for step in steps:
        step_durations.append(step["duration"])
        step_result = []
        waypoints.append(step_result)
        if step["op_trigram"] not in ops:
            continue
        for part in ops[step["op_trigram"]].data["parts"]:
            waypoint = {"track_section": part["track"], "offset": part["position"]}
            step_result += [
                {**waypoint, "direction": Direction.START_TO_STOP.value},
                {**waypoint, "direction": Direction.STOP_TO_START.value},
            ]

    return waypoints, step_durations


def parse_waypoint(waypoint, track_map):
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
    return [
        {**parsed_waypoint, "direction": "START_TO_STOP"},
        {**parsed_waypoint, "direction": "STOP_TO_START"},
    ]


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
            tree = track_to_tree[track_range.track]
            if track_range.direction == Direction.START_TO_STOP:
                for interval in sorted(tree.overlap(track_range.begin, track_range.end)):
                    add_chart_point(result, offset, interval.data, field_name)
                    offset += abs(max(track_range.begin, interval.begin) - min(track_range.end, interval.end))
                    add_chart_point(result, offset, interval.data, field_name)
            else:
                for interval in reversed(sorted(tree.overlap(track_range.begin, track_range.end))):
                    value = -interval.data if direction_sensitive else interval.data
                    add_chart_point(result, offset, value, field_name)
                    offset += abs(max(track_range.begin, interval.begin) - min(track_range.end, interval.end))
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


def postprocess_path(path, payload, infra, owner, step_durations):
    path.geographic = json.dumps(payload.pop("geographic"))
    path.schematic = json.dumps(payload.pop("schematic"))

    # Post treatment
    track_map = fetch_track_sections_from_payload(infra, payload)
    payload = compute_path_payload(infra, payload, step_durations, track_map)

    path.owner = owner
    path.infra = infra
    path.payload = payload.dict()
    path.curves = compute_curves(payload, track_map)
    path.slopes = compute_slopes(payload, track_map)

    path.save()


def compute_path(path, request_data, owner):
    infra = request_data["infra"]
    rolling_stocks = request_data.get("rolling_stocks", [])

    waypoints, step_durations = parse_steps_input(request_data["steps"], infra)
    payload = request_pathfinding(
        {
            "infra": infra.pk,
            "expected_version": infra.version,
            "waypoints": waypoints,
            "rolling_stocks": [rs.to_schema().dict() for rs in rolling_stocks],
        }
    )
    postprocess_path(path, payload, infra, owner, step_durations)


def compute_path_op(path, request_data, owner):
    infra = request_data["infra"]
    rolling_stocks = request_data.get("rolling_stocks", [])

    waypoints, step_durations = parse_steps_op_input(request_data["steps"], infra)
    payload = request_pathfinding(
        {
            "infra": infra.pk,
            "expected_version": infra.version,
            "waypoints": waypoints,
            "rolling_stocks": [rs.to_schema().dict() for rs in rolling_stocks],
        }
    )
    postprocess_path(path, payload, infra, owner, step_durations)


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

    @action(detail=False, methods=["post"])
    def op(self, request):
        """
        This endpoint is a used for a proof of concept and shouldn't be used in production.
        Create a pathfinding given a list of operational points trigram
        """
        input_serializer = PathOPInputSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        request_data = input_serializer.validated_data

        path = PathModel()
        compute_path_op(path, request_data, self.request.user.sub)
        return Response(self.format_response(path), status=201)
