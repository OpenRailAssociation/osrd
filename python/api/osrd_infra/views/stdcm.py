import requests
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from config import settings
from osrd_infra.models import PathModel, TrainScheduleModel
from osrd_infra.serializers import PathSerializer, STDCMInputSerializer
from osrd_infra.utils import make_exception_from_error
from osrd_infra.views import fetch_track_sections, parse_waypoint, postprocess_path
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


def get_track_ids(request):
    waypoints = request["start_points"] + request["end_points"]
    res = list()
    for waypoint in waypoints:
        res.append(waypoint["track_section"])
    return res


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
    schedules = TrainScheduleModel.objects.filter(timetable=timetable)
    res = list()
    for schedule in schedules:
        sim = schedule.eco_simulation
        if not sim:
            sim = schedule.base_simulation
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
    start_points = []
    end_points = []
    infra = request["infra"]
    track_map = fetch_track_sections(infra, get_track_ids(request))
    for waypoint in request["start_points"]:
        start_points += parse_waypoint(waypoint, track_map)
    for waypoint in request["end_points"]:
        end_points += parse_waypoint(waypoint, track_map)
    res = {
        "infra": infra.pk,
        "expected_version": infra.version,
        "rolling_stock": request["rolling_stock"].to_schema().dict(),
        "comfort": request["comfort"],
        "start_points": start_points,
        "end_points": end_points,
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


def compute_stdcm(request, user):
    core_output = request_stdcm(make_stdcm_core_payload(request))
    path = PathModel()
    postprocess_path(path, core_output["path"], request["infra"], user, [0, 0])
    path.save()

    schedule = TrainScheduleModel()
    schedule.departure_time = core_output["departure_time"]
    schedule.path = path
    schedule.initial_speed = 0
    schedule.rolling_stock = request["rolling_stock"]
    schedule.comfort = request["comfort"]

    process_simulation_response(request["infra"], [schedule], core_output["simulation"])
    sim_result = create_simulation_report(schedule, path)
    return {
        "path": {
            **PathSerializer(path).data,
            "steps": path.payload["path_waypoints"],
        },
        "simulation": sim_result,
    }


class STDCM(ViewSet):
    def create(self, request, *args, **kwargs):
        input_serializer = STDCMInputSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        request_data = input_serializer.validated_data
        return Response(compute_stdcm(request_data, self.request.user.sub))
