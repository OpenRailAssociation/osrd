from typing import List

import requests
from django.conf import settings
from rest_framework.exceptions import APIException

from osrd_infra.models import TrainScheduleModel


class ServiceUnavailable(APIException):
    status_code = 503
    default_detail = "Service temporarily unavailable"
    default_code = "service_unavailable"


class SimulationError(APIException):
    status_code = 500
    default_detail = "A simulation error occurred"
    default_code = "simulation_error"


def create_backend_request_payload(train_schedules: List[TrainScheduleModel]):
    rolling_stocks = set(schedule.rolling_stock for schedule in train_schedules)

    path_payload = train_schedules[0].path.payload
    stops = []
    for waypoint in path_payload["path_waypoints"]:
        stops.append(
            {
                "duration": waypoint["duration"],
                "location": {"track_section": waypoint["track"]["id"], "offset": waypoint["position"]},
            }
        )

    schedules_payload = []
    for schedule in train_schedules:
        schedules_payload.append(
            {
                "id": schedule.train_name,
                "stops": stops,
                "rolling_stock": schedule.rolling_stock.railjson_id,
                "initial_speed": schedule.initial_speed,
                "allowances": schedule.allowances,
            }
        )

    return {
        "infra": train_schedules[0].timetable.infra.pk,
        "rolling_stocks": [rs.to_railjson() for rs in rolling_stocks],
        "trains_path": {"route_paths": path_payload["route_paths"]},
        "train_schedules": schedules_payload,
    }


def run_simulation(request_payload):
    try:
        response = requests.post(
            f"{settings.OSRD_BACKEND_URL}/standalone_simulation",
            headers={"Authorization": "Bearer " + settings.OSRD_BACKEND_TOKEN},
            json=request_payload,
        )
    except requests.exceptions.ConnectionError as e:
        raise ServiceUnavailable("Service OSRD backend unavailable") from e

    if not response:
        raise SimulationError(response.content)
    return response.json()


def process_simulation_response(train_schedules, response_payload):
    """
    This function process the payload returned by the backend and fill schedules
    """
    base_simulations = response_payload["base_simulations"]
    assert len(train_schedules) == len(base_simulations)
    eco_simulations = response_payload["eco_simulations"]

    stops_update = []
    for stop in train_schedules[0].path.payload["path_waypoints"]:
        stops_update.append({"id": stop.get("id", None), "name": stop.get("name", None)})

    for i, train_schedule in enumerate(train_schedules):
        # Update stops (adding id and name when available)
        for stop, stop_update in zip(base_simulations[i]["stops"], stops_update):
            stop.update(stop_update)

        train_schedule.base_simulation = base_simulations[i]

        # Skip if no eco simulation is available
        if not eco_simulations[i]:
            continue

        # Update stops (adding id and name when available)
        for stop, stop_update in zip(eco_simulations[i]["stops"], stops_update):
            stop.update(stop_update)

        train_schedule.eco_simulation = eco_simulations[i]
