from django.http import Http404
from rest_framework import mixins
from rest_framework.decorators import action
from rest_framework.exceptions import ParseError
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from osrd_infra.serializers import TrainScheduleSerializer
from osrd_infra.views.convert_simulation_log import convert_simulation_log
from osrd_infra.views.simulation_log import generate_simulation_log

from osrd_infra.models import (
    TrainSchedule,
    Path,
)


def cache_simulation_logs(train_schedule):
    if train_schedule.base_simulation_log is None:
        generate_simulation_log(train_schedule)


class TrainScheduleView(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    GenericViewSet,
):
    queryset = TrainSchedule.objects.all()
    serializer_class = TrainScheduleSerializer

    def update(self, request, *args, **kwargs):
        train_schedule = self.get_object()
        serializer = self.get_serializer(train_schedule, data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        generate_simulation_log(train_schedule)
        return Response(serializer.data)

    @action(detail=True)
    def result(self, request, pk=None):
        train_schedule = self.get_object()
        cache_simulation_logs(train_schedule)

        path_id = request.query_params.get("path", train_schedule.path_id)
        path = get_object_or_404(Path, pk=path_id)
        res = convert_simulation_log(train_schedule, path)
        return Response(res)

    @action(detail=False)
    def results(self, request):
        train_ids = request.query_params.get("train_ids", None)
        path_id = request.query_params.get("path", None)
        # parse the list of train_ids
        if train_ids is None:
            raise ParseError("missing train_ids")
        try:
            train_ids = [int(train_id) for train_id in train_ids.split(",")]
        except ValueError as e:
            raise ParseError("invalid train_ids list") from e
        train_ids_set = set(train_ids)
        if len(train_ids_set) != len(train_ids):
            raise ParseError("duplicate train_ids")

        # get the schedules from database
        schedules = TrainSchedule.objects.filter(pk__in=train_ids)

        # if some schedules were not found, raise an error
        schedules_map = {schedule.id: schedule for schedule in schedules}
        missing_schedules = train_ids_set.difference(schedules_map.keys())
        if missing_schedules:
            raise Http404(
                f"Invalid schedule IDs: {', '.join(map(str, missing_schedules))}"
            )

        # if there's no path argument, use the path of the first train
        if path_id is not None:
            path = get_object_or_404(Path, pk=path_id)
        else:
            path = schedules_map[train_ids[0]].path

        res = []
        for train_id in train_ids:
            train_schedule = schedules_map[train_id]

            # ensure there's a simulation log for this schedule
            cache_simulation_logs(train_schedule)

            # convert the simulation result to something frontend-friendly
            res.append(convert_simulation_log(train_schedule, path))
        return Response(res)

    def create(self, request):
        serializer = TrainScheduleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        train_schedule = serializer.save()

        cache_simulation_logs(train_schedule)
        return Response({"id": train_schedule.pk})
