from django.db import transaction
from django.http import Http404
from rest_framework import mixins
from rest_framework.decorators import action
from rest_framework.exceptions import ParseError
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from osrd_infra.models import PathModel, SimulationOutput, TrainSchedule
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
    queryset = TrainSchedule.objects.all()
    serializer_class = TrainScheduleSerializer

    def update(self, request, *args, **kwargs):
        train_schedule: TrainSchedule = self.get_object()
        serializer = self.get_serializer(train_schedule, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        # Check if a new simulation must be done
        data = serializer.validated_data
        simulation_needed = False
        fields_requiring_simulation = [
            "rolling_stock",
            "path",
            "initial_speed",
            "allowances",
            "speed_limit_tags",
            "comfort",
            "options",
        ]
        for field in fields_requiring_simulation:
            if field in data and data[field] != getattr(train_schedule, field):
                simulation_needed = True
                break

        serializer.save()
        if not simulation_needed:
            return Response(serializer.data)
        # Create backend request payload
        request_payload = create_backend_request_payload([train_schedule])
        # Run standalone simulation
        response_payload = run_simulation(request_payload)
        simulation_output = process_simulation_response(
            train_schedule.timetable.infra, [train_schedule], response_payload
        )[0]
        with transaction.atomic():
            SimulationOutput.objects.filter(train_schedule=train_schedule).delete()
            simulation_output.save()
        return Response(serializer.data)

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
            sim_report = create_simulation_report(train_schedule, path)
            if not sim_report["base"]["head_positions"]:
                continue
            res.append(sim_report)

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
        simulation_outputs = process_simulation_response(
            train_schedules[0].timetable.infra, train_schedules, response_payload
        )

        with transaction.atomic():
            # Save inputs
            TrainSchedule.objects.bulk_create(train_schedules)
            # Save outputs
            SimulationOutput.objects.bulk_create(simulation_outputs)

        return Response({"ids": [schedule.id for schedule in train_schedules]}, status=201)
