from osrd_infra.views.projection import Projection
from osrd_infra.models import (
    SignalEntity,
    entities_prefetch_components,
)
from osrd_infra.utils import geo_transform, reverse_format
from collections import defaultdict
from dataclasses import dataclass, asdict
from typing import List, Iterator, Union, Dict


def compute_projection(projection_path):
    projection_tracks = []
    for route in projection_path.payload["path"]:
        projection_tracks += route["track_sections"]
    return Projection(projection_tracks)


def convert_simulation_log(train_schedule, projection_path, precision=3):
    simulation_log = train_schedule.simulation_log
    logs = classify_logs(simulation_log)

    # Compute projection object
    projection = compute_projection(projection_path)

    # Format data for charts
    head_positions = convert_head_positions(logs["train_location"], projection)
    tail_positions = convert_tail_positions(logs["train_location"], projection)
    speeds = convert_speeds(logs["train_location"], train_schedule.path)
    end_time = simulation_log[-1]["time"]
    route_begin_occupancy, route_end_occupancy = convert_route_occupancy(
        logs["route_status"], projection_path, projection, end_time
    )

    return {
        "id": train_schedule.pk,
        "labels": [label.label for label in train_schedule.labels.all()],
        "path": train_schedule.path_id,
        "name": train_schedule.train_name,
        "stops": convert_stops(logs, train_schedule),
        "signals": convert_signals(simulation_log),
        "head_positions": head_positions,
        "tail_positions": tail_positions,
        "route_begin_occupancy": route_begin_occupancy,
        "route_end_occupancy": route_end_occupancy,
        "speeds": speeds,
    }


def classify_logs(simulation_log):
    classification = defaultdict(list)
    for log in simulation_log:
        classification[log["type"]].append(log)
    return classification


def convert_train_positions(train_locations, projection, field_name):
    results = [[]]
    for log in train_locations:
        time = log["time"]
        head_track = reverse_format(log[f"{field_name}_track_section"])
        head_offset = log[f"{field_name}_offset"]
        position = projection.track_position(head_track, head_offset)
        if position is None:
            if len(results[-1]) > 0:
                results.append([])
            continue
        results[-1].append({"time": time, "position": position})
    return results


def convert_head_positions(train_locations, projection):
    return convert_train_positions(train_locations, projection, "head")


def convert_tail_positions(train_locations, projection):
    return convert_train_positions(train_locations, projection, "tail")


def convert_speeds(train_locations, train_path):
    projection = compute_projection(train_path)
    results = []
    for log in train_locations:
        head_track = reverse_format(log["head_track_section"])
        head_offset = log["head_offset"]
        position = projection.track_position(head_track, head_offset)
        assert position is not None
        results.append({"position": position, "speed": log["speed"]})
    return results


@dataclass
class OccupancyStart:
    time: float
    route_id: str
    start_pos: float
    end_pos: float


@dataclass
class OccupancyEnd:
    time: float
    route_id: str


OccupancyEvent = Union[OccupancyStart, OccupancyEnd]


OCCUPIED_STATUSES = {"OCCUPIED", "CONFLICT", "CBTC_OCCUPIED"}


def extract_occupancy_events(route_status_log, projection_path, projection) -> Iterator[OccupancyEvent]:
    """
    Turns a raw simulation log into a clean log of occupation events on a given path
    """
    projection_routes = {route["route"] for route in projection_path.payload["path"]}

    for event in route_status_log:
        route_id = reverse_format(event["id"])
        if route_id not in projection_routes:
            continue

        status = event["status"]
        if status in OCCUPIED_STATUSES:
            start_track = reverse_format(event["start_track_section"])
            start_offset = event["start_offset"]
            start_position = projection.track_position(start_track, start_offset)
            if start_position is None:
                start_position = 0

            end_track = reverse_format(event["end_track_section"])
            end_offset = event["end_offset"]
            end_position = projection.track_position(end_track, end_offset)
            if end_position is None:
                end_position = projection.end()

            yield OccupancyStart(
                event["time"],
                route_id,
                start_position,
                end_position,
            )
        elif status == "FREE":
            yield OccupancyEnd(event["time"], route_id)


@dataclass
class OccupancyPoint:
    time: float
    position: float


def convert_route_occupancy(route_status_log, projection_path, projection, end_time):
    route_begin_occupancy: List[OccupancyPoint] = []
    route_end_occupancy: List[OccupancyPoint] = []

    occupied_routes: Dict[str, OccupancyStart] = {}

    def update_occupancy_lists(event_time, force_add=False):
        min_occ = min(occ.start_pos for occ in occupied_routes.values())
        max_occ = max(occ.end_pos for occ in occupied_routes.values())

        if force_add or not route_begin_occupancy or route_begin_occupancy[-1].position != min_occ:
            route_begin_occupancy.append(OccupancyPoint(event_time, min_occ))
        if force_add or not route_end_occupancy or route_end_occupancy[-1].position != max_occ:
            route_end_occupancy.append(OccupancyPoint(event_time, max_occ))

    for occupancy_event in extract_occupancy_events(route_status_log, projection_path, projection):
        if isinstance(occupancy_event, OccupancyStart):
            occupied_routes[occupancy_event.route_id] = occupancy_event
        else:
            occupied_routes.pop(occupancy_event.route_id)
        update_occupancy_lists(occupancy_event.time)

    if occupied_routes:
        update_occupancy_lists(end_time, force_add=True)

    return (
        [asdict(e) for e in route_begin_occupancy],
        [asdict(e) for e in route_end_occupancy],
    )


def convert_stops(logs, train_schedule):
    path = train_schedule.path.payload
    phase_times = {}
    for log in logs["stop_reached"]:
        phase_times[log["stop_index"] + 1] = log["time"]
    stops = [
        {
            "name": path["steps"][0]["name"],
            "time": train_schedule.departure_time,
            "stop_time": 0,
        }
    ]
    for phase_index in range(1, len(path["steps"])):
        assert phase_index in phase_times
        stops.append(
            {
                "name": path["steps"][phase_index]["name"],
                "time": phase_times[phase_index],
                "stop_time": path["steps"][phase_index]["stop_time"],
            }
        )
    return stops


def convert_signals(simulation_log):
    signals = []
    signals_ids = []
    for log in simulation_log:
        if log["type"] != "signal_change":
            continue
        signal_id = reverse_format(log["signal"])
        signals_ids.append(signal_id)
        aspects = [reverse_format(aspect) for aspect in log["aspects"]]
        signals.append(
            {
                "signal_id": signal_id,
                "aspects": aspects,
            }
        )
    qs = SignalEntity.objects.filter(pk__in=signals_ids)
    prefetch_signals = {e.pk: e for e in entities_prefetch_components(SignalEntity, qs)}
    for signal in signals:
        location = prefetch_signals[signal["signal"]].geo_point_location
        signal["geo_position"] = geo_transform(location.geographic).json
        signal["schema_position"] = geo_transform(location.schematic).json
    return signals
