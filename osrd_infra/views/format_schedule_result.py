from osrd_infra.views.projection import Projection
from osrd_infra.models import (
    SignalEntity,
    entities_prefetch_components,
)
from rest_framework.exceptions import ParseError
from osrd_infra.utils import geo_transform, reverse_format
from collections import defaultdict


def compute_projection(projection_path):
    projection_tracks = []
    for route in projection_path.payload["path"]:
        projection_tracks += route["track_sections"]
    return Projection(projection_tracks)


def format_result(train_schedule, projection_path):
    simulation_log = train_schedule.simulation_log
    logs = classify_logs(simulation_log)

    # Compute projection object
    projection = compute_projection(projection_path)

    # Format data for charts
    head_positions = format_head_positions(logs["train_location"], projection)
    tail_positions = format_tail_positions(logs["train_location"], projection)
    speeds = format_speeds(logs["train_location"], train_schedule.path)
    end_time = simulation_log[-1]["time"]
    route_begin_occupancy, route_end_occupancy = format_route_occupancy(
        logs["route_status"], projection_path, projection, end_time
    )

    return {
        "id": train_schedule.pk,
        "labels": [label.label for label in train_schedule.labels.all()],
        "path": train_schedule.path_id,
        "name": train_schedule.train_name,
        "stops": format_stops(logs, train_schedule),
        "signals": format_signals(simulation_log),
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


def get_move_location(path, track_id, offset, distance, start=0):
    for i in range(start, len(path)):
        if path[i]["track_section"] != track_id:
            continue
        if offset < path[i]["begin"] and offset < path[i]["end"]:
            continue
        if offset > path[i]["begin"] and offset > path[i]["end"]:
            continue
        if distance <= abs(path[i]["end"] - offset):
            if path[i]["end"] > path[i]["begin"]:
                return path[i]["track_section"], offset + distance
            return path[i]["track_section"], offset - distance
        return get_move_location(
            path,
            path[i + 1]["track_section"],
            path[i + 1]["begin"],
            distance - abs(path[i]["end"] - offset),
            i + 1,
        )
    raise ParseError("Internal error: interpolation exceed end path location")


def format_train_positions(train_locations, projection, field_name):
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


def format_head_positions(train_locations, projection):
    return format_train_positions(train_locations, projection, "head")


def format_tail_positions(train_locations, projection):
    return format_train_positions(train_locations, projection, "tail")


def format_speeds(train_locations, train_path):
    projection = compute_projection(train_path)
    results = []
    for log in train_locations:
        head_track = reverse_format(log["head_track_section"])
        head_offset = log["head_offset"]
        position = projection.track_position(head_track, head_offset)
        assert position is not None
        results.append({"position": position, "speed": log["speed"]})
    return results


def format_route_occupancy(route_status, projection_path, projection, end_time):
    route_path = set()
    for route in projection_path.payload["path"]:
        route_path.add(route["route"])

    route_begin_occupancy = []
    route_end_occupancy = []
    occupied_route = {}
    for log in route_status:
        route_id = reverse_format(log["id"])
        if route_id not in route_path:
            continue
        time = log["time"]

        end_track = reverse_format(log["end_track_section"])
        end_offset = log["end_offset"]
        end_position = projection.track_position(end_track, end_offset)
        if end_position is None:
            end_position = projection.end()

        begin_track = reverse_format(log["start_track_section"])
        begin_offset = log["start_offset"]
        begin_position = projection.track_position(begin_track, begin_offset)
        if begin_position is None:
            begin_position = 0

        if log["status"] in ("OCCUPIED", "CONFLICT", "CBTC_OCCUPIED"):
            occupied_route[route_id] = (begin_position, end_position)
            route_end_occupancy.append(
                {
                    "time": time,
                    "position": max((pos for _, pos in occupied_route.values())),
                }
            )
            if len(route_begin_occupancy) == 0:
                route_begin_occupancy.append({"time": time, "position": begin_position})
        elif log["status"] == "FREE":
            occupied_route.pop(route_id)
            route_begin_occupancy.append(
                {
                    "time": time,
                    "position": min((pos for pos, _ in occupied_route.values())),
                }
            )
    if occupied_route:
        route_begin_occupancy.append(
            {
                "time": end_time,
                "position": min((pos for pos, _ in occupied_route.values())),
            }
        )
        route_end_occupancy.append(
            {
                "time": end_time,
                "position": max((pos for pos, _ in occupied_route.values())),
            }
        )
    return route_begin_occupancy, route_end_occupancy


def format_stops(logs, train_schedule):
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


def format_signals(simulation_log):
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
