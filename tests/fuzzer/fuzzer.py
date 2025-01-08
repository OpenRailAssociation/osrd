import datetime
import json
import math
import random
import time
from collections import defaultdict
from dataclasses import dataclass, field
from enum import Enum, IntEnum
from functools import cache
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple, TypeVar

import requests
from osrd_schemas.switch_type import builtin_node_types
from requests import Response, Timeout

# TODO: we may want to use more qualified imports
import conftest
from tests.scenario import Scenario

_TIMEOUT = 15

# The public regression test suite expects "small_infra".
# Regression tests can still be generated with a private infra,
# but it can't be part of this repository.
_INFRA_NAME = "small_infra"

# Consistent rolling stock is useful for regression testing, otherwise set None for randomness.
_ROLLING_STOCK_NAME = "fast_rolling_stock"

_EDITOAST_URL = "http://127.0.0.1:8090/"


"""
Generates random tests, running pathfinding + simulations on random paths.
"""


def run(
    editoast_url: str,
    scenario: Scenario,
    scenario_ttl: int = 20,
    n_test: int = 1000,
    log_folder: Optional[Path] = None,
    infra_name: Optional[str] = None,
    seed: Optional[int] = None,
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
    """
    print("loading infra")
    infra_graph = _make_graph(editoast_url, scenario.infra)
    requests.post(editoast_url + f"infra/{scenario.infra}/load").raise_for_status()
    # The prelude allows us to keep track of path/schedule requests sent so far,
    # so we can easily reproduce the current state.
    prelude = []
    seed = seed or random.randint(0, 2**32)
    for i in range(n_test):
        seed += 1
        print("seed:", seed)
        random.seed(seed)
        time.sleep(0.1)

        try:
            _run_test(infra_graph, editoast_url, scenario, infra_name, prelude, rolling_stock_name)
        except Exception as e:
            if log_folder is None:
                raise e
            else:
                print(e)
                log_folder.mkdir(exist_ok=True)
                with open(str(log_folder / f"{i}.json"), "w") as f:
                    print(json.dumps(e.args[0], indent=4, default=lambda o: "<not serializable>"), file=f)

        # Let's reset the scenario (empty timetable) so we can keep a
        # manageable/reproducible state.
        if seed % scenario_ttl == 0:
            scenario = _reset_timetable(editoast_url, scenario)
            prelude = []


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


def create_scenario(editoast_url: str, infra_id: int) -> Scenario:
    # Create the timetable
    r = _post_with_timeout(editoast_url + "/timetable/", json={})
    timetable_id = r.json()["timetable_id"]
    return Scenario(-1, -1, -1, infra_id, timetable_id)


class _FailedTest(Exception):
    pass


class _ErrorType(str, Enum):
    SCHEDULE = "SCHEDULE"
    RESULT = "RESULT"
    STDCM = "STDCM"


class _Endpoint(IntEnum):
    BEGIN = 0
    END = 1

    def opposite(self):
        return _Endpoint.END if self == _Endpoint.BEGIN else _Endpoint.BEGIN


@dataclass(eq=True, frozen=True)
class _TrackEndpoint:
    track: str
    endpoint: _Endpoint

    @staticmethod
    def from_dict(obj: Dict) -> "_TrackEndpoint":
        return _TrackEndpoint(obj["track"], _Endpoint._member_map_[obj["endpoint"]])


@dataclass
class _InfraGraph:
    RJSInfra: Dict
    tracks: Dict[str, Dict] = field(default_factory=dict)
    links: Dict[_TrackEndpoint, List[_TrackEndpoint]] = field(default_factory=lambda: defaultdict(list))

    def link(self, a: _TrackEndpoint, b: _TrackEndpoint):
        self.links[a].append(b)
        self.links[b].append(a)


@dataclass
class _RollingStock:
    name: str
    id: int


U = TypeVar("U")


def _make_error(
    error_type: _ErrorType,
    response: Response,
    infra_name: str,
    **kwargs,
):
    """
    Generate an error in a format that can be logged in a json and integrated in the test suite
    """
    error = "" if response.content is None else response.content.decode("utf-8")
    raise _FailedTest(
        {
            "error_type": error_type.value,
            "code": response.status_code,
            "error": error,
            "infra_name": infra_name,
            **kwargs,
        }
    )


def _run_test(
    infra: _InfraGraph,
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
        _get_random_rolling_stock(editoast_url)
        if rolling_stock_name is None
        else _get_rolling_stock(editoast_url, rolling_stock_name)
    )
    path = _make_valid_path(infra)

    if random.randint(0, 1) == 1:
        _test_new_train(editoast_url, scenario, rolling_stock.name, infra_name, path, prelude)
    else:
        _test_stdcm(editoast_url, scenario, rolling_stock.id, infra_name, path, prelude)


def _test_new_train(
    editoast_url: str,
    scenario: Scenario,
    rolling_stock: str,
    infra_name: str,
    path: List[Tuple[str, float]],
    prelude: List,
):
    """
    Try to create a new train on the given path.
    """
    print("testing new train")
    schedule_payload = _make_payload_schedule(path, rolling_stock)
    r = _post_with_timeout(
        editoast_url + f"/timetable/{scenario.timetable}/train_schedule/",
        json=schedule_payload,
    )
    if r.status_code // 100 != 2:
        _make_error(
            _ErrorType.SCHEDULE,
            r,
            infra_name,
            schedule_payload=schedule_payload,
        )

    sim_id = r.json()[0]["id"]
    r = _get_with_timeout(editoast_url + f"/train_schedule/{sim_id}/simulation/?infra_id={scenario.infra}")
    if r.status_code // 100 != 2 or r.json().get("status", "") != "success":
        _make_error(
            _ErrorType.RESULT,
            r,
            infra_name,
            schedule_payload=schedule_payload,
        )
    prelude.append({"schedule_payload": schedule_payload})
    print("test PASSED")


def _test_stdcm(
    editoast_url: str,
    scenario: Scenario,
    rolling_stock: int,
    infra_name: str,
    path: List[Tuple[str, float]],
    prelude: List,
):
    """
    Try to run an STDCM search on the given path.
    Not finding a path isn't considered as an error.
    """
    print("testing stdcm")
    stdcm_payload = _make_stdcm_payload(path, rolling_stock)
    r = _post_with_timeout(
        editoast_url + f"/timetable/{scenario.timetable}/stdcm/?infra={scenario.infra}", json=stdcm_payload
    )
    if r.status_code // 100 != 2:
        content = r.content.decode("utf-8")
        if r.status_code // 100 == 4 and "No path could be found" in content:
            print("ignore: no path found")
            return
        _make_error(_ErrorType.STDCM, r, infra_name, stdcm_payload=stdcm_payload, prelude=prelude)
    print("test PASSED")


def _make_stdcm_payload(path: List[Tuple[str, float]], rolling_stock: int) -> Dict:
    """
    Creates a payload for an STDCM request
    """
    res = {
        "rolling_stock_id": rolling_stock,
        "start_time": _make_random_time(),
        "maximum_departure_delay": random.randint(0, 3_600_000 * 4),
        "maximum_run_time": random.randint(3_600_000 * 5, 3_600_000 * 10),
        "time_gap_before": random.randint(0, 600_000),
        "time_gap_after": random.randint(0, 600_000),
        "steps": [_convert_stop_stdcm(stop) for stop in path],
        "comfort": "STANDARD",
        "margin": "0%",
    }
    res["steps"][-1]["duration"] = 1  # Force a stop at the end
    allowance_value = _make_random_margin_value()
    if random.randint(0, 2) == 0:
        res["standard_allowance"] = allowance_value
    return res


@cache
def _get_rolling_stock(editoast_url: str, rolling_stock_name: str) -> _RollingStock:
    """
    Returns the ID corresponding to the rolling stock name, if available.
    :param editoast_url: Api url
    :param rolling_stock_name: name of the rolling stock
    :return: ID the rolling stock
    """
    return _RollingStock(rolling_stock_name, conftest.get_rolling_stock(editoast_url, rolling_stock_name))


def _get_random_rolling_stock(editoast_url: str) -> _RollingStock:
    """
    Returns a random rolling stock ID
    :param editoast_url: Api url
    :return: ID of a valid rolling stock
    """
    # TODO: we may want to check more pages, for more randomness
    r = _get_with_timeout(editoast_url + "light_rolling_stock/")
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Rolling stock error {r.status_code}: {r.content}")
    stocks = r.json()["results"]
    rolling_stock = random.choice(stocks)
    return _RollingStock(rolling_stock["name"], rolling_stock["id"])


def _make_graph(editoast_url: str, infra: int) -> _InfraGraph:
    """
    Makes a graph from the infra
    :param editoast_url: editoast url
    :param infra: infra id
    """
    url = editoast_url + f"infra/{infra}/railjson/"
    r = _get_with_timeout(url)
    infra = r.json()
    graph = _InfraGraph(infra)

    for track in infra["track_sections"]:
        graph.tracks[track["id"]] = track

    for switch in infra["switches"]:
        switch_type = builtin_node_types()[switch["switch_type"]]
        for group in switch_type["groups"].values():
            for pair in group:
                src = _TrackEndpoint.from_dict(switch["ports"][pair["src"]])
                dst = _TrackEndpoint.from_dict(switch["ports"][pair["dst"]])
                graph.link(src, dst)
    return graph


def _random_set_element(s: Iterable[U]) -> U:
    """
    Picks a random element in an iterable
    """
    return random.choice(list(s))


def _make_steps_on_track(track: Dict, endpoint: _Endpoint, number: float) -> List[float]:
    """
    Generates a random list of steps on a route
    :return: Iterable of (edge id, edge offset, offset from the start)
    """
    res = []
    while random.random() < number:
        number -= 1.0
        res.append(random.random() * track["length"])
    res.sort()
    if endpoint == _Endpoint.BEGIN:
        res.reverse()
    return res


def _make_path(infra: _InfraGraph) -> Tuple[List[Tuple[str, float]], float]:
    """
    Generates a path in the infra following the route graph. The path may only have a single element
    :param infra: infra
    :return: List of (edge id, offset)
    """
    res = []
    seen_track_sections = set()
    track_id = _random_set_element(infra.tracks.keys())
    endpoint = _Endpoint(random.randint(0, 1))
    tmp_path_length = 0
    total_path_length = 0
    while random.randint(0, 15) != 0:
        track = infra.tracks[track_id]
        if track_id in seen_track_sections:
            break
        seen_track_sections.add(track_id)

        chance = 2 if len(res) == 0 else 0.5
        new_steps = _make_steps_on_track(track, endpoint, chance)
        for track_offset in new_steps:
            res.append((track_id, track_offset))

        # compute path length
        if len(new_steps) == 2:
            # First track (we got two new initial steps)
            total_path_length = abs(new_steps[1] - new_steps[0])
            tmp_path_length = new_steps[1]
            if endpoint == _Endpoint.END:
                tmp_path_length = track["length"] - new_steps[1]
        elif len(new_steps) == 1:
            # A new step
            total_path_length += tmp_path_length
            if endpoint == _Endpoint.END:
                total_path_length += new_steps[0]
                tmp_path_length = track["length"] - new_steps[0]
            else:
                total_path_length += track["length"] - new_steps[0]
                tmp_path_length = new_steps[0]
        else:
            tmp_path_length += track["length"]

        # Find next track
        neighbors: List[_TrackEndpoint] = infra.links[_TrackEndpoint(track_id, endpoint)]
        if len(neighbors) == 0:
            break
        neighbor: _TrackEndpoint = _random_set_element(neighbors)
        track_id = neighbor.track
        endpoint = neighbor.endpoint.opposite()

    return res, total_path_length


def _make_valid_path(infra: _InfraGraph) -> List[Tuple[str, float]]:
    """
    Generates a path with at least two steps
    :param infra: infra graph
    :return: List of (edge id, offset) and path_length
    """
    while True:
        path, path_length = _make_path(infra)
        if len(path) > 1 and path_length > 0:
            return path


def _convert_stop_stdcm(stop: Tuple[str, float]) -> Dict:
    """
    Converts a stop to be in the stdcm payload
    :param stop: (track, offset)
    """
    track_section, offset = stop
    duration = None if random.randint(0, 1) == 0 else _to_ms(random.random() * 1_000)
    return {
        "duration": duration,
        "location": {"track": track_section, "offset": _to_mm(offset)},
    }


def _convert_stop(stop: Tuple[str, float], i: int) -> Dict:
    """
    Converts a stop to be in the schedule payload
    :param stop: (track, offset)
    :param i: index of the stop, included as an id
    """
    track_section, offset = stop
    return {"offset": _to_mm(offset), "track": track_section, "id": str(i)}


def _reset_timetable(editoast_url: str, scenario: Scenario) -> Scenario:
    """Deletes the current timetable and creates a new one."""
    # Delete the current timetable
    r = _delete_with_timeout(editoast_url + f"/timetable/{scenario.timetable}/")
    r.raise_for_status()

    # Create a timetable
    r = _post_with_timeout(editoast_url + "/timetable/", json={})
    timetable_id = r.json()["timetable_id"]
    return Scenario(-1, -1, -1, infra_id, timetable_id)


def _make_random_margin_value() -> str:
    if random.randint(0, 2) == 0:
        return f"{random.randint(0, 20)}%"
    return f"{random.randint(0, 7)}min/100km"


def _make_random_margins(n_steps: int) -> Dict:
    transitions = []
    i = 1
    while i < n_steps - 3:
        if random.randint(0, 3) == 0:
            transitions.append(str(i + 1))
            i += 2  # Avoids constraints on very short ranges
    return {
        "boundaries": transitions,
        "values": [_make_random_margin_value() for _ in range(len(transitions) + 1)],
    }


def _make_payload_schedule(
    path: List[Tuple[str, float]],
    rolling_stock: str,
) -> List:
    """
    Makes the payload for the simulation
    :param path: path id
    :param rolling_stock: rolling stock id
    :return: payload
    """
    return [
        {
            "comfort": "STANDARD",
            "path": [_convert_stop(stop, i) for i, stop in enumerate(path)],
            "initial_speed": 0,
            "labels": [],
            "constraint_distribution": random.choice(["STANDARD", "MARECO"]),
            "margins": _make_random_margins(len(path)),
            "options": {"use_electrical_profiles": False},
            "rolling_stock_name": rolling_stock,
            "schedule": [],
            "speed_limit_tag": None,
            "start_time": _make_random_time(),
            "train_name": "fuzzer_train",
        }
    ]


def _make_random_time():
    """
    Generate a random datetime. All values will be within the same 24h
    """
    start = datetime.datetime(year=2024, month=1, day=1, tzinfo=datetime.timezone.utc)  # Arbitrary date
    date = start + datetime.timedelta(seconds=(random.randint(0, 3600 * 24)))
    return date.isoformat()


def _delete_with_timeout(*args, **kwargs) -> Response:
    return _request_with_timeout("delete", *args, **kwargs)


def _post_with_timeout(*args, **kwargs) -> Response:
    return _request_with_timeout("post", *args, **kwargs)


def _get_with_timeout(*args, **kwargs) -> Response:
    return _request_with_timeout("get", *args, **kwargs)


def _request_with_timeout(request_type: str, *args, **kwargs) -> Response:
    """
    Run a post or get request, catching timeout exceptions to return a 500
    """
    try:
        if request_type == "post":
            return requests.post(*args, timeout=_TIMEOUT, **kwargs)
        elif request_type == "get":
            return requests.get(*args, timeout=_TIMEOUT, **kwargs)
        elif request_type == "delete":
            return requests.delete(*args, timeout=_TIMEOUT, **kwargs)
        else:
            raise ValueError(f"Unsupported request type {request_type}")
    except Timeout:
        res = Response()
        res.status_code = 500
        return res


def _to_mm(distance: float) -> int:
    return math.floor(distance * 1_000)


_to_ms = _to_mm


if __name__ == "__main__":
    infra_id = get_infra(_EDITOAST_URL, _INFRA_NAME)
    new_scenario = create_scenario(_EDITOAST_URL, infra_id)
    if _ROLLING_STOCK_NAME == "fast_rolling_stock":
        try:
            _get_rolling_stock(_EDITOAST_URL, _ROLLING_STOCK_NAME)
        except ValueError:
            conftest.create_rolling_stock(conftest.FAST_ROLLING_STOCK_JSON_PATH, test_rolling_stocks=None)
    run(
        _EDITOAST_URL,
        new_scenario,
        scenario_ttl=20,
        n_test=100,
        log_folder=Path(__file__).parent / "errors",
        infra_name=_INFRA_NAME,
        rolling_stock_name=_ROLLING_STOCK_NAME,
    )
