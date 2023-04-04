import requests
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from config import settings
from osrd_infra.models import PathModel, TrainSchedule
from osrd_infra.serializers import PathSerializer, STDCMInputSerializer
from osrd_infra.utils import make_exception_from_error
from osrd_infra.views import parse_steps_input, postprocess_path
from osrd_infra.views.train_schedule import (
    create_simulation_report,
    process_simulation_response,
)


class InternalSTDCMError(APIException):
    status_code = 500
    default_detail = "An internal STDCM error occurred"
    default_code = "internal_stdcm_error"


class InvalidSTDCMInput(APIException):
    status_code = 400
    default_detail = "The STDCM request had invalid inputs"
    default_code = "stdcm_invalid_input"


def request_stdcm(payload):
    response = requests.post(
        f"{settings.OSRD_BACKEND_URL}/stdcm",
        headers={"Authorization": "Bearer " + settings.OSRD_BACKEND_TOKEN},
        json=payload,
    )
    if not response:
        raise make_exception_from_error(response, InvalidSTDCMInput, InternalSTDCMError)
    return response.json()


def make_route_occupancies(timetable):
    schedules = TrainSchedule.objects.filter(timetable=timetable)
    res = []
    for schedule in schedules:
        output = schedule.simulation_output
        sim = output.eco_simulation or output.base_simulation
        for route_id, occupancy in sim["route_occupancies"].items():
            res.append(
                {
                    "id": route_id,
                    "start_occupancy_time": occupancy["time_head_occupy"] + schedule.departure_time,
                    "end_occupancy_time": occupancy["time_tail_free"] + schedule.departure_time,
                }
            )
    return res


def make_stdcm_core_payload(request):
    infra = request["infra"]
    steps = parse_stdcm_steps(request, infra)
    res = {
        "infra": infra.pk,
        "expected_version": infra.version,
        "rolling_stock": request["rolling_stock"].to_schema().dict(),
        "comfort": request["comfort"],
        "steps": steps,
        "route_occupancies": make_route_occupancies(request["timetable"]),
    }
    if "start_time" in request:
        res["start_time"] = request["start_time"]
    else:
        res["end_time"] = request["end_time"]

    optional_forwarded_parameters = [
        "maximum_departure_delay",
        "maximum_relative_run_time",
        "speed_limit_tags",
        "margin_before",
        "margin_after",
        "standard_allowance"
        # Don't forget to add these fields to the serializer
    ]
    for parameter in optional_forwarded_parameters:
        if parameter in request:
            res[parameter] = request[parameter]

    return res


def parse_stdcm_steps(request, infra):
    waypoints, step_durations = parse_steps_input(request["steps"], infra)
    assert len(waypoints) == len(step_durations)
    assert len(waypoints) >= 2, "Need at least two steps to run an stdcm pathfinding"
    res = []
    for step_waypoints, duration in zip(waypoints, step_durations):
        res.append(
            {
                "waypoints": step_waypoints,
                "stop_duration": duration,
                "stop": duration > 0,
            }
        )
    return res


def compute_stdcm(request, user):
    core_output = request_stdcm(make_stdcm_core_payload(request))
    path = PathModel()
    infra = request["infra"]
    step_durations = [0]
    for stop in core_output["simulation"]["base_simulations"][0]["stops"]:
        step_durations.append(stop["duration"])

    # Dummy values, we don't need actual stop values to be linked to the path,
    # and it's difficult to sort out the waypoints where the train doesn't stop
    step_durations = [0] * len(core_output["path"]["path_waypoints"])

    postprocess_path(path, core_output["path"], infra, user, step_durations)
    path.save()

    schedule = TrainSchedule()
    schedule.departure_time = core_output["departure_time"]
    schedule.path = path
    schedule.initial_speed = 0
    schedule.rolling_stock = request["rolling_stock"]
    schedule.comfort = request["comfort"]

    simulation_output = process_simulation_response(request["infra"], [schedule], core_output["simulation"])[0]
    simulation = create_simulation_report(infra, schedule, path, simulation_output=simulation_output)
    return {
        "path": {
            **PathSerializer(path).data,
            "steps": path.payload["path_waypoints"],
        },
        "simulation": simulation,
    }


class STDCM(ViewSet):
    def create(self, request, *args, **kwargs):
        input_serializer = STDCMInputSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        request_data = input_serializer.validated_data
        return Response(compute_stdcm(request_data, self.request.user.sub))
