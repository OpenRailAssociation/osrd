import requests
from django.conf import settings
from django.http import Http404
from rest_framework import mixins
from rest_framework.decorators import action
from rest_framework.exceptions import ParseError
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from osrd_infra.serializers import TrainScheduleSerializer
from osrd_infra.views.projection import Projection
from osrd_infra.utils import geo_transform, reverse_format
from osrd_infra.views.railjson import format_route_id, format_track_section_id
from collections import defaultdict

from osrd_infra.models import (
    TrainSchedule,
    TrainScheduleResult,
    SignalEntity,
    Path,
    entities_prefetch_components,
)


def compute_projection(projection_path):
    projection_tracks = []
    for route in projection_path.payload["path"]:
        projection_tracks += route["track_sections"]
    return Projection(projection_tracks)


def format_result(train_schedule_result, projection_path):
    train_schedule = train_schedule_result.train_schedule
    logs = classify_logs(train_schedule_result)

    # Compute projection object
    projection = compute_projection(projection_path)

    # Format data for charts
    head_positions = format_head_positions(logs["train_location"], projection)
    tail_positions = format_tail_positions(logs["train_location"], projection)
    speeds = format_speeds(logs["train_location"], train_schedule.path)
    end_time = head_positions[-1][-1]["time"]
    route_begin_occupancy, route_end_occupancy = format_route_occupancy(
        logs["route_status"], projection_path, projection, end_time
    )

    return {
        "id": train_schedule_result.train_schedule.pk,
        "labels": [label.label for label in train_schedule.labels.all()],
        "path": train_schedule.path_id,
        "name": train_schedule_result.train_schedule.train_name,
        "stops": format_stops(logs, train_schedule),
        "signals": format_signals(train_schedule_result),
        "head_positions": head_positions,
        "tail_positions": tail_positions,
        "route_begin_occupancy": route_begin_occupancy,
        "route_end_occupancy": route_end_occupancy,
        "speeds": speeds,
    }


def classify_logs(train_schedule_result):
    classification = defaultdict(list)
    for log in train_schedule_result.log:
        classification[log["type"]].append(log)
    return classification


def get_move_location(path, track_id, offset, distance, start=0):
    for i in range(start, len(path)):
        if path[i]["track_section"] != track_id:
            continue
        if offset < path[i]["begin"] and offset < path[i]["end"]:
            continue
        if offset > path[i]["begin"] and offset > path[i]["end"]:
            continue
        if distance <= abs(path[i]["end"] - offset):
            if path[i]["end"] > path[i]["begin"]:
                return path[i]["track_section"], offset + distance
            return path[i]["track_section"], offset - distance
        return get_move_location(
            path,
            path[i + 1]["track_section"],
            path[i + 1]["begin"],
            distance - abs(path[i]["end"] - offset),
            i + 1,
        )
    raise ParseError("Internal error: interpolation exceed end path location")


def format_train_positions(train_locations, projection, field_name):
    results = [[]]
    for log in train_locations:
        time = log["time"]
        head_track = reverse_format(log[f"{field_name}_track_section"])
        head_offset = log[f"{field_name}_offset"]
        position = projection.track_position(head_track, head_offset)
        if position is None:
            if len(results[-1]) > 0:
                results.append([])
            continue
        results[-1].append({"time": time, "position": position})
    return results


def format_head_positions(train_locations, projection):
    return format_train_positions(train_locations, projection, "head")


def format_tail_positions(train_locations, projection):
    return format_train_positions(train_locations, projection, "tail")


def format_speeds(train_locations, train_path):
    projection = compute_projection(train_path)
    results = []
    for log in train_locations:
        head_track = reverse_format(log["head_track_section"])
        head_offset = log["head_offset"]
        position = projection.track_position(head_track, head_offset)
        assert position is not None
        results.append({"position": position, "speed": log["speed"]})
    return results


