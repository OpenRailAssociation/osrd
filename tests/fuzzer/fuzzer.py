import json
import random
import time
from collections import defaultdict
from dataclasses import dataclass, field
from enum import Enum, IntEnum
from pathlib import Path
from typing import Dict, Iterable, List, Set, Tuple

import requests

URL = "http://127.0.0.1:8000/"
TIMEOUT = 15
INFRA_ID = 1


"""
Generates random tests, running pathfinding + simulations on random paths.
This requires a running database setup with actual infra data, which can't be publicly available on github
"""


class FailedTest(Exception):
    pass


class ErrorType(str, Enum):
    PATHFINDING = "PATHFINDING"
    SCHEDULE = "SCHEDULE"
    RESULT = "RESULT"
    STDCM = "STDCM"


class Endpoint(IntEnum):
    BEGIN = 0
    END = 1

    def opposite(self):
        return Endpoint.END if self == Endpoint.BEGIN else Endpoint.BEGIN


@dataclass(eq=True, frozen=True)
class TrackEndpoint:
    track: str
    endpoint: Endpoint

    @staticmethod
    def from_dict(obj: Dict) -> "TrackEndpoint":
        return TrackEndpoint(obj["track"], Endpoint._member_map_[obj["endpoint"]])


@dataclass
class InfraGraph:
    RJSInfra: Dict
    tracks: Dict[str, Dict] = field(default_factory=dict)
    links: Dict[TrackEndpoint, List[TrackEndpoint]] = field(default_factory=lambda: defaultdict(list))

    def link(self, a: TrackEndpoint, b: TrackEndpoint):
        self.links[a].append(b)
        self.links[b].append(a)


def make_error(error_type: ErrorType, code: int, error: str, infra_name: str, path_payload: Dict, **kwargs):
    raise FailedTest(
        {
            "error_type": error_type.value,
            "code": code,
            "error": error,
            "infra_name": infra_name,
            "path_payload": path_payload,
            **kwargs,
        }
    )


def run_test(infra: InfraGraph, base_url: str, infra_id: int, infra_name: str):
    """
    Runs a single random test
    :param infra_name: name of the infra, for better reporting
    :param infra: infra graph
    :param base_url: Api url
    :param infra_id: Infra id
    """
    rolling_stock = get_random_rolling_stock(base_url)
    path, path_length = make_valid_path(infra)
    if random.randint(0, 1) == 0:
        test_new_train(base_url, infra_id, rolling_stock, path_length, infra_name, path)
    else:
        test_stdcm(base_url, infra_id, rolling_stock, infra_name, path)


def test_new_train(
    base_url: str, infra_id: int, rolling_stock: int, path_length: float, infra_name: str, path: List[Tuple[str, float]]
):
    """
    Try to run a pathfinding, then create a train using the given path.
    Ignores impossible simulation (40x errors) on the second step.
    """
    print("testing new train")
    path_payload = make_payload_path(infra_id, path)
    r = requests.post(base_url + "pathfinding/", json=path_payload, timeout=TIMEOUT)
    if r.status_code // 100 != 2:
        make_error(ErrorType.PATHFINDING, r.status_code, r.content.decode("utf-8"), infra_name, path_payload)
    path_id = r.json()["id"]
    schedule_payload = make_payload_schedule(base_url, infra_id, path_id, rolling_stock, path_length)
    r = requests.post(base_url + "train_schedule/standalone_simulation/", json=schedule_payload, timeout=TIMEOUT)
    if r.status_code // 100 != 2:
        if r.status_code // 100 == 4:
            print("ignore: invalid user input")
            return
        make_error(
            ErrorType.SCHEDULE,
            r.status_code,
            r.content.decode("utf-8"),
            infra_name,
            path_payload,
            schedule_payload=schedule_payload,
        )

    schedule_id = r.json()["ids"][0]
    r = requests.get(f"{base_url}train_schedule/{schedule_id}/result/", timeout=TIMEOUT)
    if r.status_code // 100 != 2:
        make_error(
            ErrorType.RESULT,
            r.status_code,
            r.content.decode("utf-8"),
            infra_name,
            path_payload,
            schedule_payload=schedule_payload,
            schedule_id=schedule_id,
        )

    payload = r.json()
    assert "line_code" in payload["base"]["stops"][0]
    assert "track_number" in payload["base"]["stops"][0]
    print("test PASSED")


