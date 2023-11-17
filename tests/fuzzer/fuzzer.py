import json
import random
import time
from collections import defaultdict
from collections.abc import Iterator
from dataclasses import dataclass, field
from enum import Enum, IntEnum
from functools import cache
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Set, Tuple

import requests
from osrd_schemas.switch_type import builtin_node_types
from requests import Response, Timeout

# TODO: we may want to use more qualified imports
import conftest
from tests.scenario import Scenario

TIMEOUT = 15
# Note that regression tests expect small_infra.
INFRA_NAME = "small_infra"
# Consistent rolling stock is useful for regression testing, otherwise set None for randomness.
ROLLING_STOCK_NAME = "fast_rolling_stock"
EDITOAST_URL = "http://127.0.0.1:8090/"


"""
Generates random tests, running pathfinding + simulations on random paths.
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


def make_error(
    error_type: ErrorType,
    response: Response,
    infra_name: str,
    path_payload: Dict,
    **kwargs,
):
    """
    Generate an error in a format that can be logged in a json and integrated in the test suite
    """
    error = "" if response.content is None else response.content.decode("utf-8")
    raise FailedTest(
        {
            "error_type": error_type.value,
            "code": response.status_code,
            "error": error,
            "infra_name": infra_name,
            "path_payload": path_payload,
            **kwargs,
        }
    )


def run_test(
    infra: InfraGraph,
    editoast_url: str,
    scenario: Scenario,
    infra_name: str,
    prelude: List,
    rolling_stock_name: Optional[str],
):
    """
    Runs a single random test
    :param infra: infra graph
    :param editoast_url: Api url
    :param scenario: Scenario to use for the test
    :param infra_name: name of the infra, for better reporting
    :param prelude: path/schedule requests sent so far
    :param rolling_stock_name: rolling stock to use, random if None
    """
    rolling_stock = (
        get_random_rolling_stock(editoast_url)
        if rolling_stock_name is None
        else get_rolling_stock(editoast_url, rolling_stock_name)
    )
    path, path_length = make_valid_path(infra)
    if random.randint(0, 1) == 0:
        test_new_train(editoast_url, scenario, rolling_stock, path_length, infra_name, path, prelude)
    else:
        test_stdcm(editoast_url, scenario, rolling_stock, infra_name, path, prelude)


def test_new_train(
    editoast_url: str,
    scenario: Scenario,
    rolling_stock: int,
    path_length: float,
    infra_name: str,
    path: List[Tuple[str, float]],
    prelude: List,
):
    """
    Try to run a pathfinding, then create a train using the given path.
    Ignores impossible simulation (40x errors) on the second step.
    """
    print("testing new train")
    path_payload = make_payload_path(scenario.infra, path)
    r = post_with_timeout(editoast_url + "pathfinding/", json=path_payload)
    if r.status_code // 100 != 2:
        if r.status_code // 100 == 4:
            print("ignore: invalid user input")
            return
        make_error(
            ErrorType.PATHFINDING,
            r,
            infra_name,
            path_payload,
        )
    path_id = r.json()["id"]
    schedule_payload = make_payload_schedule(scenario, path_id, rolling_stock, path_length)
    r = post_with_timeout(
        editoast_url + "train_schedule/standalone_simulation/",
        json=schedule_payload,
    )
    if r.status_code // 100 != 2:
        if r.status_code // 100 == 4:
            print("ignore: invalid user input")
            return
        make_error(
            ErrorType.SCHEDULE,
            r,
            infra_name,
            path_payload,
            schedule_payload=schedule_payload,
        )

    prelude.append({"path_payload": path_payload, "schedule_payload": schedule_payload})

    schedule_id = r.json()[0]
    r = get_with_timeout(f"{editoast_url}train_schedule/{schedule_id}/result/")
    if r.status_code // 100 != 2:
        make_error(
            ErrorType.RESULT,
            r,
            infra_name,
            path_payload,
            schedule_payload=schedule_payload,
            schedule_id=schedule_id,
        )

    payload = r.json()
    assert "line_code" in payload["base"]["stops"][0]
    assert "track_number" in payload["base"]["stops"][0]
    print("test PASSED")


def test_stdcm(
    editoast_url: str,
    scenario: Scenario,
    rolling_stock: int,
    infra_name: str,
    path: List[Tuple[str, float]],
    prelude: List,
):
    """
    Try to run an STDCM search on the given path.
    Not finding a path isn't considered as an error, we only look for 500 codes here.
    """
    print("testing stdcm")
    stdcm_payload = make_stdcm_payload(scenario, path, rolling_stock)
    r = post_with_timeout(editoast_url + "stdcm/", json=stdcm_payload)
    if r.status_code // 100 != 2:
        content = r.content.decode("utf-8")
        if r.status_code // 100 == 4 and "No path could be found" in content:
            print("ignore: no path found")
            return
        make_error(ErrorType.STDCM, r, infra_name, {}, stdcm_payload=stdcm_payload, prelude=prelude)
    print("test PASSED")


def make_stdcm_payload(scenario: Scenario, path: List[Tuple[str, float]], rolling_stock: int) -> Dict:
    """
    Creates a payload for an STDCM request
    """
    res = {
        "infra_id": scenario.infra,
        "rolling_stock_id": rolling_stock,
        "timetable_id": scenario.timetable,
        "start_time": random.randint(0, 3600 * 24),
        "maximum_departure_delay": random.randint(0, 3600 * 4),
        "maximum_run_time": random.randint(3600 * 5, 3600 * 10),
        "margin_before": random.randint(0, 600),
        "margin_after": random.randint(0, 600),
        "steps": [convert_stop(stop) for stop in path],
        "comfort": "STANDARD",
        "standard_allowance": {
            "value_type": "percentage",
            "percentage": 0,
        },
    }
    allowance_value = make_random_allowance_value(0)
    if allowance_value["value_type"] != "time" and random.randint(0, 2) == 0:
        res["standard_allowance"] = allowance_value
    return res


def run(
    editoast_url: str,
    scenario: Scenario,
    scenario_ttl: int = 20,
    n_test: int = 1000,
    log_folder: Optional[Path] = None,
    infra_name: Optional[str] = None,
    seed: int = 0,
    rolling_stock_name: Optional[str] = None,
):
    """
    Runs every test
    :param editoast_url: url to reach the editoast api
    :param scenario: scenario to use for the tests
    :param scenario_ttl: number of tests to run before a scenario reset
    :param n_test: number of tests to run
    :param log_folder: (optional) path to a folder to log errors in
    :param infra_name: name of the infra, for better reporting
    :param seed: first seed, incremented by 1 for each individual test
    :param rolling_stock_name: rolling stock to use, random if None

    Note that this is called from tests/tests/test_with_fuzzer.py
    TODO: we may want to clarify the interface, e.g. by using underscores elsewhere
    """
    print("loading infra")
    infra_graph = make_graph(editoast_url, scenario.infra)
    requests.post(editoast_url + f"infra/{scenario.infra}/load").raise_for_status()
    # The prelude allows us to keep track of path/schedule requests sent so far,
    # so we can easily reproduce the current state.
    prelude = []
    for i in range(n_test):
        seed += 1
        print("seed:", seed)
        random.seed(seed)
        time.sleep(0.1)

        try:
            run_test(infra_graph, editoast_url, scenario, infra_name, prelude, rolling_stock_name)
        except Exception as e:
            if log_folder is None:
                raise e
            else:
                print(e)
                log_folder.mkdir(exist_ok=True)
                with open(str(log_folder / f"{i}.json"), "w") as f:
                    print(json.dumps(e.args[0], indent=4), file=f)

        # Let's reset the scenario (empty timetable) so we can keep a
        # manageable/reproducible state.
        if seed % scenario_ttl == 0:
            scenario = reset_scenario(editoast_url, scenario)
            prelude = []


@cache
def get_rolling_stock(editoast_url: str, rolling_stock_name: str) -> int:
    """
    Returns the ID corresponding to the rolling stock name, if available.
    :param editoast_url: Api url
    :param rolling_stock_name: name of the rolling stock
    :return: ID the rolling stock
    """
    return conftest.get_rolling_stock(editoast_url, rolling_stock_name)


def get_random_rolling_stock(editoast_url: str) -> int:
    """
    Returns a random rolling stock ID
    :param editoast_url: Api url
    :return: ID of a valid rolling stock
    """
    # TODO: we may want to check more pages, for more randomness
    r = get_with_timeout(editoast_url + "light_rolling_stock/")
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


def make_graph(editoast_url: str, infra: int) -> InfraGraph:
    """
    Makes a graph from the infra
    :param editoast_url: editoast url
    :param infra: infra id
    """
    url = editoast_url + f"infra/{infra}/railjson/"
    r = get_with_timeout(url)
    infra = r.json()
    graph = InfraGraph(infra)

    for track in infra["track_sections"]:
        graph.tracks[track["id"]] = track

    for switch in infra["switches"]:
        switch_type = builtin_node_types()[switch["switch_type"]]
        for group in switch_type["groups"].values():
            for pair in group:
                src = TrackEndpoint.from_dict(switch["ports"][pair["src"]])
                dst = TrackEndpoint.from_dict(switch["ports"][pair["dst"]])
                graph.link(src, dst)
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
    return {
        "duration": duration,
        "waypoints": [{"track_section": track_section, "offset": offset}],
    }


def make_payload_path(infra: int, path: List[Tuple[str, float]]) -> Dict:
    """
    Makes the pathfinding payload from the given path
    :param infra: infra id
    :param path: List of steps
    :return: Dict
    """
    path_payload = {
        "infra": infra,
        "name": "foo",
        "steps": [convert_stop(stop) for stop in path],
    }
    path_payload["steps"][-1]["duration"] = 1
    return path_payload


def create_scenario(editoast_url: str, infra_id: int) -> Scenario:
    # Create the project
    project_payload = {"name": "fuzzer_project"}
    r = post_with_timeout(editoast_url + "projects/", json=project_payload)
    r.raise_for_status()
    project_id = r.json()["id"]
    project_url = f"projects/{project_id}"

    # Create the study
    study_payload = {"name": "fuzzer_study"}
    r = post_with_timeout(editoast_url + f"{project_url}/studies/", json=study_payload)
    r.raise_for_status()
    study_id = r.json()["id"]
    study_url = f"{project_url}/studies/{study_id}"

    # Create the scenario
    scenario_payload = {
        "name": "fuzzer_scenario",
        "infra_id": infra_id,
    }
    r = post_with_timeout(editoast_url + f"{study_url}/scenarios/", json=scenario_payload)
    r.raise_for_status()
    timetable_id = r.json()["timetable_id"]
    id = r.json()["id"]
    return Scenario(project_id, study_id, id, infra_id, timetable_id)


def reset_scenario(editoast_url: str, scenario: Scenario) -> Scenario:
    """Deletes the current scenario and creates a new one."""
    print("scenario reset")
    project_id, study_id, infra_id = scenario.project, scenario.op_study, scenario.infra

    # Delete the current scenario
    study_url = f"projects/{project_id}/studies/{study_id}"
    r = delete_with_timeout(editoast_url + study_url + f"/scenarios/{scenario.scenario}")
    r.raise_for_status()

    # Create a new scenario
    new_scenario_payload = {
        "name": "fuzzer_scenario",
        "infra_id": infra_id,
    }
    r = post_with_timeout(editoast_url + f"{study_url}/scenarios", json=new_scenario_payload)
    r.raise_for_status()
    new_timetable_id = r.json()["timetable_id"]
    new_id = r.json()["id"]
    return Scenario(project_id, study_id, new_id, infra_id, new_timetable_id)


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


def make_random_ranges(path_length: float) -> Iterator[Dict]:
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
                "capacity_speed_limit": 1 + random.random() * 30,
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
                "capacity_speed_limit": 1 + random.random() * 30,
                "distribution": "MARECO" if random.randint(0, 1) == 0 else "LINEAR",
            }
        )
    return res


def make_payload_schedule(scenario: Scenario, path: int, rolling_stock: int, path_length: float) -> Dict:
    """
    Makes the payload for the simulation
    :param scenario: scenario used for the test
    :param path: path id
    :param rolling_stock: rolling stock id
    :param path_length: the path length
    :return: payload
    """
    return {
        "timetable": scenario.timetable,
        "path": path,
        "schedules": [
            {
                "train_name": "foo",
                "labels": [],
                "departure_time": random.randint(0, 3600 * 24),
                "allowances": make_random_allowances(path_length),
                "initial_speed": 0,
                "rolling_stock_id": rolling_stock,
                "speed_limit_category": "foo",
            }
        ],
    }


def delete_with_timeout(*args, **kwargs) -> Response:
    return request_with_timeout("delete", *args, **kwargs)


def post_with_timeout(*args, **kwargs) -> Response:
    return request_with_timeout("post", *args, **kwargs)


def get_with_timeout(*args, **kwargs) -> Response:
    return request_with_timeout("get", *args, **kwargs)


def request_with_timeout(request_type: str, *args, **kwargs) -> Response:
    """
    Run a post or get request, catching timeout exceptions to return a 500
    """
    try:
        if request_type == "post":
            return requests.post(*args, timeout=TIMEOUT, **kwargs)
        elif request_type == "get":
            return requests.get(*args, timeout=TIMEOUT, **kwargs)
        elif request_type == "delete":
            return requests.delete(*args, timeout=TIMEOUT, **kwargs)
        else:
            raise ValueError(f"Unsupported request type {request_type}")
    except Timeout:
        res = Response()
        res.status_code = 500
        return res


def get_infra(editoast_url: str, infra_name: str) -> int:
    """
    Returns the ID corresponding to the infra name, if available.
    :param editoast_url: Api url
    :param infra_name: name of the infra
    :return: ID the infra
    """
    # TODO: we may want a generic pages handler, if we keep adding queries
    page = 1
    while page is not None:
        r = requests.get(editoast_url + "infra/", params={"page": page})
        if r.status_code // 100 != 2:
            raise RuntimeError(f"Infra error {r.status_code}: {r.content}")
        rjson = r.json()
        for infra in rjson["results"]:
            if infra["name"] == infra_name:
                return infra["id"]
        page = rjson.get("next")
    raise ValueError(f"Unable to find infra {infra_name}")


if __name__ == "__main__":
    infra_id = get_infra(EDITOAST_URL, INFRA_NAME)
    new_scenario = create_scenario(EDITOAST_URL, infra_id)
    if ROLLING_STOCK_NAME == "fast_rolling_stock":
        try:
            get_rolling_stock(EDITOAST_URL, ROLLING_STOCK_NAME)
        except ValueError:
            conftest.create_fast_rolling_stocks(test_rolling_stocks=None)
    run(
        EDITOAST_URL,
        new_scenario,
        scenario_ttl=20,
        n_test=10000,
        log_folder=Path(__file__).parent / "errors",
        infra_name=INFRA_NAME,
        seed=0,
        rolling_stock_name=ROLLING_STOCK_NAME,
    )
