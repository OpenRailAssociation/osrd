from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Tuple, Iterable, List, Set
import json
import random
import requests
import time


URL = "http://127.0.0.1:8000/"
TIMEOUT = 10


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
    path = make_valid_path(infra)
    path_payload = make_payload_path(infra_id, path)
    r = requests.post(base_url + "pathfinding/", json=path_payload, timeout=TIMEOUT)
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Pathfinding error {r.status_code}: {r.content}, payload={json.dumps(path_payload)}")
    path_id = r.json()["id"]

    rolling_stock = get_random_rolling_stock(base_url)

    schedule_payload = make_payload_schedule(base_url, infra_id, path_id, rolling_stock)
    r = requests.post(base_url + "train_schedule/", json=schedule_payload, timeout=TIMEOUT)
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Schedule error {r.status_code}: {r.content}, payload={json.dumps(schedule_payload)}")

    schedule_id = r.json()["id"]
    r = requests.get(f"{base_url}train_schedule/{schedule_id}/result/", timeout=TIMEOUT)
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Schedule error {r.status_code}: {r.content}, id={schedule_id}")

    print("test PASSED")


def run(base_url: str, infra_id: int, n_test: int = 1000):
    """
    Runs every test
    :param base_url: url to reach the api
    :param infra_id: infra id
    :param n_test: number of tests to run
    """
    seed = 0
    infra_graph = make_graph(base_url, infra_id)
    for i in range(n_test):
        seed += 1
        print("seed:", seed)
        random.seed(seed)
        run_test(infra_graph, base_url, infra_id)
        time.sleep(0.1)


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


def make_steps_on_route(route: Dict) -> Iterable[Tuple[str, float]]:
    """
    Generates a random list of steps on a route
    :return: Iterable of (edge id, offset)
    """
    for track_range in route["path"]:
        if random.randint(0, 5) == 0:
            begin = track_range["begin"]
            end = track_range["end"]
            offset = begin + random.random() * (end - begin)
            yield track_range["track"]["id"], offset


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


def make_path(infra: InfraGraph) -> List[Tuple[str, float]]:
    """
    Generates a path in the infra following the route graph. The path may only have a single element
    :param infra: infra
    :return: List of (edge id, offset)
    """
    res = []
    seen_track_sections = set()
    route_id = random_set_element(infra.routes.keys())
    while random.randint(0, 15) != 0:
        route = infra.routes[route_id]
        if not check_tracks_are_unseen(seen_track_sections, route):
            break
        res += make_steps_on_route(route)
        exit_point = route["exit_point"]["id"]
        if exit_point not in infra.routes_per_entry_point:
            break
        route_id = random_set_element(infra.routes_per_entry_point[exit_point])
    return res


def make_valid_path(infra: InfraGraph) -> List[Tuple[str, float]]:
    """
    Generates a path with at least two steps
    :param infra: infra
    :return: List of (edge id, offset)
    """
    while True:
        path = make_path(infra)
        if len(path) > 1:
            return path


def convert_stop(stop: Tuple[str, float]) -> Dict:
    """
    Converts a stop to be in the schedule payload
    :param stop: (track, offset)
    """
    track_section, offset = stop
    stop_time = 0 if random.randint(0, 1) == 0 else random.random() * 1000
    return {
        "stop_time": stop_time,
        "waypoints": [{
            "track_section": track_section,
            "offset": offset
        }]
    }


def make_payload_path(infra: int, path: List[Tuple[str, float]]) -> Dict:
    """
    Makes the pathfinding payload from the given path
    :param infra: infra id
    :param path: List of steps
    :return: Dict
    """
    return {
        "infra": infra,
        "name": "foo",
        "steps": [
            convert_stop(stop) for stop in path
        ]
    }


def create_schedule(base_url: str, infra_id: int):
    """
    Creates a schedule linked to the given infra
    :param base_url: api url
    :param infra_id: infra id
    """
    timetable_payload = {
        "name": "foo",
        "infra": infra_id
    }
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


def make_random_margins() -> List[Dict]:
    """
    Makes a random allowance config
    """
    res = []
    if random.randint(0, 3) == 0:
        res.append({
            "type": "construction",
            "value": random.random() * 10 + 3
        })
    if random.randint(0, 3) == 0:
        res.append({
                "type": "ratio_time",
                "value": random.random() * 50 + 10
            })
    if random.randint(0, 3) == 0:
        res.append({
            "type": "ratio_distance",
            "value": random.random() * 50 + 10
        })
    random.shuffle(res)
    return res


def make_payload_schedule(base_url: str, infra: int, path: int, rolling_stock: str) -> Dict:
    """
    Makes the payload for the simulation
    :param base_url: Api URL
    :param infra: infra id
    :param path: path id
    :param rolling_stock: rolling stock id
    :return: payload
    """
    return {
        "train_name": "foo",
        "labels": [],
        "departure_time": 0,
        "phases": [],
        "margins": make_random_margins(),
        "initial_speed": 0,
        "timetable": get_schedule(base_url, infra),
        "rolling_stock": rolling_stock,
        "path": path
    }


if __name__ == "__main__":
    run(URL, 2)
