import bisect
import json
from collections.abc import Sequence
from typing import Any, Dict

import requests

from tests.infra import Infra

from .scenario import Scenario
from .services import EDITOAST_URL


def _update_simulation_with_mareco_allowances(editoast_url, train_Schedule_id):
    response = requests.get(editoast_url + f"/train_schedule/{train_Schedule_id}/")
    assert response.status_code == 200
    train_schedule = response.json()
    train_schedule["margins"] = {
        "boundaries": [],
        "values": ["3%"],
    }
    train_schedule["constraint_distribution"] = "MARECO"
    r = requests.put(editoast_url + f"/train_schedule/{train_Schedule_id}", json=train_schedule)
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Schedule error {r.status_code}: {r.content}, payload={json.dumps(train_schedule)}")
    r = requests.get(editoast_url + f"/train_schedule/{train_Schedule_id}/")
    body = r.json()
    assert body["constraint_distribution"] == "MARECO"
    return body


def test_get_and_update_schedule_result(west_to_south_east_simulation: Sequence[Any], small_infra: Infra):
    schedule = west_to_south_east_simulation[0]
    schedule_id = schedule["id"]
    response = requests.get(f"{EDITOAST_URL}train_schedule/{schedule_id}/")
    if response.status_code // 100 != 2:
        raise RuntimeError(f"Schedule error {response.status_code}: {response.content}, id={schedule_id}")
    response = requests.get(f"{EDITOAST_URL}train_schedule/{schedule_id}/simulation?infra_id={small_infra.id}")
    simulation_report = response.json()
    assert simulation_report["base"]["energy_consumption"] == simulation_report["final_output"]["energy_consumption"]

    response = _update_simulation_with_mareco_allowances(EDITOAST_URL, schedule_id)
    response = requests.get(f"{EDITOAST_URL}train_schedule/{schedule_id}/")
    if response.status_code // 100 != 2:
        raise RuntimeError(f"Schedule error {response.status_code}: {response.content}, id={schedule_id}")

    response = requests.get(f"{EDITOAST_URL}train_schedule/{schedule_id}/simulation?infra_id={small_infra.id}")
    simulation_report = response.json()
    assert simulation_report["base"]["energy_consumption"] != simulation_report["final_output"]["energy_consumption"]
    assert (
        simulation_report["provisional"]["energy_consumption"]
        == simulation_report["final_output"]["energy_consumption"]
    )


def test_editoast_delete(west_to_south_east_simulations: Sequence[Any]):
    trains = west_to_south_east_simulations[0:2]
    trains_ids = [train["id"] for train in trains]
    r = requests.delete(f"{EDITOAST_URL}train_schedule/", json={"ids": trains_ids})
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Schedule error {r.status_code}: {r.content}, payload={json.dumps(trains_ids)}")
    r = requests.get(
        f"{EDITOAST_URL}train_schedule/{trains_ids[0]}/",
    )
    assert r.status_code == 404
    r = requests.get(
        f"{EDITOAST_URL}train_schedule/{trains_ids[1]}",
    )
    assert r.status_code == 404


