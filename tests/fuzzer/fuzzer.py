from dataclasses import dataclass
from typing import Dict, Tuple, Iterable, List, Set
import json
import random
import time
from collections import defaultdict

import requests
from pathlib import Path

URL = "http://127.0.0.1:8000/"
TIMEOUT = 15


"""
Generates random tests, running pathfinding + simulations on random paths.
This requires a running database setup with actual infra data, which can't be publicly available on github
"""


@dataclass
class InfraGraph:
    RJSInfra: Dict
    routes: Dict[str, Dict]
    routes_per_entry_point: Dict[str, Set[str]]


def run_test(infra: InfraGraph, base_url: str, infra_id: int):
    """
    Runs a single random test
    :param infra: infra graph
    :param base_url: Api url
    :param infra_id: Infra id
    """
    path, path_length = make_valid_path(infra)
    path_payload = make_payload_path(infra_id, path)
    r = requests.post(base_url + "pathfinding/", json=path_payload, timeout=TIMEOUT)
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Pathfinding error {r.status_code}: payload=\n{json.dumps(path_payload)}\n{r.content}")
    path_id = r.json()["id"]
    rolling_stock = get_random_rolling_stock(base_url)

    schedule_payload = make_payload_schedule(base_url, infra_id, path_id, rolling_stock, path_length)
    r = requests.post(base_url + "train_schedule/standalone_simulation/", json=schedule_payload, timeout=TIMEOUT)
    if r.status_code // 100 != 2:
        if r.status_code // 100 == 4:
            print("ignore: invalid user input")
            return
        raise RuntimeError(f"Schedule error {r.status_code}: payload=\n{json.dumps(schedule_payload)}\n{r.content}")

    schedule_id = r.json()["ids"][0]
    r = requests.get(f"{base_url}train_schedule/{schedule_id}/result/", timeout=TIMEOUT)
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Schedule error {r.status_code}: {r.content}, id={schedule_id}\npath_payload=\n{json.dumps(path_payload)}")

    print("test PASSED")


def run(base_url: str, infra_id: int, n_test: int = 1000, log_folder: Path = None):
    """
    Runs every test
    :param base_url: url to reach the api
    :param infra_id: infra id
    :param n_test: number of tests to run
    :param log_folder: (optional) path to a folder to log errors in
    """
    seed = 0
    infra_graph = make_graph(base_url, infra_id)
    for i in range(n_test):
        seed += 1
        print("seed:", seed)
        random.seed(seed)
        time.sleep(0.1)

        try:
            run_test(infra_graph, base_url, infra_id)
        except Exception as e:
            if log_folder is None:
                raise e
            else:
                print(e)
                log_folder.mkdir(exist_ok=True)
                with open(str(log_folder / f"{i}.txt"), "w") as f:
                    print(e, file=f)


def get_random_rolling_stock(base_url: str) -> str:
    """
    Returns a random rolling stock ID
    :param base_url: Api url
    :return: ID of a valid rolling stock
    """
    r = requests.get(base_url + "rolling_stock/", timeout=TIMEOUT)
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Rolling stock error {r.status_code}: {r.content}")
    stocks = r.json()["results"]
    rolling_stock = random.choice(stocks)
    if rolling_stock["tractive_effort_curves"]["SC"]:
        return rolling_stock["id"]
    return get_random_rolling_stock(base_url)


def format_route_node(waypoint_id, direction):
    """
    Formats a waypoint + track direction into a string, to be used in dicts
    :param waypoint_id: waypoint id
    :param direction: direction on the track section the waypoint is placed on
    """
    return f"{waypoint_id};{direction}"


def make_graph(base_url: str, infra: int) -> InfraGraph:
    """
    Makes a graph from the infra
    :param base_url: infra url
    :param infra: infra id
    """
    url = base_url + f"infra/{infra}/railjson/"
    r = requests.get(url, timeout=TIMEOUT)
    routes = dict()
    routes_per_entry_point = defaultdict(set)
    infra = r.json()
    for route in infra["routes"]:
        route_id = route["id"]
        routes[route_id] = route
        entry_node = format_route_node(route["entry_point"]["id"], route["path"][0]["direction"])
        routes_per_entry_point[entry_node].add(route_id)
    return InfraGraph(infra, routes, dict(routes_per_entry_point))


def random_set_element(s: Iterable):
    """
    Picks a random element in an iterable
    """
    return random.choice(list(s))


def check_tracks_are_unseen(seen_track_sections: Set[str], route: Dict):
    """
    Checks all tracks in the route, returns true if a track is already part of the path, adds them otherwise
    :param seen_track_sections: Set of track sections on the path
    :param route: Route to check
    """
    for track_range in route["path"]:
        track_id = track_range["track"]["id"]
        if track_id in seen_track_sections:
            return False
        seen_track_sections.add(track_id)
    return True


def make_steps_on_route(route: Dict, distance_from_start: [float]) -> Iterable[Tuple[str, float]]:
    """
    Generates a random list of steps on a route
    :return: Iterable of (edge id, edge offset, offset from the start)
    """
    for track_range in route["path"]:
        if random.randint(0, 5) == 0:
            begin = track_range["begin"]
            end = track_range["end"]
            if track_range["direction"] == "STOP_TO_START":
                begin, end = end, begin
            offset = begin + random.random() * (end - begin)
            yield track_range["track"]["id"], offset, distance_from_start[0] + abs(offset - begin)
            distance_from_start[0] += abs(end - begin)


