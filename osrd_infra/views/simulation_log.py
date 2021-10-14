import requests
from django.conf import settings
from osrd_infra.utils import reverse_format
from osrd_infra.views.railjson import format_route_id, format_track_section_id
from rest_framework.exceptions import ParseError
from osrd_infra.models import TrainSchedule
from enum import IntEnum


class SimulationType(IntEnum):
    BASE = 0
    MARGIN = 1
    ECO = 2


def get_train_phases(path):
    steps = path.payload["steps"]
    step_track = steps[-1]["position"]["track_section"]
    return [
        {
            "type": "navigate",
            "driver_sight_distance": 400,
            "end_location": {
                "track_section": format_track_section_id(step_track),
                "offset": steps[-1]["position"]["offset"],
            },
        }
    ]


def get_train_stops(path):
    stops = []
    steps = path.payload["steps"]
    for step_index in range(1, len(steps)):
        step_track = steps[step_index]["position"]["track_section"]
        stops.append(
            {
                "location": {
                    "track_section": format_track_section_id(step_track),
                    "offset": steps[step_index]["position"]["offset"],
                },
                "duration": steps[step_index]["stop_time"],
            }
        )
    return stops


def convert_route_list_for_simulation(path):
    """
    Generates a list of route for the simulation using the path data
    """
    res = []
    for route in path.payload["path"]:
        route_str = format_route_id(route["route"])
        # We need to drop duplicates because the path is split at each step,
        # making it possible to have an input such as :
        # [{route: 1, track_sections: [1, 2]}, {route: 1, track_sections: [2, 3, 4]}]
        if len(res) == 0 or res[-1] != route_str:
            res.append(route_str)
    return res


def get_allowances_payload(margins, sim_type: SimulationType):
    # Base simulation doesn't use margins
    if sim_type == SimulationType.BASE:
        return []
    assert margins is not None

    # Add linear margins
    linear_margins = []
    sim_type = "linear" if sim_type == SimulationType.MARGIN else "eco"
    for margin in margins:
        if margin["type"] == "construction":
            continue
        allowance_type = "TIME" if margin["type"] == "ratio_time" else "DISTANCE"
        linear_margins.append(
            {
                "allowance_value": margin["value"],
                "begin_position": margin["begin_position"],
                "end_position": margin["end_position"],
                "type": sim_type,
                "allowance_type": allowance_type,
            }
        )
    payload = []
    if linear_margins:
        payload.append(linear_margins)

    # Add construction margins
    for margin in margins:
        if margin["type"] != "construction":
            continue
        payload.append(
            {
                "type": "construction",
                "allowance_value": margin["value"],
                "begin_position": margin["begin_position"],
                "end_position": margin["end_position"],
            }
        )
    return payload


def get_train_schedule_payload(train_schedule: TrainSchedule, sim_type: SimulationType):
    path = train_schedule.path
    margins = train_schedule.margins
    allowances = get_allowances_payload(margins, sim_type)
    return {
        "id": train_schedule.train_name,
        "rolling_stock": f"rolling_stock.{train_schedule.rolling_stock_id}",
        "departure_time": train_schedule.departure_time,
        "initial_head_location": path.get_initial_location(),
        "initial_route": format_route_id(path.get_initial_route()),
        "initial_speed": train_schedule.initial_speed,
        "phases": get_train_phases(path),
        "routes": convert_route_list_for_simulation(path),
        "stops": get_train_stops(path),
        "allowances": allowances,
    }


def preprocess_stops(stop_reaches, train_schedule):
    path = train_schedule.path.payload
    assert len(path["steps"]) == len(stop_reaches) + 1

    stop_times = [-1] * (len(stop_reaches) + 1)
    stop_times[0] = train_schedule.departure_time
    stop_positions = [0] * (len(stop_reaches) + 1)
    for stop in stop_reaches:
        stop_times[stop["stop_index"] + 1] = stop["time"]
        stop_positions[stop["stop_index"] + 1] = stop["position"]
    stops = []
    for phase_index, step in enumerate(path["steps"]):
        stops.append(
            {
                "name": step.get("name", "Unknown"),
                "id": step.get("id", None),
                "time": stop_times[phase_index],
                "position": stop_positions[phase_index],
                "stop_time": step["stop_time"],
            }
        )
    return stops


def preprocess_response(response, train_schedule):
    assert len(response["trains"]) == 1
    train = next(iter(response["trains"].values()))

    # Reformat objects id
    for position in train["head_positions"]:
        position["track_section"] = reverse_format(position["track_section"])
    for position in train["tail_positions"]:
        position["track_section"] = reverse_format(position["track_section"])
    for route in response["routes_status"]:
        route["route_id"] = reverse_format(route["route_id"])
        route["start_track_section"] = reverse_format(route["start_track_section"])
        route["end_track_section"] = reverse_format(route["end_track_section"])
    for signal in response["signal_changes"]:
        signal["signal_id"] = reverse_format(signal["signal_id"])

    return {
        "speeds": train["speeds"],
        "head_positions": train["head_positions"],
        "tail_positions": train["tail_positions"],
        "routes_status": response["routes_status"],
        "signals": response["signal_changes"],
        "stops": preprocess_stops(train["stop_reaches"], train_schedule),
    }


def run_simulation(train_schedule: TrainSchedule, sim_type: SimulationType):
    payload = {
        "infra": train_schedule.timetable.infra_id,
        "rolling_stocks": [train_schedule.rolling_stock.to_railjson()],
        "train_schedules": [get_train_schedule_payload(train_schedule, sim_type)],
    }
    try:
        response = requests.post(
            settings.OSRD_BACKEND_URL + "simulation",
            headers={"Authorization": "Bearer " + settings.OSRD_BACKEND_TOKEN},
            json=payload,
        )
    except requests.exceptions.ConnectionError as e:
        raise ParseError("Couldn't connect with osrd backend") from e

    if not response:
        raise ParseError(response.content)

    return preprocess_response(response.json(), train_schedule)


def generate_simulation_logs(train_schedule):
    # Clear logs
    train_schedule.base_simulation_log = None
    train_schedule.margins_simulation_log = None
    train_schedule.eco_simulation_log = None
    train_schedule.save()

    train_schedule.base_simulation_log = run_simulation(
        train_schedule, SimulationType.BASE
    )

    # Check margins is not None and not empty
    if train_schedule.margins:
        train_schedule.margins_simulation_log = run_simulation(
            train_schedule, SimulationType.MARGIN
        )
        train_schedule.eco_simulation_log = run_simulation(
            train_schedule, SimulationType.ECO
        )

    train_schedule.save()