def test_etcs_schedule_stop_brakes_result_never_reach_mrsp(etcs_scenario: Scenario, etcs_rolling_stock: int):
    rolling_stock_response = requests.get(EDITOAST_URL + f"light_rolling_stock/{etcs_rolling_stock}")
    etcs_rolling_stock_name = rolling_stock_response.json()["name"]
    ts_response = requests.post(
        f"{EDITOAST_URL}timetable/{etcs_scenario.timetable}/train_schedule/",
        json=[
            {
                "train_name": "nearby EoAs + brake uphill/downhill grade + no LoA",
                "labels": [],
                "rolling_stock_name": etcs_rolling_stock_name,
                "start_time": "2024-01-01T07:00:00Z",
                "path": [
                    {"id": "zero", "track": "TA0", "offset": 862000},
                    {"id": "first", "track": "TD0", "offset": 9001000},
                    {"id": "second", "track": "TD0", "offset": 10769000},
                    {"id": "third", "track": "TD0", "offset": 17156000},
                    {"id": "fourth", "track": "TH1", "offset": 221000},
                    {"id": "last", "track": "TH1", "offset": 3922000},
                ],
                "schedule": [
                    {"at": "zero", "stop_for": "P0D"},
                    {"at": "first", "stop_for": "PT10S"},
                    {"at": "second", "stop_for": "PT10S"},
                    {"at": "third", "stop_for": "PT10S"},
                    {"at": "fourth", "stop_for": "PT10S"},
                    {"at": "last", "stop_for": "P0D"},
                ],
                "margins": {"boundaries": [], "values": ["0%"]},
                "initial_speed": 0,
                "comfort": "STANDARD",
                "constraint_distribution": "STANDARD",
                "speed_limit_tag": "foo",
                "power_restrictions": [],
            }
        ],
    )

    schedule = ts_response.json()[0]
    schedule_id = schedule["id"]
    ts_id_response = requests.get(f"{EDITOAST_URL}train_schedule/{schedule_id}/")
    ts_id_response.raise_for_status()
    simu_response = requests.get(
        f"{EDITOAST_URL}train_schedule/{schedule_id}/simulation?infra_id={etcs_scenario.infra}"
    )
    simulation_final_output = simu_response.json()["final_output"]

    assert len(simulation_final_output["positions"]) == len(simulation_final_output["speeds"])

    # To debug this test: please add a breakpoint then use front to display speed-space chart
    # (activate Context for Slopes and Speed limits).
    # This case never hits LoA curves (slowdown of the MRSP) and it would probably express a bug if it does.

    # Check that the curves does respect Ends of Authority (EoA = stops), and
    #   that there is an acceleration then deceleration in between (never reach the MRSP given the acceleration curves).
    # This check is especially interesting on the first 2 stops that are so close that their braking curves are
    #   theoretically overlapping distance ranges.
    first_stop_offset = 21_139_000
    second_stop_offset = 22_907_000
    third_stop_offset = 29_294_000
    fourth_stop_offset = 41_359_000
    final_stop_offset = 45_060_000
    stop_offsets = [
        0,
        first_stop_offset,
        second_stop_offset,
        third_stop_offset,
        fourth_stop_offset,
        final_stop_offset,
    ]

    # Check null speed at stops
    for stop_offset in stop_offsets:
        assert _get_current_or_next_speed_at(simulation_final_output, stop_offset) == 0

    # Check only one acceleration then only one deceleration between stops
    for offset_index in range(1, len(stop_offsets) - 1):
        accelerating = True
        prev_speed = 0
        start_pos_index = bisect.bisect_left(simulation_final_output["positions"], stop_offsets[offset_index - 1])
        end_pos_index = bisect.bisect_left(simulation_final_output["positions"], stop_offsets[offset_index])
        for pos_index in range(start_pos_index, end_pos_index):
            current_speed = simulation_final_output["speeds"][pos_index]
            if accelerating:
                if prev_speed > current_speed:
                    accelerating = False
            else:
                assert prev_speed >= current_speed
            prev_speed = current_speed

    # Check that the uphill brake is shorter than downhill brake.
    offset_42_ms_brake_uphill = 19_332_051  # first stop is the end of the braking
    assert abs(_get_current_or_next_speed_at(simulation_final_output, offset_42_ms_brake_uphill) - 42) < 1
    offset_42_ms_brake_downhill = 27_365_028  # third stop is the end of the braking
    assert abs(_get_current_or_next_speed_at(simulation_final_output, offset_42_ms_brake_downhill) - 42) < 1
    uphill_brake_distance = first_stop_offset - offset_42_ms_brake_uphill
    downhill_brake_distance = third_stop_offset - offset_42_ms_brake_downhill
    # make sure that there is at least 100m difference
    assert uphill_brake_distance + 100_000 < downhill_brake_distance

    # Check that the effect of the guidance curve (GUI) is "visible"
    #   (brakes 0.35 m/s² above 220km/h = 61.111111m/s, then 0.6 m/s² below).
    # Check it on the easy case: first stop from a high speed.
    # Check it on a tricky case: 4th stop target under a "low" MRSP part (140 km/h) but the braking curve actually
    #   dodges this limit and starts under "high" MRSP (288 km/h), and the guidance curve change at 220 km/h is also
    #   noticeable.
    # In practice, check noticeable points of the braking curves (with the stops already checked)
    offset_first_high_speed = 14_509_017
    offset_first_brake_220_kph_speed = 17_544_856
    assert abs(_get_current_or_next_speed_at(simulation_final_output, offset_first_high_speed) - kph2ms(274.176)) < 1e-2
    assert (
        abs(_get_current_or_next_speed_at(simulation_final_output, offset_first_brake_220_kph_speed) - kph2ms(221.004))
        < 1e-2
    )

    offset_fourth_high_speed = 37_087_342
    offset_fourth_brake_220_kph_speed = 37_661_601
    assert (
        abs(_get_current_or_next_speed_at(simulation_final_output, offset_fourth_high_speed) - kph2ms(230.976)) < 1e-2
    )
    assert (
        abs(_get_current_or_next_speed_at(simulation_final_output, offset_fourth_brake_220_kph_speed) - kph2ms(219.744))
        < 1e-2
    )


