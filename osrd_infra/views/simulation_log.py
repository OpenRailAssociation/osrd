import requests
from django.conf import settings
from osrd_infra.utils import reverse_format
from osrd_infra.views.railjson import format_route_id, format_track_section_id
from rest_framework.exceptions import ParseError


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


def get_train_schedule_payload(train_schedule):
    path = train_schedule.path
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
    }


def preprocess_stops(stop_reaches, train_schedule):
    path = train_schedule.path.payload
    assert len(path["steps"]) == len(stop_reaches) + 1

    phase_times = [-1] * (len(stop_reaches) + 1)
    phase_times[0] = train_schedule.departure_time
    for stop in stop_reaches:
        phase_times[stop["stop_index"] + 1] = stop["time"]
    stops = []
    for phase_index, step in enumerate(path["steps"]):
        stops.append(
            {
                "name": step.get("name", "Unknown"),
                "id": step.get("id", None),
                "time": phase_times[phase_index],
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


def generate_simulation_log(train_schedule):
    payload = {
        "infra": train_schedule.timetable.infra_id,
        "rolling_stocks": [train_schedule.rolling_stock.to_railjson()],
        "train_schedules": [get_train_schedule_payload(train_schedule)],
    }
    train_schedule.base_simulation_log = None
    train_schedule.save()

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

    result = preprocess_response(response.json(), train_schedule)
    train_schedule.base_simulation_log = result
    train_schedule.save()
    return result
