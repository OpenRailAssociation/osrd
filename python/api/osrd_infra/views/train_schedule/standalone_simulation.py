from typing import Any, Dict, Iterator, List, Optional

import requests
from django.conf import settings
from rest_framework.exceptions import APIException

from osrd_infra.models import SimulationOutput, TrackSectionModel, TrainSchedule
from osrd_infra.models.infra import Infra
from osrd_infra.utils import make_exception_from_error


class ServiceUnavailable(APIException):
    status_code = 503
    default_detail = "Service temporarily unavailable"
    default_code = "service_unavailable"


class InternalSimulationError(APIException):
    status_code = 500
    default_detail = "An internal simulation error occurred"
    default_code = "internal_simulation_error"


class InvalidSimulationInput(APIException):
    status_code = 400
    default_detail = "The simulation had invalid inputs"
    default_code = "simulation_invalid_input"


def create_backend_request_payload(train_schedules: Iterator[TrainSchedule]):
    rolling_stocks = set(schedule.rolling_stock for schedule in train_schedules)

    path_payload = train_schedules[0].path.payload
    stops = []
    for waypoint in path_payload["path_waypoints"]:
        stops.append(
            {
                "duration": waypoint["duration"],
                "location": {"track_section": waypoint["track"], "offset": waypoint["position"]},
            }
        )

    schedules_payload = []
    for schedule in train_schedules:
        schedules_payload.append(
            {
                "id": schedule.train_name,
                "stops": stops,
                "rolling_stock": schedule.rolling_stock.name,
                "initial_speed": schedule.initial_speed,
                "allowances": schedule.allowances,
                "tag": schedule.speed_limit_tags,
                "comfort": schedule.comfort,
                "options": schedule.options,
            }
        )

    timetable = train_schedules[0].timetable
    electrical_profile_set = timetable.electrical_profile_set

    return {
        "infra": timetable.infra.pk,
        "electrical_profile_set": electrical_profile_set.pk if electrical_profile_set else None,
        "expected_version": timetable.infra.version,
        "rolling_stocks": [rs.to_schema().dict() for rs in rolling_stocks],
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
        raise make_exception_from_error(response, InvalidSimulationInput, InternalSimulationError)
    return response.json()


def _update_simulation_stops(
    simulation_stops: Iterator[Dict[str, Any]], stops_additional_information: Iterator[Dict[str, Any]]
):
    """Update simulation_stops.

    Stops specified in simulation can miss some information that must be completed using ``path_waypoints`` data.

    Args:
        simulation_stops: Stops defined in the simulation.
        stops_additional_information: Information related to track metadata that must be added to simulation stops.

    """
    for stop, stop_update in zip(simulation_stops, stops_additional_information):
        stop.update(stop_update)


def _create_and_fill_simulation_output(
    train_schedule: TrainSchedule,
    base_simulation: Any,
    eco_simulation: Any,
    stops_updates: List[Any],
    mrsp: Any,
    modes_and_profiles: Optional[Any],
) -> SimulationOutput:
    _update_simulation_stops(base_simulation["stops"], stops_updates)

    simulation_output = SimulationOutput(
        train_schedule=train_schedule,
        base_simulation=base_simulation,
        mrsp=mrsp,
        modes_and_profiles=modes_and_profiles or [],
    )

    # Skip if no eco simulation is available
    if not eco_simulation:
        return simulation_output

    _update_simulation_stops(eco_simulation["stops"], stops_updates)

    simulation_output.eco_simulation = eco_simulation
    return simulation_output


def process_simulation_response(
    infra: Infra, train_schedules: Iterator[TrainSchedule], response_payload
) -> List[SimulationOutput]:
    """
    This function process the payload returned by the backend and fill schedules
    """
    base_simulations = response_payload["base_simulations"]
    assert len(train_schedules) == len(base_simulations)
    speed_limits = response_payload["speed_limits"]
    assert len(train_schedules) == len(speed_limits)
    eco_simulations = response_payload["eco_simulations"]
    modes_and_profiles = response_payload["modes_and_profiles"]
    assert len(modes_and_profiles) == 0 or len(train_schedules) == len(modes_and_profiles)

    stops = train_schedules[0].path.payload["path_waypoints"]
    track_sections = TrackSectionModel.objects.filter(infra=infra, obj_id__in=[stop["track"] for stop in stops])
    id_to_tracks = {track.obj_id: track for track in track_sections}

    stops_additional_information = [
        {
            "id": stop.get("id"),
            "name": stop.get("name"),
            "line_code": id_to_tracks[stop["track"]].data.get("extensions", {}).get("sncf", {}).get("line_code"),
            "track_number": id_to_tracks[stop["track"]].data.get("extensions", {}).get("sncf", {}).get("track_number"),
            "line_name": id_to_tracks[stop["track"]].data.get("extensions", {}).get("sncf", {}).get("line_name"),
            "track_name": id_to_tracks[stop["track"]].data.get("extensions", {}).get("sncf", {}).get("track_name"),
        }
        for stop in stops
    ]

    return [
        _create_and_fill_simulation_output(
            train_schedule,
            base_simulations[i],
            eco_simulations[i],
            stops_additional_information,
            speed_limits[i],
            modes_and_profiles[i] if len(modes_and_profiles) > 0 else None,
        )
        for i, train_schedule in enumerate(train_schedules)
    ]
