from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet
from rest_framework import mixins
from osrd_infra.views.railjson import format_route_id

from osrd_infra.models import Timetable

from osrd_infra.serializers import (
    TimetableSerializer,
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

    def retrieve(self, request, pk):
        timetable = self.get_object()
        serializer = TimetableSerializer(timetable)
        train_schedules = [
            {
                "id": train.pk,
                "train_name": train.train_name,
                "departure_time": train.departure_time,
            }
            for train in timetable.train_schedules.all()
        ]
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
        "id": train_schedule.train_name,
        "rolling_stock": f"rolling_stock.{train_schedule.rolling_stock_id}",
        "departure_time": train_schedule.departure_time,
        "initial_head_location": path.get_initial_location(),
        "initial_route": format_route_id(path.get_initial_route()),
        "initial_speed": train_schedule.initial_speed,
        "phases": phases,
    }
