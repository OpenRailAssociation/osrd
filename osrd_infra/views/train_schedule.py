import requests
from django.conf import settings
from rest_framework import mixins
from rest_framework.decorators import action
from rest_framework.exceptions import ParseError
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from osrd_infra.serializers import TrainScheduleSerializer
from osrd_infra.views import get_rolling_stock_payload, get_train_schedule_payload
from osrd_infra.views.projection import Projection
from osrd_infra.utils import geo_transform, reverse_format

from osrd_infra.models import (
    TrackSectionEntity,
    TrainSchedule,
    TrainScheduleResult,
    SignalEntity,
    entities_prefetch_components,
)


def format_result(train_schedule_result):
    steps = format_steps(train_schedule_result)
    return {
        "id": train_schedule_result.train_schedule.pk,
        "name": train_schedule_result.train_schedule.train_name,
        "steps": steps,
        "stops": format_stops(train_schedule_result, steps),
        "signals": format_signals(train_schedule_result),
    }


def format_steps(train_schedule_result):
    routes = train_schedule_result.train_schedule.path.payload["path"]

    # Compute projection
    path = []
    tracks = set()
    for route in routes:
        path += route["track_sections"]
        [tracks.add(track["track_section"]) for track in route["track_sections"]]
    projection = Projection(path)

    # Compute block occupation
    start_occupancy = []
    end_occupancy = []
    for log in train_schedule_result.log:
        if log["type"] != "route_status":
            continue
        if log["status"] == "OCCUPIED":
            track = reverse_format(log["end_track_section"])
            pos = (
                projection.track_position(track, log["end_offset"]) or projection.end()
            )
            start_occupancy.append((log["time"], pos))
        elif log["status"] == "FREE":
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
    for log in train_schedule_result.log:
        if log["type"] != "train_location":
            continue
        time = log["time"]
        head_track_id = reverse_format(log["head_track_section"])
        tail_track_id = reverse_format(log["tail_track_section"])
        head_track = tracks[head_track_id]
        geo_line = geo_transform(head_track.geo_line_location.geographic)
        schema_line = geo_transform(head_track.geo_line_location.schematic)
        head_offset_normalized = log["head_offset"] / head_track.track_section.length

        while time >= start_occupancy[0][0]:
            end_block_occupation = start_occupancy.pop(0)[1]
        while time >= end_occupancy[0][0]:
            start_block_occupation = end_occupancy.pop(0)[1]

        res.append(
            {
                "time": time,
                "speed": log["speed"],
                "head_position": projection.track_position(
                    head_track_id, log["head_offset"]
                ),
                "tail_position": projection.track_position(
                    tail_track_id, log["tail_offset"]
                ),
                "geo_position": geo_line.interpolate_normalized(
                    head_offset_normalized
                ).tuple,
                "schema_position": schema_line.interpolate_normalized(
                    head_offset_normalized
                ).tuple,
                "start_block_occupancy": start_block_occupation,
                "end_block_occupancy": end_block_occupation,
            }
        )
    return res


def format_stops(train_schedule_result, steps):
    op_times = {}
    for log in train_schedule_result.log:
        if log["type"] == "operational_point":
            op_id = reverse_format(log["operational_point"])
            op_times[op_id] = log["time"]
    stops = [
        {
            "name": "start",
            "time": train_schedule_result.train_schedule.departure_time,
            "stop_time": 0,
        }
    ]
    """ TODO: Add stops using path
    for phase in train_schedule_result.train_schedule.phases:
        stops.append(
            {
                "name": phase["operational_point"],
                "time": op_times.get(phase["operational_point"], float("nan")),
                "stop_time": phase["stop_time"],
            }
        )
    """
    stops.append(
        {
            "name": "stop",
            "time": steps[-1]["time"],
            "stop_time": 0,
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
        result = get_object_or_404(TrainScheduleResult, train_schedule=train_schedule)
        return Response(format_result(result))

    def create(self, request):
        serializer = TrainScheduleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        train_schedule = serializer.save()

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
        return Response(format_result(result))
