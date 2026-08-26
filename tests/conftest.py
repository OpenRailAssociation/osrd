import json
import os
import subprocess
from collections.abc import Iterator, Mapping
from dataclasses import dataclass
from pathlib import Path

import pytest
from requests import Session
from requests.adapters import HTTPAdapter
from urllib3.util import Retry

from tests.infra import Infra
from tests.path import Path as TrainPath
from tests.scenario import Scenario
from tests.services import EDITOAST_URL
from tests.utils.timetable import create_scenario, ms_since_epoch


def _load_generated_infra(session: Session, name: str) -> int:
    infra_path = Path(__file__).parent / f"data/infras/{name}/infra.json"
    with infra_path.open() as json_infra:
        infra_json = json.load(json_infra)
    res = session.post(
        EDITOAST_URL + f"infra/railjson?name={name}&generate_data=true", json=infra_json
    )
    res.raise_for_status()
    return res.json()["infra"]


@pytest.fixture(scope="session")
def tiny_infra(session: Session) -> Iterator[Infra]:
    infra_id = _load_generated_infra(session, "tiny_infra")
    yield Infra(infra_id, "tiny_infra")
    session.delete(EDITOAST_URL + f"infra/{infra_id}/")


@pytest.fixture(scope="session")
def small_infra(session: Session) -> Iterator[Infra]:
    """small_infra screenshot in `tests/README.md`"""
    infra_id = _load_generated_infra(session, "small_infra")
    yield Infra(infra_id, "small_infra")
    session.delete(EDITOAST_URL + f"infra/{infra_id}/")


@pytest.fixture(scope="session")
def etcs_infra(session: Session) -> Iterator[Infra]:
    infra_id = _load_generated_infra(session, "etcs_infra")
    yield Infra(infra_id, "etcs_infra")
    session.delete(EDITOAST_URL + f"infra/{infra_id}/")


@pytest.fixture(scope="session")
def session() -> Iterator[Session]:
    yield session_no_fixture()


TEST_USER_IDENTITY = "tests/integration"
TEST_USER_NAME = "Integration tests"

# Roles can only be granted through the editoast CLI, so the user is created by running it
# in the editoast container. Override the name if the container isn't the compose one.
EDITOAST_CONTAINER = os.environ.get("OSRD_EDITOAST_CONTAINER", "osrd-editoast")


def create_admin_user() -> None:
    """
    Create the admin user the tests authenticate as, if it doesn't already exist

    Both editoast commands are idempotent, so this can be called before every run.
    """
    for command in (
        ["user", "add", "--skip-if-exists", TEST_USER_NAME, TEST_USER_IDENTITY],
        ["roles", "add", TEST_USER_IDENTITY, "Admin"],
    ):
        process = subprocess.run(
            ["docker", "exec", EDITOAST_CONTAINER, "editoast", *command],
            capture_output=True,
            text=True,
            check=False,  # the returncode is reported below, with the CLI output
        )
        if process.returncode != 0:
            raise RuntimeError(
                f"Failed to create the admin user the tests authenticate as: "
                f"`editoast {' '.join(command)}` in container '{EDITOAST_CONTAINER}' "
                f"exited with {process.returncode}.\n{process.stderr}"
            )