def test_stdcm(base_url: str, infra_id: int, rolling_stock: int, infra_name: str, path: List[Tuple[str, float]]):
    """
    Try to run an STDCM search on the given path.
    Not finding a path isn't considered as an error, we only look for 500 codes here.
    """
    print("testing stdcm")
    stdcm_payload = make_stdcm_payload(base_url, infra_id, path, rolling_stock)
    r = requests.post(base_url + "stdcm/", json=stdcm_payload, timeout=TIMEOUT)
    if r.status_code // 100 != 2:
        if r.status_code // 100 == 4:
            print("ignore: invalid user input")
            return
        make_error(
            ErrorType.STDCM,
            r.status_code,
            r.content.decode("utf-8"),
            infra_name,
            {},
            stdcm_payload=stdcm_payload,
        )
    print("test PASSED")


def make_stdcm_payload(base_url: str, infra_id: int, path: List[Tuple[str, float]], rolling_stock: int) -> Dict:
    """
    Creates a payload for an STDCM request
    """
    start_edge, start_offset = path[0]
    last_edge, last_offset = path[1]
    return {
        "infra": infra_id,
        "rolling_stock": rolling_stock,
        "timetable": get_schedule(base_url, infra_id),
        "start_time": 0,
        "start_points": [
            {
                "track_section": start_edge,
                "offset": start_offset,
            }
        ],
        "end_points": [
            {
                "track_section": last_edge,
                "offset": last_offset,
            }
        ],
    }


def run(
    base_url: str, infra_id: int, n_test: int = 1000, log_folder: Path = None, infra_name: str = None, seed: int = 0
):
    """
    Runs every test
    :param seed: first seed, incremented by 1 for each individual test
    :param infra_name: name of the infra, for better reporting
    :param base_url: url to reach the api
    :param infra_id: infra id
    :param n_test: number of tests to run
    :param log_folder: (optional) path to a folder to log errors in
    """
    infra_graph = make_graph(base_url, infra_id)
    for i in range(n_test):
        seed += 1
        print("seed:", seed)
        random.seed(seed)
        time.sleep(0.1)

        try:
            run_test(infra_graph, base_url, infra_id, infra_name)
        except Exception as e:
            if log_folder is None:
                raise e
            else:
                print(e)
                log_folder.mkdir(exist_ok=True)
                with open(str(log_folder / f"{i}.json"), "w") as f:
                    print(json.dumps(e.args[0]), file=f)


def get_random_rolling_stock(base_url: str) -> int:
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
    return rolling_stock["id"]


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
    infra = r.json()
    graph = InfraGraph(infra)

    for track in infra["track_sections"]:
        graph.tracks[track["id"]] = track

    for link in infra["track_section_links"]:
        graph.link(TrackEndpoint.from_dict(link["src"]), TrackEndpoint.from_dict(link["dst"]))

    for switch in infra["switches"]:
        assert switch["switch_type"] == "point"
        base = TrackEndpoint.from_dict(switch["ports"]["base"])
        left = TrackEndpoint.from_dict(switch["ports"]["left"])
        right = TrackEndpoint.from_dict(switch["ports"]["right"])
        graph.link(base, left)
        graph.link(base, right)
    return graph


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
        track_id = track_range["track"]
        if track_id in seen_track_sections:
            return False
        seen_track_sections.add(track_id)
    return True


def make_steps_on_track(track: Dict, endpoint: Endpoint, number: float) -> List[float]:
    """
    Generates a random list of steps on a route
    :return: Iterable of (edge id, edge offset, offset from the start)
    """
    res = []
    while random.random() < number:
        number -= 1.0
        res.append(random.random() * track["length"])
    res.sort()
    if endpoint == Endpoint.BEGIN:
        res.reverse()
    return res


