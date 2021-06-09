import requests
from django.conf import settings
from rest_framework import mixins
from rest_framework.decorators import action
from rest_framework.exceptions import ParseError
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from osrd_infra.models import TrainSchedule, TrainScheduleResult
from osrd_infra.serializers import TrainScheduleSerializer
from osrd_infra.views import get_rolling_stock_payload, get_train_schedule_payload, Projection


class TrainScheduleView(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    GenericViewSet,
):
    queryset = TrainSchedule.objects.all()
    serializer_class = TrainScheduleSerializer

    def format_steps(train_schedule_result):
        routes = train_schedule_result.train_schedule.path.payload["path"]
        path = []
        for route in routes:
            path += route["track_sections"]
        projection = Projection(path)
        res = []
        for log in train_schedule_result.log:
            if log["type"] != "train_location":
                continue
            head_track_id = int(log["head_track_section"].split(".")[1])
            tail_track_id = int(log["tail_track_section"].split(".")[1])
            res.append(
                {
                    "time": log["time"],
                    "speed": log["speed"],
                    "head_position": projection.track_position(
                        head_track_id, log["head_offset"]
                    ),
                    "tail_position": projection.track_position(
                        tail_track_id, log["tail_offset"]
                    ),
                }
            )

        return res

    def format_stops(train_schedule_result, steps):
        op_times = {}
        for log in train_schedule_result.log:
            if log["type"] == "operational_point":
                op_id = int(log["operational_point"].split(".")[1])
                op_times[op_id] = log["time"]
        stops = [
            {
                "name": "start",
                "time": train_schedule_result.train_schedule.departure_time,
                "stop_time": 0,
            }
        ]
        for phase in train_schedule_result.train_schedule.phases:
            stops.append(
                {
                    "name": phase["operational_point"],
                    "time": op_times.get(phase["operational_point"], float("nan")),
                    "stop_time": phase["stop_time"],
                }
            )
        stops.append(
            {
                "name": "stop",
                "time": steps[-1]["time"],
                "stop_time": 0,
            }
        )

        return stops

    def format_result(train_schedule_result):
        steps = TrainScheduleView.format_steps(train_schedule_result)
        return {
            "name": train_schedule_result.train_schedule.train_id,
            "steps": steps,
            "stops": TrainScheduleView.format_stops(train_schedule_result, steps),
        }

    @action(detail=True, methods=["get"])
    def result(self, request, pk=None):
        train_schedule = self.get_object()
        result = get_object_or_404(TrainScheduleResult, train_schedule=train_schedule)
        return Response(TrainScheduleView.format_result(result))

    @action(detail=True, methods=["post"])
    def run(self, request, pk=None):
        train_schedule = self.get_object()
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
        result, _ = TrainScheduleResult.objects.get_or_create(train_schedule=train_schedule)
        result.log = response.json()
        result.save()
        return Response(TrainScheduleView.format_result(result))
