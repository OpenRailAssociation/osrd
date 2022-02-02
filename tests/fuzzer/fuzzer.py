import json
import random
import time
from collections import defaultdict
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

import requests

URL = "http://127.0.0.1:8000/"
TIMEOUT = 10


"""
Generates random tests, running pathfinding + simulations on random paths.
This requires a running database setup with actual infra data, which can't be publicly available on github
"""


def run_test(infra: Dict, links: Dict, base_url: str, infra_id: int):
    """
    Runs a single random test
    :param infra: Infra in railjson format
    :param links: Dict of adjacent endpoints
    :param base_url: Api url
    :param infra_id: Infra id
    """
    path, path_length = make_valid_path(infra, links)
    path_payload = make_payload_path(infra_id, path)
    r = requests.post(base_url + "pathfinding/", json=path_payload, timeout=TIMEOUT)
    if r.status_code // 100 != 2:
        if "track section that has no route" in str(r.content):
            print("ignore (track section has no route)")
            return
        if "No path could be found" in str(r.content):
            #  This sometimes happens when a step is on a track with no route: annoying but not an actual bug
            print("ignore (no path could be found)")
            return
        raise RuntimeError(f"Pathfinding error {r.status_code}: {r.content}, payload={json.dumps(path_payload)}")
    path_id = r.json()["id"]
    rolling_stock = get_random_rolling_stock(base_url)

    schedule_payload = make_payload_schedule(base_url, infra_id, path_id, rolling_stock, path_length)
    r = requests.post(base_url + "train_schedule/standalone_simulation/", json=schedule_payload, timeout=TIMEOUT)
    if r.status_code // 100 != 2:
        if "TVD" in str(r.content):
            print("ignore (see issue https://github.com/DGEXSolutions/osrd/issues/171)")
            return
        raise RuntimeError(f"Schedule error {r.status_code}: {r.content}, payload={json.dumps(schedule_payload)}")

    schedule_id = r.json()["ids"][0]
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
    infra, links = make_graph(base_url, infra_id)
    for i in range(n_test):
        seed += 1
        print("seed:", seed)
        random.seed(seed)
        run_test(infra, links, base_url, infra_id)
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


def convert_endpoint(endpoint: Dict) -> str:
    """
    Converts and endpoint from a railjson dict to a string
    Example: {"track": {"id": "some-id", ...}, "endpoint": "END"} -> "some-id;END"
    :param endpoint: endpoint
    :return: Endpoint encoded as a string
    """
    section = endpoint["track"]["id"]
    return f'{section};{endpoint["endpoint"]}'


def make_graph(base_url: str, infra: int) -> Tuple[Dict, Dict]:
    """
    Makes a graph from the infra, returns both links and the RJS infra
    The links are represented as a dict, keys are endpoints, values are a list of adjacent endpoints
    :param base_url: infra url
    :param infra: infra id
    """
    url = base_url + f"infra/{infra}/railjson/"
    r = requests.get(url, timeout=TIMEOUT)
    links = defaultdict(lambda: set())
    infra = r.json()
    for link in infra["track_section_links"]:
        begin = convert_endpoint(link["src"])
        end = convert_endpoint(link["dst"])
        links[begin].add(end)
        links[end].add(begin)
    return infra, dict(links)


def opposite(endpoint: str) -> str:
    """
    Returns the opposite endpoint
    :param endpoint: Endpoint encoded as a string
    :return: Opposite endpoint
    """
    point_id, end = endpoint.split(";")
    if end == "BEGIN":
        return f"{point_id};END"
    else:
        return f"{point_id};BEGIN"


def random_set_element(s: Iterable):
    """
    Picks a random element in an iterable
    """
    return random.choice(list(s))


def make_steps_on_edge(infra: Dict, point: str, path_length: [float]) -> Iterable[Tuple[str, float]]:
    """
    Generates a random list of steps on an edge
    :param infra: RJS infra
    :param point: endpoint
    :param path_length: ref on the path_length
    :return: Iterable of (edge id, offset)
    """
    edge_id, endpoint = point.split(";")
    edges = infra["track_sections"]
    edge = next(filter(lambda e: e["id"] == edge_id, edges))
    length = edge["length"]
    path_length[0] += length
    n_stops = random.randint(0, 2)
    offsets = [(random.random() * 0.9 + 0.05) * length for _ in range(n_stops)]
    offsets.append(0)
    offsets.append(length)
    if endpoint == "BEGIN":
        offsets.sort()
    else:
        offsets.sort(reverse=True)
    for offset in offsets:
        yield edge_id, offset


def get_any_endpoint(infra: Dict) -> str:
    """
    Returns a random endpoint of a random track
    :param infra: infra
    :return: formatted endpoint
    """
    track = random.choice(infra["track_sections"])
    if (random.randint(0, 1)) == 0:
        endpoint = "BEGIN"
    else:
        endpoint = "END"
    return f"{track['id']};{endpoint}"


def make_path(infra: Dict, links: Dict) -> Tuple[List[Tuple[str, float]], float]:
    """
    Generates a path in the infra following links. The path may only have a single element
    :param infra: RJS infra
    :param links: Dict of adjacent endpoints
    :return: List of (edge id, offset) and path length
    """
    res = []
    path_length = [0]  # Ref on path_length
    p = get_any_endpoint(infra)
    while random.randint(0, 15) != 0:
        res += make_steps_on_edge(infra, p, path_length)
        o = opposite(p)
        if o not in links:
            return res, path_length[0]
        next_points = links[o]
        if not next_points:
            return res, path_length[0]
        p = random_set_element(next_points)
    return res, path_length[0]


def make_valid_path(infra: Dict, links: Dict) -> Tuple[List[Tuple[str, float]], float]:
    """
    Generates a path with at least two steps
    :param infra: RJS infra
    :param links: Dict of adjacent endpoints
    :return: List of (edge id, offset) and path_length
    """
    while True:
        path, path_length = make_path(infra, links)
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


def make_random_allowances_value() -> Dict:
    if random.randint(0, 3) == 0:
        return {
            "value_type": "percentage",
            "percentage": random.randint(3, 10) + random.random(),
        }
    if random.randint(0, 3) == 0:
        return {
            "value_type": "time_per_distance",
            "minutes": random.randint(3, 10) + random.random(),
        }
    return {
        "value_type": "time",
        "seconds": random.randint(10, 40) + random.random(),
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
                "default_value": make_random_allowances_value(),
                "ranges": [],
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
                "value": make_random_allowances_value(),
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
    run(URL, 2)