def make_path(infra: InfraGraph) -> Tuple[List[Tuple[str, float]], float]:
    """
    Generates a path in the infra following the route graph. The path may only have a single element
    :param infra: infra
    :return: List of (edge id, offset)
    """
    res = []
    seen_track_sections = set()
    track_id = random_set_element(infra.tracks.keys())
    endpoint = Endpoint(random.randint(0, 1))
    tmp_path_length = 0
    total_path_length = 0
    while random.randint(0, 15) != 0:
        track = infra.tracks[track_id]
        if track_id in seen_track_sections:
            break
        seen_track_sections.add(track_id)

        chance = 2 if len(res) == 0 else 0.5
        new_steps = make_steps_on_track(track, endpoint, chance)
        for track_offset in new_steps:
            res.append((track_id, track_offset))

        # compute path length
        if len(new_steps) == 2:
            # First track (we got two new initial steps)
            total_path_length = abs(new_steps[1] - new_steps[0])
            tmp_path_length = new_steps[1]
            if endpoint == Endpoint.END:
                tmp_path_length = track["length"] - new_steps[1]
        elif len(new_steps) == 1:
            # A new step
            total_path_length += tmp_path_length
            if endpoint == Endpoint.END:
                total_path_length += new_steps[0]
                tmp_path_length = track["length"] - new_steps[0]
            else:
                total_path_length += track["length"] - new_steps[0]
                tmp_path_length = new_steps[0]
        else:
            tmp_path_length += track["length"]

        # Find next track
        neighbors: List[TrackEndpoint] = infra.links[TrackEndpoint(track_id, endpoint)]
        if len(neighbors) == 0:
            break
        neighbor: TrackEndpoint = random_set_element(neighbors)
        track_id = neighbor.track
        endpoint = neighbor.endpoint.opposite()

    return res, total_path_length


def make_valid_path(infra: InfraGraph) -> Tuple[List[Tuple[str, float]], float]:
    """
    Generates a path with at least two steps
    :param infra: infra graph
    :return: List of (edge id, offset) and path_length
    """
    while True:
        path, path_length = make_path(infra)
        if len(path) > 1 and path_length > 0:
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


def make_random_allowance_value(allowance_length) -> Dict:
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


def make_random_ranges(path_length: float) -> List[Dict]:
    if random.randint(0, 1) == 0:
        return []
    n_transitions = 1 + 2 * random.randint(0, 3)
    transitions = [random.random() * path_length for _ in range(n_transitions)]
    transitions += [0, path_length]
    transitions.sort()
    for begin, end in zip(transitions[:1], transitions[1:]):
        yield {
            "begin_position": begin,
            "end_position": end,
            "value": make_random_allowance_value(end - begin),
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
                "allowance_type": "standard",
                "default_value": make_random_allowance_value(path_length),
                "ranges": list(make_random_ranges(path_length)),
                "capacity_speed_limit": random.random() * 10,
                "distribution": "MARECO" if random.randint(0, 1) == 0 else "LINEAR",
            }
        )
    for _ in range(3):
        if random.randint(0, 3) != 0:
            continue
        positions = [random.random() * path_length for _ in range(2)]
        res.append(
            {
                "allowance_type": "engineering",
                "begin_position": min(positions),
                "end_position": max(positions),
                "value": make_random_allowance_value(max(positions) - min(positions)),
                "capacity_speed_limit": random.random() * 10,
                "distribution": "MARECO" if random.randint(0, 1) == 0 else "LINEAR",
            }
        )
    return res


def make_payload_schedule(base_url: str, infra: int, path: int, rolling_stock: int, path_length: float) -> Dict:
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
                "departure_time": random.randint(0, 3600 * 24),
                "allowances": make_random_allowances(path_length),
                "initial_speed": 0,
                "rolling_stock": rolling_stock,
                "speed_limit_category": "foo",
            }
        ],
    }


def get_infra_name(base_url: str, infra_id: int):
    r = requests.get(base_url + f"infra/{infra_id}/", timeout=TIMEOUT)
    return r.json()["name"]


if __name__ == "__main__":
    run(URL, INFRA_ID, 10000, Path(__file__).parent / "errors", infra_name=get_infra_name(URL, INFRA_ID))
