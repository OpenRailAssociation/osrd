from osrd_infra.models import PathModel, TrainScheduleModel
from osrd_infra.schemas.path import PathPayload
from osrd_infra.views.projection import Projection


def create_simulation_report(train_schedule: TrainScheduleModel, projection_path: PathModel):
    train_path = train_schedule.path
    train_path_payload = PathPayload.parse_obj(train_schedule.path.payload)

    # Compute projection object
    projection_path_payload = PathPayload.parse_obj(projection_path.payload)
    projection = Projection(projection_path_payload)

    base = convert_simulation_results(
        train_schedule.base_simulation,
        train_path_payload,
        projection,
        projection_path_payload,
        train_schedule.departure_time,
    )
    vmax = convert_vmax(train_path, train_schedule)
    res = {
        "id": train_schedule.pk,
        "labels": train_schedule.labels,
        "path": train_schedule.path_id,
        "name": train_schedule.train_name,
        "vmax": vmax,
        "slopes": train_path.slopes,
        "curves": train_path.curves,
        "base": base,
    }

    # Check if train schedule has margins
    if train_schedule.eco_simulation is None:
        return res

    # Add margins and eco results if available
    sim_log = train_schedule.eco_simulation
    res["eco"] = convert_simulation_results(
        sim_log,
        train_path_payload,
        projection,
        projection_path_payload,
        train_schedule.departure_time,
    )
    return res


def convert_simulation_results(
    simulation_result, train_path_payload: PathPayload, projection, projection_path_payload: PathPayload, departure_time
):
    # Format data for charts
    head_positions = convert_positions(
        simulation_result["head_positions"], projection, train_path_payload, departure_time
    )
    tail_positions = convert_positions(
        simulation_result["tail_positions"], projection, train_path_payload, departure_time
    )

    route_begin_occupancy, route_end_occupancy = convert_route_occupancies(
        simulation_result["route_occupancies"], projection_path_payload, departure_time
    )

    speeds = [{**speed, "time": speed["time"] + departure_time} for speed in simulation_result["speeds"]]
    stops = [{**stop, "time": stop["time"] + departure_time} for stop in simulation_result["stops"]]

    return {
        "head_positions": head_positions,
        "tail_positions": tail_positions,
        "route_begin_occupancy": route_begin_occupancy,
        "route_end_occupancy": route_end_occupancy,
        "speeds": speeds,
        "stops": stops,
    }


def convert_vmax(path: PathModel, train_schedule: TrainScheduleModel):
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


def convert_positions(train_locations, projection, train_path_payload: PathPayload, departure_time: float):
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
        current_curve.append({"time": begin_time + departure_time, "position": begin_position})

        # Add intermediate points
        end_loc = path_range.end
        while (
            loc_index + 1 < len(train_locations) and train_locations[loc_index + 1]["path_offset"] < end_loc.path_offset
        ):
            loc_index += 1
            loc = train_locations[loc_index]
            position = projection.track_position(loc["track_section"], loc["offset"])
            assert position is not None
            current_curve.append({"time": loc["time"] + departure_time, "position": position})

        if loc_index + 1 < len(train_locations):
            # Add end points
            end_time = interpolate_locations(
                train_locations[loc_index],
                train_locations[loc_index + 1],
                end_loc.path_offset,
            )
            end_position = projection.track_position(end_loc.track, end_loc.offset)
            assert end_position is not None
            current_curve.append({"time": end_time + departure_time, "position": end_position})

        results.append(current_curve)
    return results


def convert_route_occupancies(route_occupancies, projection_path_payload: PathPayload, departure_time):
    begin_occupancies = []
    end_occupancies = []
    current_begin_curve = []
    current_end_curve = []
    start_pos = 0
    for route_path in projection_path_payload.route_paths:
        route_id = route_path.route.id

        end_pos = start_pos
        for track_range in route_path.track_sections:
            end_pos += track_range.length()

        if route_id not in route_occupancies:
            start_pos = end_pos

            if not current_begin_curve:
                continue

            begin_occupancies.append(current_begin_curve)
            end_occupancies.append(current_end_curve)
            current_begin_curve = []
            current_end_curve = []
            start_pos = end_pos
            continue

        route_occupancy = route_occupancies[route_id]
        if not current_begin_curve or current_begin_curve[-1]["position"] < start_pos:
            current_begin_curve.append(
                {"time": route_occupancy["time_head_occupy"] + departure_time, "position": start_pos}
            )
            current_end_curve.append(
                {"time": route_occupancy["time_tail_occupy"] + departure_time, "position": start_pos}
            )

        current_begin_curve.append({"time": route_occupancy["time_head_occupy"] + departure_time, "position": end_pos})
        current_begin_curve.append({"time": route_occupancy["time_head_free"] + departure_time, "position": end_pos})
        current_end_curve.append({"time": route_occupancy["time_tail_free"] + departure_time, "position": start_pos})
        current_end_curve.append({"time": route_occupancy["time_tail_free"] + departure_time, "position": end_pos})
        start_pos = end_pos

    if current_begin_curve:
        begin_occupancies.append(current_begin_curve)
        end_occupancies.append(current_end_curve)

    return begin_occupancies, end_occupancies