def format_route_occupancy(route_status, projection_path, projection, end_time):
    route_path = set()
    for route in projection_path.payload["path"]:
        route_path.add(route["route"])

    route_begin_occupancy = []
    route_end_occupancy = []
    occupied_route = {}
    for log in route_status:
        route_id = reverse_format(log["id"])
        if route_id not in route_path:
            continue
        time = log["time"]

        end_track = reverse_format(log["end_track_section"])
        end_offset = log["end_offset"]
        end_position = projection.track_position(end_track, end_offset)
        if end_position is None:
            end_position = projection.end()

        begin_track = reverse_format(log["start_track_section"])
        begin_offset = log["start_offset"]
        begin_position = projection.track_position(begin_track, begin_offset)
        if begin_position is None:
            begin_position = 0

        if log["status"] in ("OCCUPIED", "CONFLICT", "CBTC_OCCUPIED"):
            occupied_route[route_id] = (begin_position, end_position)
            route_end_occupancy.append(
                {
                    "time": time,
                    "position": max((pos for _, pos in occupied_route.values())),
                }
            )
            if len(route_begin_occupancy) == 0:
                route_begin_occupancy.append({"time": time, "position": begin_position})
        elif log["status"] == "FREE":
            occupied_route.pop(route_id)
            route_begin_occupancy.append(
                {
                    "time": time,
                    "position": min((pos for pos, _ in occupied_route.values())),
                }
            )
    if occupied_route:
        route_begin_occupancy.append(
            {
                "time": end_time,
                "position": min((pos for pos, _ in occupied_route.values())),
            }
        )
        route_end_occupancy.append(
            {
                "time": end_time,
                "position": max((pos for pos, _ in occupied_route.values())),
            }
        )
    return route_begin_occupancy, route_end_occupancy


def format_stops(logs, train_schedule):
    path = train_schedule.path.payload
    phase_times = {}
    for log in logs["stop_reached"]:
        phase_times[log["stop_index"] + 1] = log["time"]
    stops = [
        {
            "name": path["steps"][0]["name"],
            "time": train_schedule.departure_time,
            "stop_time": 0,
        }
    ]
    for phase_index in range(1, len(path["steps"])):
        assert phase_index in phase_times
        stops.append(
            {
                "name": path["steps"][phase_index]["name"],
                "time": phase_times[phase_index],
                "stop_time": path["steps"][phase_index]["stop_time"],
            }
        )
    return stops


def format_signals(train_schedule_result):
    signals = {}
    signals_id = []
    for log in train_schedule_result.log:
        if log["type"] == "signal_change":
            signal_id = reverse_format(log["signal"])
            signals_id.append(signal_id)
            aspects = [reverse_format(aspect) for aspect in log["aspects"]]
            signals.append(
                {
                    "signal_id": signal_id,
                    "aspects": aspects,
                }
            )
    qs = SignalEntity.objects.filter(pk__in=signals_id)
    prefetch_signals = {e.pk: e for e in entities_prefetch_components(SignalEntity, qs)}
    for signal in signals:
        location = prefetch_signals[signal["signal"]].geo_point_location
        signal["geo_position"] = geo_transform(location.geographic).json
        signal["schema_position"] = geo_transform(location.schematic).json
    return signals


def get_train_phases(path):
    steps = path.payload["steps"]
    step_track = steps[-1]["position"]["track_section"]
    return [
        {
            "type": "navigate",
            "driver_sight_distance": 400,
            "end_location": {
                "track_section": format_track_section_id(step_track),
                "offset": steps[-1]["position"]["offset"],
            },
        }
    ]


def get_train_stops(path):
    stops = []
    steps = path.payload["steps"]
    for step_index in range(1, len(steps)):
        step_track = steps[step_index]["position"]["track_section"]
        stops.append(
            {
                "location": {
                    "track_section": format_track_section_id(step_track),
                    "offset": steps[step_index]["position"]["offset"],
                },
                "duration": steps[step_index]["stop_time"],
            }
        )
    return stops


