from django.http import Http404
from rest_framework import mixins
from rest_framework.decorators import action
from rest_framework.exceptions import ParseError
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from osrd_infra.models import PathModel, TrainScheduleModel
from osrd_infra.serializers import (
    StandaloneSimulationSerializer,
    TrainScheduleSerializer,
)

from .standalone_simulation import (
    create_backend_request_payload,
    process_simulation_response,
    run_simulation,
)
from .standalone_simulation_report import create_simulation_report


class TrainScheduleView(
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    GenericViewSet,
):
    queryset = TrainScheduleModel.objects.all()
    serializer_class = TrainScheduleSerializer

    def update(self, request, *args, **kwargs):
        train_schedule: TrainScheduleModel = self.get_object()
        serializer = self.get_serializer(train_schedule, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        # Check if a new simulation must be done
        data = serializer.validated_data
        simulation_needed = False
        if "rolling_stock" in data and data["rolling_stock"] != train_schedule.rolling_stock.pk:
            simulation_needed = True
        elif "path" in data and data["path"] != train_schedule.path.pk:
            simulation_needed = True
        elif "initial_speed" in data and data["initial_speed"] != train_schedule.initial_speed:
            simulation_needed = True
        elif "allowances" in data and data["allowances"] != train_schedule.allowances:
            simulation_needed = True

        serializer.save()

        if not simulation_needed:
            return Response(serializer.data)

        # Create backend request payload
        request_payload = create_backend_request_payload([train_schedule])
        # Run standalone simulation
        response_payload = run_simulation(request_payload)
        # Process simulation response
        process_simulation_response([train_schedule], response_payload)
        train_schedule.save()
        return Response(serializer.data)

    @action(detail=True)
    def result(self, request, pk=None):
        train_schedule = self.get_object()
        path_id = request.query_params.get("path", train_schedule.path_id)
        path = get_object_or_404(PathModel, pk=path_id)
        res = create_simulation_report(train_schedule, path)
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
        schedules = TrainScheduleModel.objects.filter(pk__in=train_ids)

        # if some schedules were not found, raise an error
        schedules_map = {schedule.id: schedule for schedule in schedules}
        missing_schedules = train_ids_set.difference(schedules_map.keys())
        if missing_schedules:
            raise Http404(f"Invalid schedule IDs: {', '.join(map(str, missing_schedules))}")

        # if there's no path argument, use the path of the first train
        if path_id is not None:
            path = get_object_or_404(PathModel, pk=path_id)
        else:
            path = schedules_map[train_ids[0]].path

        res = []
        for train_id in train_ids:
            train_schedule = schedules_map[train_id]
            # create the simulation report to something frontend-friendly
            res.append(create_simulation_report(train_schedule, path))

        return Response(res)

    @action(detail=False, methods=["post"])
    def standalone_simulation(self, request):
        # Serialize request
        serializer = StandaloneSimulationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        train_schedules = serializer.create(serializer.validated_data)
        assert len(train_schedules) > 0

        # Create backend request payload
        request_payload = create_backend_request_payload(train_schedules)

        # Run standalone simulation
        response_payload = run_simulation(request_payload)

        # Process simulation response
        process_simulation_response(train_schedules, response_payload)

        # Save results
        TrainScheduleModel.objects.bulk_create(train_schedules)
        return Response({"ids": [schedule.id for schedule in train_schedules]}, status=201)