def session_no_fixture() -> Session:
    """
    Used to generate a session without calling a fixture, useful for standalone scripts (e.g. fuzzer)
    """
    create_admin_user()
    # A failed request will retry up to 5 times with the following timings [2, 4, 8, 16, 32] for a total of 62 seconds
    retry_strategy = Retry(
        total=5,
        backoff_factor=2,
        status_forcelist=[429, 500, 502, 503, 504],
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session = Session()
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    session.headers.update(
        {
            "x-remote-user-identity": TEST_USER_IDENTITY,
            "x-remote-user-name": TEST_USER_NAME,
        }
    )
    return session


@pytest.fixture
def foo_project_id(session: Session) -> Iterator[int]:
    response = session.post(
        EDITOAST_URL + "projects/",
        json={
            "name": "_@Test integration project",
            "description": "",
            "objectives": "",
            "funders": "",
            "tags": [],
            "budget": 0,
        },
    )
    project_id = response.json()["id"]
    yield project_id
    session.delete(EDITOAST_URL + f"projects/{project_id}/")


@pytest.fixture
def foo_study_id(foo_project_id: int, session: Session) -> Iterator[int]:
    payload = {
        "project_id": foo_project_id,
        "name": "_@Test integration study",
        "state": "Starting",
        "service_code": "AAA",
        "business_code": "BBB",
        "tags": [],
    }
    res = session.post(EDITOAST_URL + "studies/", json=payload)
    yield res.json()["id"]


@pytest.fixture
def tiny_scenario(
    tiny_infra: Infra, foo_project_id: int, foo_study_id: int, session: Session
) -> Iterator[Scenario]:
    scenario_id, timetable_id, train_schedule_set_id = create_scenario(
        EDITOAST_URL, tiny_infra.id, foo_study_id, session
    )
    yield Scenario(
        foo_project_id,
        foo_study_id,
        scenario_id,
        tiny_infra.id,
        timetable_id,
        train_schedule_set_id,
    )


@pytest.fixture
def small_scenario(
    small_infra: Infra, foo_project_id: int, foo_study_id: int, session: Session
) -> Iterator[Scenario]:
    scenario_id, timetable_id, train_schedule_set_id = create_scenario(
        EDITOAST_URL, small_infra.id, foo_study_id, session
    )
    yield Scenario(
        foo_project_id,
        foo_study_id,
        scenario_id,
        small_infra.id,
        timetable_id,
        train_schedule_set_id,
    )


@pytest.fixture
def etcs_scenario(
    etcs_infra: Infra, foo_project_id: int, foo_study_id: int, session: Session
) -> Iterator[Scenario]:
    scenario_id, timetable_id, train_schedule_set_id = create_scenario(
        EDITOAST_URL, etcs_infra.id, foo_study_id, session
    )
    yield Scenario(
        foo_project_id,
        foo_study_id,
        scenario_id,
        etcs_infra.id,
        timetable_id,
        train_schedule_set_id,
    )


def get_rolling_stock_id(
    session: Session, editoast_url: str, rolling_stock_name: str
) -> int:
    """
    Returns the ID corresponding to the rolling stock name, if available.
    """
    page = 1
    while page is not None:
        # TODO: feel free to reduce page_size when https://github.com/OpenRailAssociation/osrd/issues/5350 is fixed
        r = session.get(
            editoast_url + "light_rolling_stock/",
            params={"page": page, "page_size": 1_000},
        )
        if r.status_code // 100 != 2:
            raise RuntimeError(f"Rolling stock error {r.status_code}: {r.content}")
        rjson = r.json()
        for rolling_stock in rjson["results"]:
            if rolling_stock["name"] == rolling_stock_name:
                return rolling_stock["id"]
        page = rjson.get("next")
    raise ValueError(f"Unable to find rolling stock {rolling_stock_name}")


FAST_ROLLING_STOCK_JSON_PATH = (
    Path(__file__).parents[1]
    / "editoast"
    / "schemas"
    / "examples"
    / "fast_rolling_stock.json"
)

# Rolling-stock derived from fast rolling stock, but able to travel under ETCS signaling
ETCS_ROLLING_STOCK_JSON_PATH = (
    Path(__file__).parents[1]
    / "tests"
    / "data"
    / "rolling_stocks"
    / "etcs_level2_rolling_stock.json"
)


@dataclass
class TestRollingStock:
    name: str
    metadata: Mapping
    base_path: Path
    __test__: bool


# Mark the class as not a test class
TestRollingStock.__test__ = False


def create_rolling_stock(
    session: Session,
    rolling_stock_json_path: Path,
    test_rolling_stocks: list[TestRollingStock] | None = None,
) -> list[int]:
    if test_rolling_stocks is None:
        payload = json.loads(rolling_stock_json_path.read_text())
        response = session.post(f"{EDITOAST_URL}rolling_stock/", json=payload)
        rjson = response.json()
        if response.status_code // 100 == 4 and "NameAlreadyUsed" in rjson["type"]:
            return [
                get_rolling_stock_id(session, EDITOAST_URL, rjson["context"]["name"])
            ]
        assert "id" in rjson, f"Failed to create rolling stock: {rjson}"
        return [rjson["id"]]
    ids = []
    for rs in test_rolling_stocks:
        payload = json.loads(rs.base_path.read_text())
        payload["name"] = rs.name
        payload["metadata"] = rs.metadata
        ids.append(
            session.post(f"{EDITOAST_URL}rolling_stock/", json=payload).json()["id"]
        )
    return ids


@pytest.fixture(scope="session")
def fast_rolling_stock(session: Session) -> Iterator[int]:
    rs_id = create_rolling_stock(session, FAST_ROLLING_STOCK_JSON_PATH)[0]
    yield rs_id
    session.delete(f"{EDITOAST_URL}rolling_stock/{rs_id}?force=true")


@pytest.fixture(scope="session")
def etcs_rolling_stock(session: Session) -> Iterator[int]:
    rs_id = create_rolling_stock(session, ETCS_ROLLING_STOCK_JSON_PATH)[0]
    yield rs_id
    session.delete(f"{EDITOAST_URL}rolling_stock/{rs_id}?force=true")


@pytest.fixture
def west_to_south_east_path(
    session: Session, small_infra: Infra, fast_rolling_stock: int
) -> Iterator[TrainPath]:
    """west_to_south_east_path screenshot in `tests/README.md`"""
    response = session.post(
        f"{EDITOAST_URL}infra/{small_infra.id}/pathfinding/blocks",
        json={
            "path_items": [
                {
                    "location": {
                        "type": "track_offset",
                        "offset": 837034,
                        "track": "TA2",
                    },
                    "can_backtrack": False,
                },
                {
                    "location": {
                        "type": "track_offset",
                        "offset": 4386000,
                        "track": "TH1",
                    },
                    "can_backtrack": False,
                },
            ],
            "rolling_stock_is_thermal": True,
            "rolling_stock_loading_gauge": "G1",
            "rolling_stock_supported_electrifications": [],
            "rolling_stock_supported_signaling_systems": [
                "BAL",
                "BAPR",
                "TVM300",
                "TVM430",
                "ETCS_LEVEL2",
            ],
            "rolling_stock_maximum_speed": 200,
            "rolling_stock_length": 100000,
            "stops_at_end_of_block": False,
        },
    )
    yield TrainPath(**response.json())


@pytest.fixture
def west_to_south_east_simulation(
    session: Session,
    small_scenario: Scenario,
    fast_rolling_stock: int,
) -> Iterator[dict]:
    response = session.get(EDITOAST_URL + f"light_rolling_stock/{fast_rolling_stock}")
    fast_rolling_stock_name = response.json()["name"]
    response = session.post(
        f"{EDITOAST_URL}train_schedule_sets/{small_scenario.train_schedule_set}/train_schedules/",
        json=[
            {
                "constraint_distribution": "STANDARD",
                "path": [
                    {
                        "location": {
                            "type": "track_offset",
                            "track": "TA2",
                            "offset": 837034,
                        },
                        "id": "a",
                    },
                    {
                        "location": {
                            "type": "track_offset",
                            "track": "TH1",
                            "offset": 4386000,
                        },
                        "id": "b",
                    },
                ],
                "schedule": [{"at": "b", "stop_for": "PT0S"}],
                "rolling_stock_name": fast_rolling_stock_name,
                "train_name": "foo",
                "speed_limit_tag": "foo",
                "start_time": ms_since_epoch("2024-01-01T07:19:54Z"),
            }
        ],
    )
    yield response.json()


@pytest.fixture
def west_to_south_east_paced_train(
    session: Session,
    small_scenario: Scenario,
    fast_rolling_stock: int,
) -> Iterator[dict]:
    response = session.get(EDITOAST_URL + f"light_rolling_stock/{fast_rolling_stock}")
    fast_rolling_stock_name = response.json()["name"]
    response = session.post(
        f"{EDITOAST_URL}train_schedule_sets/{small_scenario.train_schedule_set}/train_schedules/",
        json=[
            {
                "constraint_distribution": "STANDARD",
                "path": [
                    {
                        "location": {
                            "type": "track_offset",
                            "track": "TA2",
                            "offset": 837034,
                        },
                        "id": "a",
                    },
                    {
                        "location": {
                            "type": "track_offset",
                            "track": "TH1",
                            "offset": 4386000,
                        },
                        "id": "b",
                    },
                ],
                "schedule": [{"at": "b", "stop_for": "PT0S"}],
                "rolling_stock_name": fast_rolling_stock_name,
                "train_name": "foo",
                "speed_limit_tag": "foo",
                "start_time": ms_since_epoch("2024-01-01T07:19:54Z"),
                "paced": {
                    "time_window": "PT2H",
                    "interval": "PT15M",
                },
            }
        ],
    )
    yield response.json()


@pytest.fixture
def west_to_south_east_paced_trains(
    session: Session,
    small_scenario: Scenario,
    fast_rolling_stock: int,
) -> Iterator[dict]:
    response = session.get(EDITOAST_URL + f"light_rolling_stock/{fast_rolling_stock}")
    fast_rolling_stock_name = response.json()["name"]

    base = {
        "constraint_distribution": "STANDARD",
        "path": [
            {
                "location": {"type": "track_offset", "track": "TA2", "offset": 837034},
                "id": "a",
            },
            {
                "location": {"type": "track_offset", "track": "TH1", "offset": 4386000},
                "id": "b",
            },
        ],
        "rolling_stock_name": fast_rolling_stock_name,
        "train_name": "foo",
        "speed_limit_tag": "foo",
    }

    response = session.post(
        f"{EDITOAST_URL}train_schedule_sets/{small_scenario.train_schedule_set}/train_schedules/",
        json=[
            {
                **base,
                "start_time": ms_since_epoch("2024-01-01T07:19:54Z"),
                "paced": {
                    "time_window": "PT2H",
                    "interval": "PT15M",
                },
            },
            {
                **base,
                "start_time": ms_since_epoch("2024-01-01T10:29:54Z"),
                "paced": {
                    "time_window": "PT2H",
                    "interval": "PT15M",
                },
            },
            {
                **base,
                "start_time": ms_since_epoch("2024-01-01T13:39:59Z"),
                "paced": {
                    "time_window": "PT2H",
                    "interval": "PT15M",
                },
            },
        ],
    )
    yield response.json()


@pytest.fixture
def west_to_south_east_etcs_simulation(
    session: Session,
    etcs_scenario: Scenario,
    etcs_rolling_stock: int,
) -> Iterator[dict]:
    rolling_stock_response = session.get(
        EDITOAST_URL + f"light_rolling_stock/{etcs_rolling_stock}"
    )
    etcs_rolling_stock_name = rolling_stock_response.json()["name"]
    response = session.post(
        f"{EDITOAST_URL}train_schedule_sets/{etcs_scenario.train_schedule_set}/train_schedules/",
        json=[
            {
                "constraint_distribution": "STANDARD",
                "path": [
                    {
                        "location": {
                            "type": "track_offset",
                            "track": "TA2",
                            "offset": 837034,
                        },
                        "id": "a",
                    },
                    {
                        "location": {
                            "type": "track_offset",
                            "track": "TH1",
                            "offset": 4386000,
                        },
                        "id": "b",
                    },
                ],
                "schedule": [{"at": "b", "stop_for": "PT0S"}],
                "rolling_stock_name": etcs_rolling_stock_name,
                "train_name": "foo",
                "start_time": ms_since_epoch("2024-01-01T07:19:54Z"),
            }
        ],
    )
    yield response.json()


@pytest.fixture
def west_to_south_east_simulations(
    session: Session,
    small_scenario: Scenario,
    fast_rolling_stock: int,
) -> Iterator[dict]:
    response = session.get(EDITOAST_URL + f"light_rolling_stock/{fast_rolling_stock}")
    fast_rolling_stock_name = response.json()["name"]

    base = {
        "constraint_distribution": "STANDARD",
        "path": [
            {
                "location": {"type": "track_offset", "track": "TA2", "offset": 837034},
                "id": "a",
            },
            {
                "location": {"type": "track_offset", "track": "TH1", "offset": 4386000},
                "id": "b",
            },
        ],
        "rolling_stock_name": fast_rolling_stock_name,
        "train_name": "foo",
        "speed_limit_tag": "foo",
    }

    response = session.post(
        f"{EDITOAST_URL}train_schedule_sets/{small_scenario.train_schedule_set}/train_schedules/",
        json=[
            {
                **base,
                "start_time": ms_since_epoch("2024-01-01T07:19:54Z"),
            },
            {
                **base,
                "start_time": ms_since_epoch("2024-01-01T07:29:54Z"),
            },
            {
                **base,
                "start_time": ms_since_epoch("2024-01-01T07:39:59Z"),
            },
        ],
    )
    yield response.json()


@pytest.fixture
def timetable_id(session: Session) -> int:
    r = session.post(f"{EDITOAST_URL}timetable/", json={"timetable_type": "CALENDAR"})
    if not r.ok:
        raise RuntimeError(f"Error creating timetable {r.status_code}: {r.content}")
    return r.json()["timetable_id"]


@pytest.fixture
def train_schedule_set_id(session: Session, timetable_id: int) -> int:
    r = session.post(
        f"{EDITOAST_URL}train_schedule_sets/",
        json={
            "name": None,
            "catalog_entry": None,
            "description": "",
            "published": False,
            "timetable_type": "CALENDAR",
        },
    )
    r.raise_for_status()
    train_schedule_set_id = r.json()["id"]
    session.post(
        f"{EDITOAST_URL}timetable/{timetable_id}/train_schedule_sets/",
        json={"train_schedule_set_ids": [train_schedule_set_id]},
    )
    return train_schedule_set_id
