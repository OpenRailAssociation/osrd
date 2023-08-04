from django.db import transaction
from rest_framework import mixins
from rest_framework.decorators import action
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from osrd_infra.models import PathModel, SimulationOutput, Timetable, TrainSchedule
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
            "scheduled_points",
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

    @action(detail=True)
    def result(self, request, pk=None):
        train_schedule = self.get_object()
        path_id = request.query_params.get("path", train_schedule.path_id)
        path = get_object_or_404(PathModel, pk=path_id)
        infra = train_schedule.timetable.infra
        res = create_simulation_report(infra, train_schedule, path)
        return Response(res)

    @action(detail=False)
    def results(self, request):
        timetable_id = request.query_params.get("timetable_id", None)
        path_id = request.query_params.get("path_id", None)

        if timetable_id is None:
            raise ValueError("missing timetable_id")
        timetable = get_object_or_404(Timetable, pk=timetable_id)
        infra = timetable.infra
        train_schedules = timetable.train_schedules.all()

        if len(train_schedules) == 0:
            return Response([])

        # if there's no path argument, use the path of the first train_schedule
        if path_id is not None:
            path = get_object_or_404(PathModel, pk=path_id)
        else:
            path = train_schedules[0].path

        # create the simulation reports to something frontend-friendly
        res = []
        for train_schedule in train_schedules:
            sim_report = create_simulation_report(infra, train_schedule, path)
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

        # Set infra and rolling stock version to train schedules
        infra_version = train_schedules[0].timetable.infra.version
        for train_schedule in train_schedules:
            train_schedule.infra_version = infra_version
            train_schedule.rollingstock_version = train_schedule.rolling_stock.version

        with transaction.atomic():
            # Save inputs
            TrainSchedule.objects.bulk_create(train_schedules)
            # Save outputs
            SimulationOutput.objects.bulk_create(simulation_outputs)

        return Response({"ids": [schedule.id for schedule in train_schedules]}, status=201)

    @action(detail=False, methods=["delete"])
    def delete(self, request):
        train_ids = request.data["ids"]
        TrainSchedule.objects.filter(id__in=train_ids).delete()
        return Response(status=204)