def make_path(infra: InfraGraph) -> Tuple[List[Tuple[str, float]], float]:
    """
    Generates a path in the infra following the route graph. The path may only have a single element
    :param infra: infra
    :return: List of (edge id, offset)
    """
    res = []
    seen_track_sections = set()
    route_id = random_set_element(infra.routes.keys())
    distance_from_start = [0]
    step_offsets = []
    while random.randint(0, 15) != 0:
        route = infra.routes[route_id]
        if not check_tracks_are_unseen(seen_track_sections, route):
            break
        for edge, edge_offset, path_offset in make_steps_on_route(route, distance_from_start):
            res.append((edge, edge_offset))
            step_offsets.append(path_offset)
        exit_point = route["exit_point"]["id"]
        if exit_point not in infra.routes_per_entry_point:
            break
        route_id = random_set_element(infra.routes_per_entry_point[exit_point])
    total_path_length = 0
    if len(step_offsets) > 1:
        total_path_length = step_offsets[-1] - step_offsets[0]
    return res, total_path_length


def make_valid_path(infra: InfraGraph) -> Tuple[List[Tuple[str, float]], float]:
    """
    Generates a path with at least two steps
    :param infra: infra graph
    :return: List of (edge id, offset) and path_length
    """
    while True:
        path, path_length = make_path(infra)
        if len(path) > 1:
            return path, path_length


def convert_stop(stop: Tuple[str, float]) -> Dict:
    """
    Converts a stop to be in the schedule payload
    :param stop: (track, offset)
    """
    track_section, offset = stop
    duration = 0 if random.randint(0, 1) == 0 else random.random() * 1000
    return {"duration": duration, "waypoints": [{"track_section": track_section, "offset": offset}]}


def make_payload_path(infra: int, path: List[Tuple[str, float]]) -> Dict:
    """
    Makes the pathfinding payload from the given path
    :param infra: infra id
    :param path: List of steps
    :return: Dict
    """
    path_payload = {"infra": infra, "name": "foo", "steps": [convert_stop(stop) for stop in path]}
    path_payload["steps"][-1]["duration"] = 1
    return path_payload


def create_schedule(base_url: str, infra_id: int):
    """
    Creates a schedule linked to the given infra
    :param base_url: api url
    :param infra_id: infra id
    """
    timetable_payload = {"name": "foo", "infra": infra_id}
    r = requests.post(base_url + "timetable/", json=timetable_payload, timeout=TIMEOUT)
    if r.status_code // 100 != 2:
        err = f"Error creating schedule {r.status_code}: {r.content}, payload={json.dumps(timetable_payload)}"
        raise RuntimeError(err)


def get_schedule(base_url: str, infra: int) -> str:
    """
    Get a schedule linked to the given infra
    :param base_url: Api URL
    :param infra: infra id
    :return: schedule id
    """
    r = requests.get(base_url + "timetable/", timeout=TIMEOUT)
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Rolling stock error {r.status_code}: {r.content}")
    schedules = r.json()["results"]
    for schedule in schedules:
        if schedule["infra"] == infra:
            return schedule["id"]
    # the schedule doesn't exist yet
    create_schedule(base_url, infra)
    return get_schedule(base_url, infra)


def make_random_allowances_value(allowance_length) -> Dict:
    if random.randint(0, 3) == 0:
        return {
            "value_type": "percentage",
            "percentage": random.randint(3, 20) + random.random(),
        }
    if random.randint(0, 3) == 0:
        return {
            "value_type": "time_per_distance",
            "minutes": random.randint(3, 7) + random.random(),
        }
    return {
        "value_type": "time",
        "seconds": (random.randint(3, 7) + random.random()) * 60 * allowance_length / 100000,
    }


def make_random_allowances(path_length: float) -> List[Dict]:
    """
    Makes a random allowance config
    :param path_length: the path length
    """
    res = []
    if random.randint(0, 3) == 0:
        res.append(
            {
                "allowance_type": "mareco",
                "default_value": make_random_allowances_value(path_length),
                "ranges": [],
                "capacity_speed_limit": 1
            }
        )
    for _ in range(3):
        if random.randint(0, 3) != 0:
            continue
        positions = [random.random() * path_length for _ in range(2)]
        res.append(
            {
                "allowance_type": "construction",
                "begin_position": min(positions),
                "end_position": max(positions),
                "value": make_random_allowances_value(max(positions) - min(positions)),
                "capacity_speed_limit": 1
            }
        )
    return res


def make_payload_schedule(base_url: str, infra: int, path: int, rolling_stock: str, path_length: float) -> Dict:
    """
    Makes the payload for the simulation
    :param base_url: Api URL
    :param infra: infra id
    :param path: path id
    :param rolling_stock: rolling stock id
    :param path_length: the path length
    :return: payload
    """
    return {
        "timetable": get_schedule(base_url, infra),
        "path": path,
        "schedules": [
            {
                "train_name": "foo",
                "labels": [],
                "departure_time": 0,
                "allowances": make_random_allowances(path_length),
                "initial_speed": 0,
                "rolling_stock": rolling_stock,
            }
        ],
    }


if __name__ == "__main__":
    run(URL, 1, 1000, Path(__file__).parent / "errors")
