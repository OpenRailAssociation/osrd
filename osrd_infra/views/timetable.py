from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.exceptions import ParseError, NotFound
from rest_framework.viewsets import GenericViewSet
from rest_framework import mixins
from django.core.exceptions import ObjectDoesNotExist
from django.conf import settings
from osrd_infra.views.projection import Projection
from osrd_infra.views.railjson import format_route_id
import requests

from osrd_infra.models import (
    Timetable,
    TrainSchedule,
    TrainScheduleResult,
)

from osrd_infra.serializers import (
    TimetableSerializer,
    TrainScheduleSerializer,
    RollingStockSerializer,
)


class TimetableView(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    mixins.ListModelMixin,
    GenericViewSet,
):
    queryset = Timetable.objects.all()
    serializer_class = TimetableSerializer

    def retrieve(request, *args, **kwargs):
        qs = Timetable.objects.prefetch_related("train_schedules").get(pk=kwargs["pk"])
        serializer = TimetableSerializer(qs)
        train_schedules = [train.pk for train in qs.train_schedules.all()]
        return Response({**serializer.data, "train_schedules": train_schedules})


def get_rolling_stock_payload(rolling_stock):
    serializer = RollingStockSerializer(rolling_stock)
    data = dict(serializer.data)
    data.pop("owner")
    data.pop("name")
    data["features"] = data.pop("capabilities")
    data["tractive_effort_curve"] = list(data.pop("tractive_effort_curves").values())[0]
    data["id"] = f"rolling_stock.{data.pop('id')}"
    return data


def get_train_schedule_payload(train_schedule):
    path = train_schedule.path
    phases = []
    # TODO add intermediate phases (op)
    routes = [format_route_id(route["route"]) for route in path.payload["path"]]
    phases.append(
        {
            "type": "navigate",
            "driver_sight_distance": 400,
            "end_location": path.get_end_location(),
            "routes": routes,
        }
    )
    return {
        "id": train_schedule.train_id,
        "rolling_stock": f"rolling_stock.{train_schedule.rolling_stock_id}",
        "departure_time": train_schedule.departure_time,
        "initial_head_location": path.get_initial_location(),
        "initial_route": format_route_id(path.get_initial_route()),
        "initial_speed": train_schedule.initial_speed,
        "phases": phases,
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
        try:
            result = TrainScheduleResult.objects.get(train_schedule=train_schedule)
        except ObjectDoesNotExist:
            raise NotFound(
                f"The train schedule '{pk}' has no result. You should run it first."
            )
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
