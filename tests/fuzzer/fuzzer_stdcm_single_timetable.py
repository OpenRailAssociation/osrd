import datetime
import json
import random
from dataclasses import dataclass
from pathlib import Path
from collections.abc import Iterable

from requests import Session

from fuzzer.fuzzer import (
    _get_random_rolling_stock,
    _random_set_element,
    _to_ms,
    get_infra,
)
import conftest
from tests.scenario import Scenario

_TIMEOUT = 300

_EDITOAST_URL = "http://127.0.0.1:8090/"
_INFRA_NAME = "France"
_TIMETABLE_ID = 0

"""
Generates random stdcm requests on a single infra + fixed timetable.
Much lighter than `fuzzer.py`, but can't generate regression tests.
Inputs that can't directly be set in the (non-debug) STDCM UI are fixed.

This isn't automatically run anywhere, it's only used by hand for more convenient
testing. May not always be up-to-date.

Note: on an imported infra and timetables, tests take a while.

Usage: `uv run python -m fuzzer.fuzzer_stdcm_single_timetable`
"""


@dataclass
class STDCMException(Exception):
    error: str | dict
    status_code: int | None = None
    payload: dict | None = None


@dataclass
class TimetableTimeRange:
    start: datetime.datetime
    end: datetime.datetime

    def make_random_time(self) -> str:
        delta = (self.end - self.start).seconds
        date = self.start + datetime.timedelta(seconds=(random.randint(0, delta)))
        return date.isoformat()


def run(
    editoast_url: str,
    scenario: Scenario,
    session: Session,
    n_test: int = 1000,
    log_folder: Path | None = None,
    seed: int | None = None,
):
    """
    Run the given number of tests, logging errors in the given folder as json files
    """
    timetable_range = _build_timetable_range(editoast_url, scenario, session)
    seed = seed or random.randint(0, 2**32)
    op_list = list(_make_op_list(editoast_url, scenario.infra, session))
    for i in range(n_test):
        seed += 1
        print("seed:", seed)
        random.seed(seed)
        try:
            _test_stdcm(editoast_url, op_list, scenario, timetable_range, session)
        except STDCMException as e:
            if log_folder is None:
                raise e
            else:
                print(e.error)
                log_folder.mkdir(exist_ok=True)
                with open(str(log_folder / f"{i}.json"), "w") as f:
                    print(
                        json.dumps(
                            {
                                "error": e.error,
                                "payload": e.payload,
                            },
                            indent=4,
                            default=lambda o: "<not serializable>",
                        ),
                        file=f,
                    )


def _get_train_ids(
    editoast_url: str, scenario: Scenario, session: Session
) -> list[int]:
    """
    Fetch all the train IDs in the scenario
    """
    page = 1
    res = []
    while page is not None:
        r = session.get(
            f"{editoast_url}/timetable/{scenario.timetable}/train_schedules/?page={page}"
        )
        r.raise_for_status()
        parsed = r.json()
        for schedule in parsed["results"]:
            res.append(schedule["id"])
        page = parsed.get("next")
    return res


def _build_timetable_range(
    editoast_url, scenario, session: Session
) -> TimetableTimeRange:
    """
    Build the (approximate) range in which the timetable contains trains
    """
    print("building timetable time range")
    train_ids = _get_train_ids(editoast_url, scenario, session)
    train_ids = random.sample(train_ids, min(100, len(train_ids)))
    train_times = list()
    for train_id in train_ids:
        r = session.get(f"{editoast_url}/train_schedule/{train_id}")
        r.raise_for_status()
        start_time = datetime.datetime.strptime(
            r.json()["start_time"], "%Y-%m-%dT%H:%M:%SZ"
        )
        start_time = start_time.astimezone(datetime.timezone.utc)
        train_times.append(start_time)
    if not train_times:
        t = datetime.datetime(year=2024, month=1, day=1, tzinfo=datetime.timezone.utc)
        return TimetableTimeRange(
            start=t,
            end=t,
        )
    else:
        return TimetableTimeRange(
            start=min(train_times), end=max(train_times) + datetime.timedelta(hours=3)
        )


def _make_op_list(editoast_url, infra, session: Session) -> Iterable[int]:
    print("loading infra to generate op list")
    url = editoast_url + f"infra/{infra}/railjson/"
    r = session.get(url)
    infra = r.json()
    for op in infra["operational_points"]:
        yield op["extensions"]["identifier"]["uic"]


def _test_stdcm(
    editoast_url: str,
    op_list: list[int],
    scenario: Scenario,
    timetable_range: TimetableTimeRange,
    session: Session,
):
    """
    Run a single test instance
    """
    stdcm_payload = None
    try:
        rolling_stock = _get_random_rolling_stock(editoast_url, session)
        stdcm_payload = _make_stdcm_payload(op_list, rolling_stock.id, timetable_range)
        r = session.post(
            editoast_url
            + f"/timetable/{scenario.timetable}/stdcm/?infra={scenario.infra}",
            json=stdcm_payload,
            timeout=_TIMEOUT,
        )
        if r.status_code // 100 != 2:
            is_json = "application/json" in r.headers.get("Content-Type", "")
            raise STDCMException(
                error=r.json() if is_json else str(r.content),
                status_code=r.status_code,
            )
    except STDCMException as e:
        e.payload = stdcm_payload
        raise e
    except Exception as e:
        raise STDCMException(error=str(e), payload=stdcm_payload)
    print("test PASSED")


def _make_stdcm_payload(
    op_list: list[int], rolling_stock: int, timetable_range: TimetableTimeRange
) -> dict:
    """
    Generate a random stdcm payload
    """
    res = {
        "rolling_stock_id": rolling_stock,
        "steps": _make_steps(op_list, timetable_range),
        "comfort": "STANDARD",
        "margin": "5%",
    }
    return res


def _make_steps(op_list: list[int], timetable_range: TimetableTimeRange) -> list[dict]:
    """
    Generate steps for the stdcm payloads
    """
    steps = []
    # Steps aren't sorted in any way, so long path are much more likely to fail
    n_steps = random.randint(2, 3)
    for _ in range(n_steps):
        steps.append(
            {
                "location": {
                    "uic": _random_set_element(op_list),
                }
            }
        )
    index_set_time = random.randint(-1, 0)  # first or last
    steps[index_set_time]["timing_data"] = {
        "arrival_time": timetable_range.make_random_time(),
        "arrival_time_tolerance_before": _to_ms(random.randint(0, 4 * 3_600)),
        "arrival_time_tolerance_after": _to_ms(random.randint(0, 4 * 3_600)),
    }
    steps[index_set_time]["duration"] = 1

    steps[-1]["duration"] = 1  # Force a stop at the end
    return steps


if __name__ == "__main__":
    session = next(conftest.session())
    infra_id = get_infra(_EDITOAST_URL, _INFRA_NAME, session)
    run(
        _EDITOAST_URL,
        scenario=Scenario(-1, -1, -1, infra_id, _TIMETABLE_ID),
        session=session,
        n_test=10_000,
        log_folder=Path(__file__).parent / "errors",
    )
