import requests
from django.conf import settings
from rest_framework import mixins
from rest_framework.decorators import action
from rest_framework.exceptions import ParseError
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from osrd_infra.serializers import TrainScheduleSerializer
from osrd_infra.views import get_rolling_stock_payload
from osrd_infra.views.projection import Projection
from osrd_infra.utils import geo_transform, reverse_format
from osrd_infra.views.railjson import format_route_id, format_track_section_id
from collections import defaultdict

from osrd_infra.models import (
    TrackSectionEntity,
    TrainSchedule,
    TrainScheduleResult,
    SignalEntity,
    Path,
    entities_prefetch_components,
)


def format_result(train_schedule_result, projection_path):
    train_schedule = train_schedule_result.train_schedule
    logs = classify_logs(train_schedule_result)
    steps = format_steps(logs, train_schedule.path, projection_path)
    return {
        "id": train_schedule_result.train_schedule.pk,
        "name": train_schedule_result.train_schedule.train_name,
        "steps": steps,
        "stops": format_stops(logs, train_schedule),
        "signals": format_signals(train_schedule_result),
    }


def classify_logs(train_schedule_result):
    classification = defaultdict(list)
    for log in train_schedule_result.log:
        classification[log["type"]].append(log)
    return classification


def format_step(
    time,
    speed,
    projection,
    head_track,
    head_offset,
    tail_track,
    tail_offset,
    start_block_occupation,
    end_block_occupation,
):
    assert head_offset <= head_track.track_section.length
    head_offset_normalized = head_offset / head_track.track_section.length
    geo_line = geo_transform(head_track.geo_line_location.geographic)
    schema_line = geo_transform(head_track.geo_line_location.schematic)
    return {
        "time": time,
        "speed": speed,
        "head_position": projection.track_position(head_track.pk, head_offset),
        "tail_position": projection.track_position(tail_track.pk, tail_offset),
        "geo_position": geo_line.interpolate_normalized(head_offset_normalized).tuple,
        "schema_position": schema_line.interpolate_normalized(
            head_offset_normalized
        ).tuple,
        "start_block_occupancy": start_block_occupation,
        "end_block_occupancy": end_block_occupation,
    }


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


def format_steps(logs, train_path, projection_path):
    # Compute projection path
    projection_tracks = []
    tracks = set()
    for route in projection_path.payload["path"]:
        projection_tracks += route["track_sections"]
        [tracks.add(track["track_section"]) for track in route["track_sections"]]
    projection = Projection(projection_tracks)

    # Compute train path
    train_tracks = []
    for route in train_path.payload["path"]:
        train_tracks += route["track_sections"]
        [tracks.add(track["track_section"]) for track in route["track_sections"]]

    # Compute block occupation
    block_occupied = set()
    start_occupancy = []
    end_occupancy = []
    for log in logs["route_status"]:
        if log["status"] == "OCCUPIED":
            track = reverse_format(log["end_track_section"])
            pos = (
                projection.track_position(track, log["end_offset"]) or projection.end()
            )
            start_occupancy.append((log["time"], pos))
            block_occupied.add(log["id"])
        elif log["status"] == "FREE" and log["id"] in block_occupied:
            track = reverse_format(log["end_track_section"])
            pos = projection.track_position(track, log["end_offset"])
            if pos:
                end_occupancy.append((log["time"], pos))
    start_occupancy.append((float("inf"), float("inf")))
    end_occupancy.append((float("inf"), float("inf")))

    res = []
    start_block_occupation = 0
    end_block_occupation = 0
    qs = TrackSectionEntity.objects.filter(pk__in=list(tracks))
    prefetch_tracks = entities_prefetch_components(TrackSectionEntity, qs)
    tracks = {track.pk: track for track in prefetch_tracks}
    step = None
    for log in logs["train_location"]:
        time = log["time"]
        while step and time - step["time"] > 1.0:
            head_track, head_offset = get_move_location(
                train_tracks, step["head_track"].pk, step["head_offset"], step["speed"]
            )
            tail_track, tail_offset = get_move_location(
                train_tracks, step["tail_track"].pk, step["tail_offset"], step["speed"]
            )
            step.update(
                time=step["time"] + 1,
                head_track=tracks[head_track],
                head_offset=head_offset,
                tail_track=tracks[tail_track],
                tail_offset=tail_offset,
            )
            res.append(format_step(**step))

        head_track = tracks[reverse_format(log["head_track_section"])]
        tail_track = tracks[reverse_format(log["tail_track_section"])]

        while time >= start_occupancy[0][0]:
            end_block_occupation = start_occupancy.pop(0)[1]
        while time >= end_occupancy[0][0]:
            start_block_occupation = end_occupancy.pop(0)[1]

        step = {
            "time": time,
            "speed": log["speed"],
            "projection": projection,
            "head_track": head_track,
            "head_offset": log["head_offset"],
            "tail_track": tail_track,
            "tail_offset": log["tail_offset"],
            "start_block_occupation": start_block_occupation,
            "end_block_occupation": end_block_occupation,
        }
        res.append(format_step(**step))
    return res


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
    return [{
        "type": "navigate",
        "driver_sight_distance": 400,
        "end_location": {
            "track_section": format_track_section_id(step_track),
            "offset": steps[-1]["position"]["offset"],
        },
    }]


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
        "routes": [format_route_id(route["route"]) for route in path.payload["path"]],
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

    @action(detail=True, methods=["get"])
    def result(self, request, pk=None):
        train_schedule = self.get_object()
        try:
            result = TrainScheduleResult.objects.get(train_schedule=train_schedule)
        except TrainScheduleResult.DoesNotExist:
            result = self.generate_schedule_result(train_schedule)

        # Retrieve projection path
        projection_path = train_schedule.path
        projection_path_string = request.query_params.get("path", None)
        if projection_path_string:
            projection_path = get_object_or_404(Path, pk=projection_path_string)

        self.generate_schedule_result(train_schedule)
        return Response(format_result(result, projection_path))

    def create(self, request):
        serializer = TrainScheduleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        train_schedule = serializer.save()

        return Response({"id": train_schedule.pk})

    @staticmethod
    def generate_schedule_result(train_schedule):
        payload = {
            "infra": train_schedule.timetable.infra_id,
            "rolling_stocks": [get_rolling_stock_payload(train_schedule.rolling_stock)],
            "train_schedules": [get_train_schedule_payload(train_schedule)],
        }

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
            train_schedule=train_schedule, log=response.json()
        )
        result.save()
        return result
