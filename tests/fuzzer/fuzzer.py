from collections import defaultdict
from pathlib import Path
from typing import Dict, Tuple, Iterable, List
import json
import random
import requests
import time


URL = "http://127.0.0.1:8000/"


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
    path = make_valid_path(infra, links)
    path_payload = make_payload_path(infra_id, path)
    r = requests.post(base_url + "pathfinding/", json=path_payload)
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

    schedule_payload = make_payload_schedule(base_url, infra_id, path_id, rolling_stock)
    r = requests.post(base_url + "train_schedule/", json=schedule_payload)
    if r.status_code // 100 != 2:
        if "TVD" in str(r.content):
            print("ignore (see issue https://github.com/DGEXSolutions/osrd/issues/171)")
            return
        raise RuntimeError(f"Schedule error {r.status_code}: {r.content}, payload={json.dumps(schedule_payload)}")

    schedule_id = r.json()["id"]
    r = requests.get(f"{base_url}train_schedule/{schedule_id}/result/")
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
        try:
            run_test(infra, links, base_url, infra_id)
        except Exception as e:
            print(e)
            error_folder = Path(__file__).parent / "errors"
            error_folder.mkdir(exist_ok=True)
            with open(str(error_folder / f"{i}.txt"), "w") as f:
                print(e, file=f)
        time.sleep(1)


def get_random_rolling_stock(base_url: str) -> str:
    """
    Returns a random rolling stock ID
    :param base_url: Api url
    :return: ID of a valid rolling stock
    """
    r = requests.get(base_url + "rolling_stock/")
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
    r = requests.get(url)
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


def make_steps_on_edge(infra: Dict, point: str) -> Iterable[Tuple[str, float]]:
    """
    Generates a random list of steps on an edge
    :param infra: RJS infra
    :param point: endpoint
    :return: Iterable of (edge id, offset)
    """
    edge_id, endpoint = point.split(";")
    edges = infra["track_sections"]
    edge = next(filter(lambda e: e["id"] == edge_id, edges))
    length = edge["length"]
    n_stops = random.randint(0, 2)
    offsets = [random.random() * length for _ in range(n_stops)]
    if endpoint == "BEGIN":
        offsets.sort()
    else:
        offsets.sort(reverse=True)
    for offset in offsets:
        yield edge_id, offset


def make_path(infra: Dict, links: Dict) -> List[Tuple[str, float]]:
    """
    Generates a path in the infra following links. The path may only have a single element
    :param infra: RJS infra
    :param links: Dict of adjacent endpoints
    :return: List of (edge id, offset)
    """
    res = []
    p = random_set_element(links)
    while random.randint(0, 15) != 0:
        res += make_steps_on_edge(infra, p)
        o = opposite(p)
        if o not in links:
            return res
        next_points = links[o]
        if not next_points:
            return res
        p = random_set_element(next_points)
    return res


def make_valid_path(infra: Dict, links: Dict) -> List[Tuple[str, float]]:
    """
    Generates a path with at least two steps
    :param infra: RJS infra
    :param links: Dict of adjacent endpoints
    :return: List of (edge id, offset)
    """
    while True:
        path = make_path(infra, links)
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
    r = requests.post(base_url + "timetable/", json=timetable_payload)
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
    r = requests.get(base_url + "timetable/")
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
