from dataclasses import asdict, dataclass
from typing import Dict, Iterator, List, Union

from osrd_infra.models import PathModel, TrainSchedule
from osrd_infra.schemas.path import PathPayload
from osrd_infra.views.projection import Projection


def convert_simulation_logs(train_schedule, projection_path):
    train_path = train_schedule.path
    train_path_payload = PathPayload.parse_obj(train_schedule.path.payload)

    # Compute projection object
    projection_path_payload = PathPayload.parse_obj(projection_path.payload)
    projection = Projection(projection_path_payload)

    base = convert_simulation_log(
        train_schedule.base_simulation_log, train_path_payload, projection, projection_path_payload
    )
    vmax = convert_vmax(train_path, train_schedule)
    res = {
        "id": train_schedule.pk,
        "labels": [label.label for label in train_schedule.labels.all()],
        "path": train_schedule.path_id,
        "name": train_schedule.train_name,
        "vmax": vmax,
        "slopes": train_path.slopes,
        "curves": train_path.curves,
        "base": base,
    }

    # Check if train schedule has margins
    if train_schedule.eco_simulation_log is None:
        return res

    # Add margins and eco results if available
    sim_log = train_schedule.eco_simulation_log
    if "error" not in sim_log:
        res["eco"] = convert_simulation_log(sim_log, train_path_payload, projection, projection_path_payload)
    else:
        res["eco"] = sim_log
    return res


def convert_simulation_log(
    simulation_result, train_path_payload: PathPayload, projection, projection_path_payload: PathPayload
):
    # Format data for charts
    head_positions = convert_positions(simulation_result["head_positions"], projection, train_path_payload)
    tail_positions = convert_positions(simulation_result["tail_positions"], projection, train_path_payload)
    end_time = simulation_result["head_positions"][-1]["time"]
    route_begin_occupancy, route_end_occupancy = convert_route_occupancy(
        simulation_result["routes_status"], projection_path_payload, projection, end_time
    )

    return {
        "head_positions": head_positions,
        "tail_positions": tail_positions,
        "route_begin_occupancy": route_begin_occupancy,
        "route_end_occupancy": route_end_occupancy,
        "speeds": simulation_result["speeds"],
        "signals": simulation_result["signals"],
        "stops": simulation_result["stops"],
    }


def convert_vmax(path: PathModel, train_schedule: TrainSchedule):
    vmax = path.vmax
    rolling_stock_vmax = train_schedule.rolling_stock.max_speed
    # Replace -1 speeds (no vmax) to the rolling stock max speed
    for point in vmax:
        if point["speed"] == -1:
            point["speed"] = rolling_stock_vmax
    return vmax


def interpolate_locations(loc_a, loc_b, path_position):
    diff_time = loc_b["time"] - loc_a["time"]
    diff_space = loc_b["path_offset"] - loc_a["path_offset"]
    if diff_space == 0:
        return loc_a["time"]
    coef = diff_time / diff_space
    return loc_a["time"] + (path_position - loc_a["path_offset"]) * coef


def convert_positions(train_locations, projection, train_path_payload: PathPayload):
    results = []
    loc_index = 0
    intersections = projection.intersections(train_path_payload)
    for path_range in intersections:
        current_curve = []
        begin_loc = path_range.begin
        # Skip points that doesn't intersect the range
        while train_locations[loc_index + 1]["path_offset"] < begin_loc.path_offset:
            loc_index += 1

        # Add begin point
        begin_time = interpolate_locations(
            train_locations[loc_index],
            train_locations[loc_index + 1],
            begin_loc.path_offset,
        )
        begin_position = projection.track_position(begin_loc.track, begin_loc.offset)
        assert begin_position is not None
        current_curve.append({"time": begin_time, "position": begin_position})

        # Add intermediate points
        end_loc = path_range.end
        while (
            loc_index + 1 < len(train_locations) and train_locations[loc_index + 1]["path_offset"] < end_loc.path_offset
        ):
            loc_index += 1
            loc = train_locations[loc_index]
            position = projection.track_position(loc["track_section"], loc["offset"])
            assert position is not None
            current_curve.append({"time": loc["time"], "position": position})

        if loc_index + 1 < len(train_locations):
            # Add end points
            end_time = interpolate_locations(
                train_locations[loc_index],
                train_locations[loc_index + 1],
                end_loc.path_offset,
            )
            end_position = projection.track_position(end_loc.track, end_loc.offset)
            assert end_position is not None
            current_curve.append({"time": end_time, "position": end_position})

        results.append(current_curve)
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


OCCUPIED_STATUSES = {"OCCUPIED", "CBTC_OCCUPIED"}


def extract_occupancy_events(route_status_log, projection_path_payload, projection) -> Iterator[OccupancyEvent]:
    """
    Turns a raw simulation log into a clean log of occupation events on a given path
    """
    projection_routes = {path_step.route.id for path_step in projection_path_payload.path}

    for event in route_status_log:
        route_id = event["route_id"]
        if route_id not in projection_routes:
            continue

        status = event["status"]
        if status in OCCUPIED_STATUSES:
            start_track = event["start_track_section"]
            start_offset = event["start_offset"]
            start_position = projection.track_position(start_track, start_offset)
            if start_position is None:
                start_position = 0

            end_track = event["end_track_section"]
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


def convert_route_occupancy(route_status_log, projection_path_payload: PathPayload, projection, end_time):
    route_begin_occupancy: List[OccupancyPoint] = []
    route_end_occupancy: List[OccupancyPoint] = []

    occupied_routes: Dict[str, OccupancyStart] = {}

    def update_occupancy_lists(event_time):
        if not occupied_routes:
            return
        min_occ = min(occ.start_pos for occ in occupied_routes.values())
        max_occ = max(occ.end_pos for occ in occupied_routes.values())

        if not route_begin_occupancy or route_begin_occupancy[-1].position != min_occ:
            route_begin_occupancy.append(OccupancyPoint(event_time, min_occ))
        if not route_end_occupancy or route_end_occupancy[-1].position != max_occ:
            route_end_occupancy.append(OccupancyPoint(event_time, max_occ))

    for occupancy_event in extract_occupancy_events(route_status_log, projection_path_payload, projection):
        if isinstance(occupancy_event, OccupancyStart):
            occupied_routes[occupancy_event.route_id] = occupancy_event
        else:
            occupied_routes.pop(occupancy_event.route_id, None)
        update_occupancy_lists(occupancy_event.time)

    # Add last point of route occupancy
    if route_begin_occupancy:
        route_begin_occupancy.append(OccupancyPoint(end_time, route_begin_occupancy[-1].position))
        route_end_occupancy.append(OccupancyPoint(end_time, route_end_occupancy[-1].position))

    return (
        [asdict(e) for e in route_begin_occupancy],
        [asdict(e) for e in route_end_occupancy],
    )