def test_etcs_schedule_result_stop_brake_from_mrsp(etcs_scenario: Scenario, etcs_rolling_stock: int):
    rolling_stock_response = requests.get(EDITOAST_URL + f"light_rolling_stock/{etcs_rolling_stock}")
    etcs_rolling_stock_name = rolling_stock_response.json()["name"]
    ts_response = requests.post(
        f"{EDITOAST_URL}timetable/{etcs_scenario.timetable}/train_schedule/",
        json=[
            {
                "train_name": "brake from MRSP: max_speed + after slowdown of the MRSP",
                "labels": [],
                "rolling_stock_name": etcs_rolling_stock_name,
                "start_time": "2024-01-01T07:00:00Z",
                "path": [
                    {"id": "zero", "track": "TA0", "offset": 862000},
                    {"id": "first", "track": "TD0", "offset": 17156000},
                    {"id": "second", "track": "TH1", "offset": 1177000},
                    {"id": "last", "track": "TH1", "offset": 3922000},
                ],
                "schedule": [
                    {"at": "zero", "stop_for": "P0D"},
                    {"at": "first", "stop_for": "PT10S"},
                    {"at": "second", "stop_for": "PT10S"},
                    {"at": "last", "stop_for": "P0D"},
                ],
                "margins": {"boundaries": [], "values": ["0%"]},
                "initial_speed": 0,
                "comfort": "STANDARD",
                "constraint_distribution": "STANDARD",
                "speed_limit_tag": "foo",
                "power_restrictions": [],
            }
        ],
    )

    schedule = ts_response.json()[0]
    schedule_id = schedule["id"]
    ts_id_response = requests.get(f"{EDITOAST_URL}train_schedule/{schedule_id}/")
    ts_id_response.raise_for_status()
    simu_response = requests.get(
        f"{EDITOAST_URL}train_schedule/{schedule_id}/simulation?infra_id={etcs_scenario.infra}"
    )
    simulation_final_output = simu_response.json()["final_output"]

    assert len(simulation_final_output["positions"]) == len(simulation_final_output["speeds"])

    # To debug this test: please add a breakpoint then use front to display speed-space chart
    # (activate Context for Slopes and Speed limits).

    # This case hits an LoA curve (slowdown of the MRSP), but it's not the point to test it here.

    # Check that the curves does respect Ends of Authority (EoA = stops), and that there is an
    # acceleration then deceleration in between (maintain speed when reach the MRSP).
    first_stop_offset = 29_294_000
    second_stop_offset = 42_315_000
    final_stop_offset = 45_060_000
    stop_offsets = [
        0,
        first_stop_offset,
        second_stop_offset,
        final_stop_offset,
    ]

    # Check null speed at stops
    for stop_offset in stop_offsets:
        assert _get_current_or_next_speed_at(simulation_final_output, stop_offset) == 0

    # Check only one acceleration then only one deceleration between stops
    for offset_index in range(1, len(stop_offsets) - 1):
        accelerating = True
        prev_speed = 0
        start_pos_index = bisect.bisect_left(simulation_final_output["positions"], stop_offsets[offset_index - 1])
        end_pos_index = bisect.bisect_left(simulation_final_output["positions"], stop_offsets[offset_index])
        for pos_index in range(start_pos_index, end_pos_index):
            current_speed = simulation_final_output["speeds"][pos_index]
            if accelerating:
                if prev_speed > current_speed:
                    accelerating = False
            else:
                assert prev_speed >= current_speed
            prev_speed = current_speed

    # Check that the braking curves from the MRSP for the first and second stops start at the expected offset
    offset_start_first_brake = 21_467_192
    speed_before_first_brake = _get_current_or_next_speed_at(simulation_final_output, offset_start_first_brake)
    assert abs(speed_before_first_brake - kph2ms(288)) < 1e-2
    assert (
        _get_current_or_next_speed_at(simulation_final_output, offset_start_first_brake + 1) < speed_before_first_brake
    )
    offset_start_second_brake = 40_663_532
    speed_before_second_brake = _get_current_or_next_speed_at(simulation_final_output, offset_start_second_brake)
    assert abs(speed_before_second_brake - kph2ms(141.984)) < 1e-2
    assert (
        _get_current_or_next_speed_at(simulation_final_output, offset_start_second_brake + 1)
        < speed_before_second_brake
    )


def kph2ms(kmh_speed: float) -> float:
    return kmh_speed / 3.6


def _get_current_or_next_speed_at(simulation_final_output: Dict[str, Any], position: int) -> int:
    idx = bisect.bisect_left(simulation_final_output["positions"], position)
    return simulation_final_output["speeds"][idx]