def convert_route_list_for_simulation(path):
    """
    Generates a list of route for the simulation using the path data
    """
    res = []
    for route in path.payload["path"]:
        route_str = format_route_id(route["route"])
        # We need to drop duplicates because the path is split at each step,
        # making it possible to have an input such as :
        # [{route: 1, track_sections: [1, 2]}, {route: 1, track_sections: [2, 3, 4]}]
        if len(res) == 0 or res[-1] != route_str:
            res.append(route_str)
    return res


def get_train_schedule_payload(train_schedule):
    path = train_schedule.path
    return {
        "id": train_schedule.train_name,
        "rolling_stock": f"rolling_stock.{train_schedule.rolling_stock_id}",
        "departure_time": train_schedule.departure_time,
        "initial_head_location": path.get_initial_location(),
        "initial_route": format_route_id(path.get_initial_route()),
        "initial_speed": train_schedule.initial_speed,
        "phases": get_train_phases(path),
        "routes": convert_route_list_for_simulation(path),
        "stops": get_train_stops(path),
    }


class TrainScheduleView(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    GenericViewSet,
):
    queryset = TrainSchedule.objects.all()
    serializer_class = TrainScheduleSerializer

    @staticmethod
    def convert_result(train_schedule, result, path):
        # Retrieve projection path
        projection_path = train_schedule.path
        projection_path_string = path
        if projection_path_string:
            projection_path = get_object_or_404(Path, pk=projection_path_string)

        return format_result(result, projection_path)

    def update(self, request, *args, **kwargs):
        train_schedule = self.get_object()
        serializer = self.get_serializer(train_schedule, data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        self.generate_schedule_result(train_schedule)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def result(self, request, pk=None):
        train_schedule = self.get_object()
        try:
            result = TrainScheduleResult.objects.get(train_schedule=train_schedule)
        except TrainScheduleResult.DoesNotExist:
            result = self.generate_schedule_result(train_schedule)

        return Response(
            self.convert_result(
                train_schedule, result, request.query_params.get("path", None)
            )
        )

    @action(detail=False, methods=["post"])
    def results(self, request):
        if type(request.data) is not list:
            raise ParseError(
                f"Request data expected 'list' but got '{type(request.data).__name__}'"
            )
        if len(request.data) == 0:
            raise ParseError("Request data expected non empty 'list'")
        for train_id in request.data:
            if type(train_id) is not int:
                raise ParseError(
                    f"Request data expected list of 'int' but got list of '{type(train_id).__name__}'"
                )
        train_ids = request.data

        schedules = TrainSchedule.objects.filter(pk__in=train_ids).prefetch_related(
            "output"
        )
        if len(schedules) != len(train_ids):
            raise Http404("Some train schedule couldn't be found")

        schedules_map = {schedule.id: schedule for schedule in schedules}
        path = request.query_params.get("path", schedules_map[train_ids[0]].path_id)
        res = []
        for train_id in train_ids:
            train_schedule = schedules_map[train_id]
            result = train_schedule.output.get()
            res.append(self.convert_result(train_schedule, result, path))
        return Response(res)

    def create(self, request):
        serializer = TrainScheduleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        train_schedule = serializer.save()

        self.generate_schedule_result(train_schedule)
        return Response({"id": train_schedule.pk})

    @staticmethod
    def generate_schedule_result(train_schedule):
        payload = {
            "infra": train_schedule.timetable.infra_id,
            "rolling_stocks": [train_schedule.rolling_stock.to_railjson()],
            "train_schedules": [get_train_schedule_payload(train_schedule)],
        }
        TrainScheduleResult.objects.filter(train_schedule=train_schedule).delete()

        try:
            response = requests.post(
                settings.OSRD_BACKEND_URL + "simulation",
                headers={"Authorization": "Bearer " + settings.OSRD_BACKEND_TOKEN},
                json=payload,
            )
        except requests.exceptions.ConnectionError:
            raise ParseError("Couldn't connect with osrd backend")

        if not response:
            raise ParseError(response.content)
        result, _ = TrainScheduleResult.objects.get_or_create(
            train_schedule=train_schedule, defaults={"log": {}}
        )
        result.log = response.json()
        result.save()
        return result
