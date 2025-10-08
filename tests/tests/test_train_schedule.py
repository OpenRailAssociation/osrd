import bisect
import json
from collections.abc import Sequence
from typing import Any

import pytest
from requests import Session, Response

from tests.infra import Infra

from .scenario import Scenario
from .services import EDITOAST_URL


def kph2ms(kmh_speed: float) -> float:
    return kmh_speed / 3.6


MAX_SPEED_288 = kph2ms(288)
SPEED_LIMIT_142 = kph2ms(141.9984)
SPEED_LIMIT_112 = kph2ms(111.9996)
SAFE_SPEED_30 = kph2ms(29.9988)
SHORT_SLIP_SPEED_10 = kph2ms(10.0008)
RELEASE_SPEED_40 = kph2ms(40)
SPEED_0 = kph2ms(0)


def _update_simulation_with_mareco_allowances(
    editoast_url, train_schedule_id, session: Session
):
    response = session.get(editoast_url + f"/train_schedule/{train_schedule_id}/")
    assert response.status_code == 200
    train_schedule = response.json()
    train_schedule["margins"] = {
        "boundaries": [],
        "values": ["3%"],
    }
    train_schedule["constraint_distribution"] = "MARECO"
    r = session.put(
        editoast_url + f"/train_schedule/{train_schedule_id}", json=train_schedule
    )
    if r.status_code // 100 != 2:
        raise RuntimeError(
            f"Schedule error {r.status_code}: {r.content}, payload={json.dumps(train_schedule)}"
        )
    r = session.get(editoast_url + f"/train_schedule/{train_schedule_id}/")
    body = r.json()
    assert body["constraint_distribution"] == "MARECO"
    return body


def test_get_and_update_schedule_result(
    west_to_south_east_simulation: Sequence[Any],
    small_infra: Infra,
    session: Session,
):
    schedule = west_to_south_east_simulation[0]
    schedule_id = schedule["id"]
    response = session.get(f"{EDITOAST_URL}train_schedule/{schedule_id}/")
    if response.status_code // 100 != 2:
        raise RuntimeError(
            f"Schedule error {response.status_code}: {response.content}, id={schedule_id}"
        )
    response = session.get(
        f"{EDITOAST_URL}train_schedule/{schedule_id}/simulation?infra_id={small_infra.id}"
    )
    simulation_report = response.json()
    assert (
        simulation_report["base"]["energy_consumption"]
        == simulation_report["final_output"]["energy_consumption"]
    )

    response = _update_simulation_with_mareco_allowances(
        EDITOAST_URL, schedule_id, session
    )
    response = session.get(f"{EDITOAST_URL}train_schedule/{schedule_id}/")
    if response.status_code // 100 != 2:
        raise RuntimeError(
            f"Schedule error {response.status_code}: {response.content}, id={schedule_id}"
        )

    response = session.get(
        f"{EDITOAST_URL}train_schedule/{schedule_id}/simulation?infra_id={small_infra.id}"
    )
    simulation_report = response.json()
    assert (
        simulation_report["base"]["energy_consumption"]
        != simulation_report["final_output"]["energy_consumption"]
    )
    assert (
        simulation_report["provisional"]["energy_consumption"]
        == simulation_report["final_output"]["energy_consumption"]
    )


def test_editoast_delete(
    west_to_south_east_simulations: Sequence[Any], session: Session
):
    trains = west_to_south_east_simulations[0:2]
    trains_ids = [train["id"] for train in trains]
    r = session.delete(f"{EDITOAST_URL}train_schedule/", json={"ids": trains_ids})
    if r.status_code // 100 != 2:
        raise RuntimeError(
            f"Schedule error {r.status_code}: {r.content}, payload={json.dumps(trains_ids)}"
        )
    r = session.get(
        f"{EDITOAST_URL}train_schedule/{trains_ids[0]}/",
    )
    assert r.status_code == 404
    r = session.get(
        f"{EDITOAST_URL}train_schedule/{trains_ids[1]}",
    )
    assert r.status_code == 404


def test_etcs_schedule_stop_brakes_result_never_reach_mrsp(
    etcs_scenario: Scenario, etcs_rolling_stock: int, session: Session
):
    rolling_stock_response = session.get(
        EDITOAST_URL + f"light_rolling_stock/{etcs_rolling_stock}"
    )
    etcs_rolling_stock_name = rolling_stock_response.json()["name"]
    ts_response = session.post(
        f"{EDITOAST_URL}timetable/{etcs_scenario.timetable}/train_schedules/",
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
                    {"at": "first", "stop_for": "PT10S", "reception_signal": "OPEN"},
                    {"at": "second", "stop_for": "PT10S", "reception_signal": "STOP"},
                    {"at": "third", "stop_for": "PT10S", "reception_signal": "OPEN"},
                    {"at": "fourth", "stop_for": "PT10S", "reception_signal": "STOP"},
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
    ts_id_response = session.get(f"{EDITOAST_URL}train_schedule/{schedule_id}/")
    ts_id_response.raise_for_status()
    simu_response = session.get(
        f"{EDITOAST_URL}train_schedule/{schedule_id}/simulation?infra_id={etcs_scenario.infra}"
    )
    simulation_final_output = simu_response.json()["final_output"]

    assert len(simulation_final_output["positions"]) == len(
        simulation_final_output["speeds"]
    )

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
        start_pos_index = bisect.bisect_left(
            simulation_final_output["positions"], stop_offsets[offset_index - 1]
        )
        end_pos_index = bisect.bisect_left(
            simulation_final_output["positions"], stop_offsets[offset_index]
        )
        for pos_index in range(start_pos_index, end_pos_index):
            current_speed = simulation_final_output["speeds"][pos_index]
            if accelerating:
                if prev_speed > current_speed:
                    accelerating = False
            else:
                assert prev_speed >= current_speed
            prev_speed = current_speed

    # Check that the uphill brake is shorter than downhill brake.
    offset_37_ms_brake_uphill = 20_084_083  # first stop is the end of the braking
    assert (
        abs(
            _get_current_or_next_speed_at(
                simulation_final_output, offset_37_ms_brake_uphill
            )
            - 37
        )
        < 1
    )
    offset_37_ms_brake_downhill = 28_007_977  # third stop is the end of the braking
    assert (
        abs(
            _get_current_or_next_speed_at(
                simulation_final_output, offset_37_ms_brake_downhill
            )
            - 37
        )
        < 1
    )
    uphill_brake_distance = first_stop_offset - offset_37_ms_brake_uphill
    downhill_brake_distance = third_stop_offset - offset_37_ms_brake_downhill
    # make sure that there is at least 100m difference
    assert uphill_brake_distance + 100_000 < downhill_brake_distance

    # Check that the effect of the guidance curve (GUI) is "visible"
    #   (brakes 0.35 m/s² above 220km/h = 61.111111m/s, then 0.6 m/s² below).
    # Check it on the easy case: first stop from a high speed.
    # Check it on a tricky case: 4th stop target under a "low" MRSP part (140 km/h) but the braking curve actually
    #   dodges this limit and starts under "high" MRSP (288 km/h), and the guidance curve change at 220 km/h is also
    #   noticeable.
    # In practice, check noticeable points of the braking curves:
    # - check high-speed point
    # - check the point closest to the bending-point at 220 km/h (can be above or under: only the "shape" of the curve matters)
    # - stop is already checked
    offset_start_first_brake_high_speed = 15_032_882
    offset_bending_guidance_point_first_brake = 18_229_194
    _assert_equal_speeds(
        _get_current_or_next_speed_at(
            simulation_final_output, offset_start_first_brake_high_speed
        ),
        kph2ms(276.838),
    )
    _assert_equal_speeds(
        _get_current_or_next_speed_at(
            simulation_final_output, offset_bending_guidance_point_first_brake
        ),
        kph2ms(217.971),
    )

    offset_fourth_high_speed = 37_087_326
    offset_fourth_brake_220_kph_speed = 37_590_127
    _assert_equal_speeds(
        _get_current_or_next_speed_at(
            simulation_final_output, offset_fourth_high_speed
        ),
        kph2ms(230.97),
    )
    _assert_equal_speeds(
        _get_current_or_next_speed_at(
            simulation_final_output, offset_fourth_brake_220_kph_speed
        ),
        kph2ms(220.92),
    )


def test_etcs_schedule_result_stop_brake_from_mrsp(
    etcs_scenario: Scenario, etcs_rolling_stock: int, session: Session
):
    rolling_stock_response = session.get(
        EDITOAST_URL + f"light_rolling_stock/{etcs_rolling_stock}"
    )
    etcs_rolling_stock_name = rolling_stock_response.json()["name"]
    ts_response = session.post(
        f"{EDITOAST_URL}timetable/{etcs_scenario.timetable}/train_schedules/",
        json=[
            {
                "train_name": "brake from MRSP: max_speed + after slowdown of the MRSP",
                "labels": [],
                "rolling_stock_name": etcs_rolling_stock_name,
                "start_time": "2024-01-01T07:00:00Z",
                "path": [
                    {"id": "zero", "track": "TA0", "offset": 862_000},
                    {"id": "first", "track": "TD0", "offset": 1_7156_000},
                    {"id": "second", "track": "TH1", "offset": 1_177_000},
                    {"id": "last", "track": "TH1", "offset": 3_922_000},
                ],
                "schedule": [
                    {"at": "zero", "stop_for": "P0D"},
                    {"at": "first", "stop_for": "PT10S", "reception_signal": "STOP"},
                    {"at": "second", "stop_for": "PT10S", "reception_signal": "STOP"},
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
    ts_id_response = session.get(f"{EDITOAST_URL}train_schedule/{schedule_id}/")
    ts_id_response.raise_for_status()
    simu_response = session.get(
        f"{EDITOAST_URL}train_schedule/{schedule_id}/simulation?infra_id={etcs_scenario.infra}"
    )
    simulation_final_output = simu_response.json()["final_output"]

    assert len(simulation_final_output["positions"]) == len(
        simulation_final_output["speeds"]
    )

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
        start_pos_index = bisect.bisect_left(
            simulation_final_output["positions"], stop_offsets[offset_index - 1]
        )
        end_pos_index = bisect.bisect_left(
            simulation_final_output["positions"], stop_offsets[offset_index]
        )
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
    speed_before_first_brake = _get_current_or_next_speed_at(
        simulation_final_output, offset_start_first_brake
    )
    _assert_equal_speeds(speed_before_first_brake, MAX_SPEED_288)
    assert (
        _get_current_or_next_speed_at(
            simulation_final_output, offset_start_first_brake + 1
        )
        < speed_before_first_brake
    )
    offset_start_second_brake = 40_543_050
    speed_before_second_brake = _get_current_or_next_speed_at(
        simulation_final_output, offset_start_second_brake
    )
    _assert_equal_speeds(speed_before_second_brake, SPEED_LIMIT_142)
    assert (
        _get_current_or_next_speed_at(
            simulation_final_output, offset_start_second_brake + 1
        )
        < speed_before_second_brake
    )


def test_etcs_schedule_result_stop_with_eoa_and_svl_at_same_location(
    etcs_scenario: Scenario, etcs_rolling_stock: int, session: Session
):
    rolling_stock_response = session.get(
        EDITOAST_URL + f"light_rolling_stock/{etcs_rolling_stock}"
    )
    etcs_rolling_stock_name = rolling_stock_response.json()["name"]
    ts_response = session.post(
        f"{EDITOAST_URL}timetable/{etcs_scenario.timetable}/train_schedules/",
        json=[
            {
                "train_name": "brake from MRSP: max_speed + EoA and SvL at same location",
                "labels": [],
                "rolling_stock_name": etcs_rolling_stock_name,
                "start_time": "2024-01-01T07:00:00Z",
                "path": [
                    {"id": "zero", "track": "TA0", "offset": 862_000},
                    {"id": "first", "track": "TH0", "offset": 1_000_000},
                    {"id": "last", "track": "TH1", "offset": 3_922_000},
                ],
                "schedule": [
                    {"at": "zero", "stop_for": "P0D"},
                    {"at": "first", "stop_for": "PT10S", "reception_signal": "STOP"},
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
    ts_id_response = session.get(f"{EDITOAST_URL}train_schedule/{schedule_id}/")
    ts_id_response.raise_for_status()
    simu_response = session.get(
        f"{EDITOAST_URL}train_schedule/{schedule_id}/simulation?infra_id={etcs_scenario.infra}"
    )
    simulation_final_output = simu_response.json()["final_output"]

    assert len(simulation_final_output["positions"]) == len(
        simulation_final_output["speeds"]
    )

    # To debug this test: please add a breakpoint then use front to display speed-space chart
    # (activate Context for Slopes and Speed limits).

    # This case hits an LoA curve (slowdown of the MRSP), but it's not the point to test it here.

    # Check that the curves respect the EoA + SvL (EoA = stops), and that there is an
    # acceleration then deceleration in between (maintain speed when reach the MRSP).
    first_stop_offset = 41_138_000
    final_stop_offset = 45_060_000
    stop_offsets = [
        0,
        first_stop_offset,
        final_stop_offset,
    ]

    # Check null speed at stops
    for stop_offset in stop_offsets:
        assert _get_current_or_next_speed_at(simulation_final_output, stop_offset) == 0

    # Check only one acceleration then only one deceleration between stops
    for offset_index in range(1, len(stop_offsets) - 1):
        accelerating = True
        prev_speed = 0
        start_pos_index = bisect.bisect_left(
            simulation_final_output["positions"], stop_offsets[offset_index - 1]
        )
        end_pos_index = bisect.bisect_left(
            simulation_final_output["positions"], stop_offsets[offset_index]
        )
        for pos_index in range(start_pos_index, end_pos_index):
            current_speed = simulation_final_output["speeds"][pos_index]
            if accelerating:
                if prev_speed > current_speed:
                    accelerating = False
            else:
                assert prev_speed >= current_speed
            prev_speed = current_speed

    # Check that the braking curve starts and ends at the expected offsets.
    offset_start_first_brake = 33_461_530
    speed_before_first_brake = _get_current_or_next_speed_at(
        simulation_final_output, offset_start_first_brake
    )
    _assert_equal_speeds(speed_before_first_brake, MAX_SPEED_288)
    assert (
        _get_current_or_next_speed_at(
            simulation_final_output, offset_start_first_brake + 1
        )
        < speed_before_first_brake
    )
    # Check a bending point for the first stop's braking curve (where the Guidance curve's influence stops).
    offset_bending_guidance_point = 37_313_980
    speed_at_bending_guidance_point = _get_current_or_next_speed_at(
        simulation_final_output, offset_bending_guidance_point
    )
    _assert_equal_speeds(speed_at_bending_guidance_point, kph2ms(222.444_095))
    # Check that the release part (where the speed stays at 40km/h) starts and ends at the expected offsets.
    offset_start_release_speed = 40_827_738
    speed_at_start_release_speed = _get_current_or_next_speed_at(
        simulation_final_output, offset_start_release_speed
    )
    _assert_equal_speeds(speed_at_start_release_speed, RELEASE_SPEED_40)
    offset_end_release_speed = 40_892_587
    speed_at_end_release_speed = _get_current_or_next_speed_at(
        simulation_final_output, offset_end_release_speed
    )
    _assert_equal_speeds(speed_at_end_release_speed, RELEASE_SPEED_40)


def test_etcs_schedule_result_stop_with_eoa_and_svl_at_different_locations(
    etcs_scenario: Scenario, etcs_rolling_stock: int, session: Session
):
    rolling_stock_response = session.get(
        EDITOAST_URL + f"light_rolling_stock/{etcs_rolling_stock}"
    )
    etcs_rolling_stock_name = rolling_stock_response.json()["name"]
    ts_response = session.post(
        f"{EDITOAST_URL}timetable/{etcs_scenario.timetable}/train_schedules/",
        json=[
            {
                "train_name": "brake from MRSP: max_speed + EoA and SvL 100m after EoA",
                "labels": [],
                "rolling_stock_name": etcs_rolling_stock_name,
                "start_time": "2024-01-01T07:00:00Z",
                "path": [
                    {"id": "zero", "track": "TA0", "offset": 862_000},
                    {"id": "first", "track": "TH0", "offset": 900_000},
                    {"id": "last", "track": "TH1", "offset": 3_922_000},
                ],
                "schedule": [
                    {"at": "zero", "stop_for": "P0D"},
                    {
                        "at": "first",
                        "stop_for": "PT10S",
                        "reception_signal": "SHORT_SLIP_STOP",
                    },
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
    ts_id_response = session.get(f"{EDITOAST_URL}train_schedule/{schedule_id}/")
    ts_id_response.raise_for_status()
    simu_response = session.get(
        f"{EDITOAST_URL}train_schedule/{schedule_id}/simulation?infra_id={etcs_scenario.infra}"
    )
    simulation_final_output = simu_response.json()["final_output"]

    assert len(simulation_final_output["positions"]) == len(
        simulation_final_output["speeds"]
    )

    # To debug this test: please add a breakpoint then use front to display speed-space chart
    # (activate Context for Slopes and Speed limits).

    # This case hits an LoA curve (slowdown of the MRSP), but it's not the point to test it here.

    # Check that the curves respect the EoA + SvL (EoA = stops), and that there is an
    # acceleration then deceleration in between (maintain speed when reach the MRSP).
    # Here, the stop (EoA) is 100m before the PH1 switch (SvL).
    svl_ph1_offset = 41_138_000
    first_stop_offset = svl_ph1_offset - 100_000
    final_stop_offset = 45_060_000
    stop_offsets = [
        0,
        first_stop_offset,
        final_stop_offset,
    ]

    # Check null speed at stops
    for stop_offset in stop_offsets:
        assert _get_current_or_next_speed_at(simulation_final_output, stop_offset) == 0

    # Check only one acceleration then only one deceleration between stops
    for offset_index in range(1, len(stop_offsets) - 1):
        accelerating = True
        prev_speed = 0
        start_pos_index = bisect.bisect_left(
            simulation_final_output["positions"], stop_offsets[offset_index - 1]
        )
        end_pos_index = bisect.bisect_left(
            simulation_final_output["positions"], stop_offsets[offset_index]
        )
        for pos_index in range(start_pos_index, end_pos_index):
            current_speed = simulation_final_output["speeds"][pos_index]
            if accelerating:
                if prev_speed > current_speed:
                    accelerating = False
            else:
                assert prev_speed >= current_speed
            prev_speed = current_speed

    # Check that the braking curve starts and ends at the expected offsets.
    offset_start_first_brake = 33_361_530
    speed_before_first_brake = _get_current_or_next_speed_at(
        simulation_final_output, offset_start_first_brake
    )
    _assert_equal_speeds(speed_before_first_brake, MAX_SPEED_288)
    assert (
        _get_current_or_next_speed_at(
            simulation_final_output, offset_start_first_brake + 1
        )
        < speed_before_first_brake
    )
    # Check the first bending point for the first stop's braking curve (where the Guidance curve's influence stops).
    offset_bending_guidance_point = 37_239_933
    speed_at_bending_guidance_point = _get_current_or_next_speed_at(
        simulation_final_output, offset_bending_guidance_point
    )
    _assert_equal_speeds(speed_at_bending_guidance_point, kph2ms(221.94))
    # Check the second bending point for the first stop's braking curve, where the indication curve followed switches
    # from the EoA indication curve to the SvL indication curve.
    offset_bending_point_eoa_to_svl = 39_005_481
    speed_at_bending_point_eoa_to_svl = _get_current_or_next_speed_at(
        simulation_final_output, offset_bending_point_eoa_to_svl
    )
    _assert_equal_speeds(speed_at_bending_point_eoa_to_svl, kph2ms(159.411_475_5))
    # Check the third bending point for the first stop's braking curve, where the indication curve followed switches
    # back from the SvL indication curve to the EoA indication curve.
    offset_bending_point_svl_to_eoa = 40_617_604
    speed_at_bending_point_svl_to_eoa = _get_current_or_next_speed_at(
        simulation_final_output, offset_bending_point_svl_to_eoa
    )
    _assert_equal_speeds(speed_at_bending_point_svl_to_eoa, kph2ms(60.013_601_2))


@pytest.mark.parametrize(
    ["stop_signal_status", "brake_start_offset", "first_bending_point_offset"],
    [
        ("OPEN", 34_081_530, 37_794_783),
        ("STOP", 33_361_530, 37_239_933),
    ],
)
def test_etcs_schedule_result_stop_on_open_signal(
    etcs_scenario: Scenario,
    etcs_rolling_stock: int,
    session: Session,
    stop_signal_status: str,
    brake_start_offset: int,
    first_bending_point_offset: int,
):
    rolling_stock_response = session.get(
        EDITOAST_URL + f"light_rolling_stock/{etcs_rolling_stock}"
    )
    etcs_rolling_stock_name = rolling_stock_response.json()["name"]

    ts_response = session.post(
        f"{EDITOAST_URL}timetable/{etcs_scenario.timetable}/train_schedules/",
        json=[
            {
                "train_name": (
                    "brake from MRSP: max_speed + closed signal EoA and SvL 100m after EoA"
                    if stop_signal_status == "STOP"
                    else "brake from MRSP: max_speed + open signal EoA"
                ),
                "labels": [],
                "rolling_stock_name": etcs_rolling_stock_name,
                "start_time": "2024-01-01T07:00:00Z",
                "path": [
                    {"id": "zero", "track": "TA0", "offset": 862_000},
                    {"id": "first", "track": "TH0", "offset": 900_000},
                    {"id": "last", "track": "TH1", "offset": 3_922_000},
                ],
                "schedule": [
                    {"at": "zero", "stop_for": "P0D"},
                    {
                        "at": "first",
                        "stop_for": "PT10S",
                        "reception_signal": stop_signal_status,
                    },
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
    ts_id_response = session.get(f"{EDITOAST_URL}train_schedule/{schedule_id}/")
    ts_id_response.raise_for_status()
    simu_response = session.get(
        f"{EDITOAST_URL}train_schedule/{schedule_id}/simulation?infra_id={etcs_scenario.infra}"
    )
    simulation_final_output = simu_response.json()["final_output"]

    assert len(simulation_final_output["positions"]) == len(
        simulation_final_output["speeds"]
    )

    # To debug this test: please add a breakpoint then use front to display speed-space chart
    # (activate Context for Slopes and Speed limits).

    # Check that on an open signal the curves respect the EoA (EoA = stops) but ignore the SVL,
    # and that there is an acceleration then deceleration in between (maintain speed when reach the MRSP).
    # The EOA permitted speed curve should also be used on an open signal
    # instead of the less permissive EOA indication speed curve used for closed signal.
    # Here, the stop (EoA) is 100m before the PH1 switch (SvL).
    svl_ph1_offset = 41_138_000
    first_stop_offset = svl_ph1_offset - 100_000
    final_stop_offset = 45_060_000
    stop_offsets = [
        0,
        first_stop_offset,
        final_stop_offset,
    ]

    # Check null speed at stops
    for stop_offset in stop_offsets:
        assert _get_current_or_next_speed_at(simulation_final_output, stop_offset) == 0

    # Check only one acceleration then only one deceleration between stops
    for offset_index in range(1, len(stop_offsets) - 1):
        accelerating = True
        prev_speed = 0
        start_pos_index = bisect.bisect_left(
            simulation_final_output["positions"], stop_offsets[offset_index - 1]
        )
        end_pos_index = bisect.bisect_left(
            simulation_final_output["positions"], stop_offsets[offset_index]
        )
        for pos_index in range(start_pos_index, end_pos_index):
            current_speed = simulation_final_output["speeds"][pos_index]
            if accelerating:
                if prev_speed > current_speed:
                    accelerating = False
            else:
                assert prev_speed >= current_speed
            prev_speed = current_speed

    # Check that the braking curve starts at the expected offsets.
    # In particular the braking occurs later on an open signal (this can be observed in the test params).
    def check_brake_from_max_speed_at(offset, simulation_final_output):
        speed_before_first_brake = _get_current_or_next_speed_at(
            simulation_final_output, offset
        )
        _assert_equal_speeds(speed_before_first_brake, MAX_SPEED_288)
        assert (
            _get_current_or_next_speed_at(simulation_final_output, offset + 1)
            < speed_before_first_brake
        )

    check_brake_from_max_speed_at(brake_start_offset, simulation_final_output)

    # Check the first bending point for the first stop's braking curve (where the Guidance curve's influence stops).
    # It is similarly delayed on an open signal, though less (this can be observed in the test params).
    def check_speed_first_bending_point(offset, simulation_final_output):
        speed_at_bending_guidance_point = _get_current_or_next_speed_at(
            simulation_final_output, offset
        )
        _assert_equal_speeds(speed_at_bending_guidance_point, kph2ms(221.94))

    check_speed_first_bending_point(first_bending_point_offset, simulation_final_output)

    if stop_signal_status == "OPEN":
        # Check that we continue to follow the EOA permitted speed curve for the open signal without switching to SVL
        # This is not obvious from the shape of the curve, so this final check mostly serves to prevent accidental
        # regression by providing a numerical value for the speed.
        offset_post_bending_point = 40_649_200
        speed_post_bending_point = _get_current_or_next_speed_at(
            simulation_final_output, offset_post_bending_point
        )
        _assert_equal_speeds(speed_post_bending_point, kph2ms(76.84))


def test_etcs_schedule_result_slowdowns(
    etcs_scenario: Scenario, etcs_rolling_stock: int, session: Session
):
    rolling_stock_response = session.get(
        EDITOAST_URL + f"light_rolling_stock/{etcs_rolling_stock}"
    )
    etcs_rolling_stock_name = rolling_stock_response.json()["name"]
    ts_response = session.post(
        f"{EDITOAST_URL}timetable/{etcs_scenario.timetable}/train_schedules/",
        json=[
            {
                "train_name": "slowdowns to respect MRSP and ETCS",
                "labels": [],
                "rolling_stock_name": etcs_rolling_stock_name,
                "start_time": "2024-01-01T07:00:00Z",
                "path": [
                    {"id": "zero", "track": "TA0", "offset": 0},
                    {"id": "last", "track": "TH1", "offset": 5_000_000},
                ],
                "schedule": [
                    {"at": "zero", "stop_for": "P0D"},
                    {
                        "at": "last",
                        "stop_for": "P0D",
                        "reception_signal": "SHORT_SLIP_STOP",
                    },
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
    ts_id_response = session.get(f"{EDITOAST_URL}train_schedule/{schedule_id}/")
    ts_id_response.raise_for_status()
    simu_response = session.get(
        f"{EDITOAST_URL}train_schedule/{schedule_id}/simulation?infra_id={etcs_scenario.infra}"
    )
    simulation_final_output = simu_response.json()["final_output"]

    assert len(simulation_final_output["positions"]) == len(
        simulation_final_output["speeds"]
    )

    # To debug this test: please add a breakpoint then use front to display speed-space chart
    # (activate Context for Slopes and Speed limits).

    # Check that the curves do respect Ends of Authority (EoA = stops), and that there is an
    # acceleration then deceleration in between (maintain speed when reach the MRSP).
    # This is the case here because MRSP is not doing ups-and-downs.
    final_stop_offset = 47_000_000
    stop_offsets = [
        0,
        final_stop_offset,
    ]

    # Check null speed at stops
    for stop_offset in stop_offsets:
        assert _get_current_or_next_speed_at(simulation_final_output, stop_offset) == 0

    # Check only one acceleration then only one deceleration between begin and end
    for offset_index in range(1, len(stop_offsets) - 1):
        accelerating = True
        prev_speed = 0
        start_pos_index = bisect.bisect_left(
            simulation_final_output["positions"], stop_offsets[offset_index - 1]
        )
        end_pos_index = bisect.bisect_left(
            simulation_final_output["positions"], stop_offsets[offset_index]
        )
        for pos_index in range(start_pos_index, end_pos_index):
            current_speed = simulation_final_output["speeds"][pos_index]
            if accelerating:
                if prev_speed > current_speed:
                    accelerating = False
            else:
                assert prev_speed >= current_speed
            prev_speed = current_speed

    # Check that the braking curves for limits of Authority (LoA = slowdowns of the MRSP) start and end at the
    # expected offset.
    # Also check a bending point for the first curve (where Guidance curve's influence stops).
    # Notes:
    # * the end of the braking is upstream of the actual MRSP slowdown's target as per the offset applied to
    #   LoA braking curves.
    # * the initial target for ETCS is the actual MRSP, not adding any anticipation from driver behavior.

    # First slowdown
    offset_start_brake_288_to_142 = 35_151_913
    speed_before_brake_288_to_142 = _get_current_or_next_speed_at(
        simulation_final_output, offset_start_brake_288_to_142
    )
    _assert_equal_speeds(speed_before_brake_288_to_142, MAX_SPEED_288)
    assert (
        _get_current_or_next_speed_at(
            simulation_final_output, offset_start_brake_288_to_142 + 1
        )
        < speed_before_brake_288_to_142
    )

    offset_bending_guidance_point = 38_296_384
    speed_at_bending_guidance_point = _get_current_or_next_speed_at(
        simulation_final_output, offset_bending_guidance_point
    )
    # Permitted Speed and Guidance intersect at speed ~65.8 m/s, testing a point of the curve close enough
    # where speed is 65.499_773_3 m/s.
    _assert_equal_speeds(speed_at_bending_guidance_point, kph2ms(235.799_184_0))

    offset_end_brake_288_to_142 = 40_824_370
    speed_after_brake_288_to_142 = _get_current_or_next_speed_at(
        simulation_final_output, offset_end_brake_288_to_142
    )
    assert (
        _get_current_or_prev_speed_at(
            simulation_final_output, offset_end_brake_288_to_142 - 1
        )
        > speed_after_brake_288_to_142
    )
    _assert_equal_speeds(speed_after_brake_288_to_142, SPEED_LIMIT_142)

    # Second slowdown
    offset_start_brake_142_to_112 = 44_413_825
    speed_before_brake_142_to_112 = _get_current_or_next_speed_at(
        simulation_final_output, offset_start_brake_142_to_112
    )
    _assert_equal_speeds(speed_before_brake_142_to_112, SPEED_LIMIT_142)
    assert (
        _get_current_or_next_speed_at(
            simulation_final_output, offset_start_brake_142_to_112 + 1
        )
        < speed_before_brake_142_to_112
    )
    offset_end_brake_142_to_112 = 44_948_022
    speed_after_brake_142_to_112 = _get_current_or_next_speed_at(
        simulation_final_output, offset_end_brake_142_to_112
    )
    assert (
        _get_current_or_prev_speed_at(
            simulation_final_output, offset_end_brake_142_to_112 - 1
        )
        > speed_after_brake_142_to_112
    )
    _assert_equal_speeds(speed_after_brake_142_to_112, SPEED_LIMIT_112)

    # Third slowdown, reaching release speed
    offset_start_brake_112_to_40 = 45_762_292
    speed_before_brake_112_to_40 = _get_current_or_next_speed_at(
        simulation_final_output, offset_start_brake_112_to_40
    )
    _assert_equal_speeds(speed_before_brake_112_to_40, SPEED_LIMIT_112)
    assert (
        _get_current_or_next_speed_at(
            simulation_final_output, offset_start_brake_112_to_40 + 1
        )
        < speed_before_brake_112_to_40
    )
    offset_end_brake_112_to_40 = 46_689_738
    speed_after_brake_112_to_40 = _get_current_or_next_speed_at(
        simulation_final_output, offset_end_brake_112_to_40
    )
    assert (
        _get_current_or_prev_speed_at(
            simulation_final_output, offset_end_brake_112_to_40 - 1
        )
        > speed_after_brake_112_to_40
    )
    _assert_equal_speeds(speed_after_brake_112_to_40, RELEASE_SPEED_40)

    # Last slowdown, EoA (complete stop) braking curve is applied
    offset_start_brake_40_to_0 = 46_754_587
    speed_before_brake_40_to_0 = _get_current_or_next_speed_at(
        simulation_final_output, offset_start_brake_40_to_0
    )
    _assert_equal_speeds(speed_before_brake_40_to_0, RELEASE_SPEED_40)
    assert (
        _get_current_or_next_speed_at(
            simulation_final_output, offset_start_brake_40_to_0 + 1
        )
        < speed_before_brake_40_to_0
    )
    offset_end_brake_40_to_0 = 47_000_000
    speed_after_brake_40_to_0 = _get_current_or_next_speed_at(
        simulation_final_output, offset_end_brake_40_to_0
    )
    assert (
        _get_current_or_prev_speed_at(
            simulation_final_output, offset_end_brake_40_to_0 - 1
        )
        > speed_after_brake_40_to_0
    )
    _assert_equal_speeds(speed_after_brake_40_to_0, SPEED_0)


def test_etcs_schedule_result_slowdowns_with_stop(
    etcs_scenario: Scenario, etcs_rolling_stock: int, session: Session
):
    rolling_stock_response = session.get(
        EDITOAST_URL + f"light_rolling_stock/{etcs_rolling_stock}"
    )
    etcs_rolling_stock_name = rolling_stock_response.json()["name"]
    ts_response = session.post(
        f"{EDITOAST_URL}timetable/{etcs_scenario.timetable}/train_schedules/",
        json=[
            {
                "train_name": "slowdowns to respect MRSP and ETCS with intermediate stop",
                "labels": [],
                "rolling_stock_name": etcs_rolling_stock_name,
                "start_time": "2024-01-01T07:00:00Z",
                "path": [
                    {"id": "zero", "track": "TA0", "offset": 0},
                    {"id": "stop", "track": "TH0", "offset": 662_000},
                    {"id": "last", "track": "TH1", "offset": 5_000_000},
                ],
                "schedule": [
                    {"at": "zero", "stop_for": "P0D"},
                    {"at": "stop", "stop_for": "PT10S", "reception_signal": "STOP"},
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
    ts_id_response = session.get(f"{EDITOAST_URL}train_schedule/{schedule_id}/")
    ts_id_response.raise_for_status()
    simu_response = session.get(
        f"{EDITOAST_URL}train_schedule/{schedule_id}/simulation?infra_id={etcs_scenario.infra}"
    )
    simulation_final_output = simu_response.json()["final_output"]

    assert len(simulation_final_output["positions"]) == len(
        simulation_final_output["speeds"]
    )

    # To debug this test: please add a breakpoint then use front to display speed-space chart
    # (activate Context for Slopes and Speed limits).

    # Check that the curves do respect Ends of Authority (EoA = stops), and that there is an
    # acceleration then deceleration in between (maintain speed when reach the MRSP).
    # This is the case here because MRSP is not doing ups-and-downs.
    final_stop_offset = 47_000_000
    stop_offsets = [
        0,
        final_stop_offset,
    ]

    # Check null speed at stops
    for stop_offset in stop_offsets:
        assert _get_current_or_next_speed_at(simulation_final_output, stop_offset) == 0

    # Check only one acceleration then only one deceleration between begin and end
    for offset_index in range(1, len(stop_offsets) - 1):
        accelerating = True
        prev_speed = 0
        start_pos_index = bisect.bisect_left(
            simulation_final_output["positions"], stop_offsets[offset_index - 1]
        )
        end_pos_index = bisect.bisect_left(
            simulation_final_output["positions"], stop_offsets[offset_index]
        )
        for pos_index in range(start_pos_index, end_pos_index):
            current_speed = simulation_final_output["speeds"][pos_index]
            if accelerating:
                if prev_speed > current_speed:
                    accelerating = False
            else:
                assert prev_speed >= current_speed
            prev_speed = current_speed

    # Check that the train strictly decelerates to the stop position, and does not
    # stay at safe speed when reaching the intermediate stop.
    # Check the same for the strict acceleration after the stop.
    positions = simulation_final_output["positions"]
    speeds = simulation_final_output["speeds"]

    offset_start_deceleration_to_stop = 33_985_530
    offset_intermediate_stop = 41_662_000
    offset_end_acceleration_from_stop = 43_806_384

    start_index = bisect.bisect_left(positions, offset_start_deceleration_to_stop)
    intermediate_index = bisect.bisect_left(positions, offset_intermediate_stop)
    end_index = bisect.bisect_left(positions, offset_end_acceleration_from_stop)

    # Deceleration with release speed to the intermediate stop
    for i in range(start_index + 1, intermediate_index):
        assert speeds[i] < speeds[i - 1] or (
            speeds[i] == speeds[i - 1] and speeds[i] == RELEASE_SPEED_40
        ), f"Speed not decreasing at index {i}: {speeds[i]} >= {speeds[i - 1]}"

    # Strict acceleration after the intermediate stop
    # Assert starting at {intermediate_index + 2} to skip the first speed after the stop
    # which is the speed at the stop (0 m/s).
    for i in range(intermediate_index + 2, end_index):
        assert speeds[i] > speeds[i - 1], (
            f"Speed not strictly increasing at index {i}: {speeds[i]} <= {speeds[i - 1]}"
        )


def test_etcs_spacing_req(
    etcs_scenario: Scenario, etcs_rolling_stock: int, session: Session
):
    """
    spacing requirements should:
    * start **roughly** at the same time the braking curve starts if stopping on closed signal
      on the entry of the block (depending on SvL and if signal is Nf or F, this does change)
    * end when leaving the block
    """
    rolling_stock_response = session.get(
        EDITOAST_URL + f"light_rolling_stock/{etcs_rolling_stock}"
    )
    etcs_rolling_stock_name = rolling_stock_response.json()["name"]
    ts_response = session.post(
        f"{EDITOAST_URL}timetable/{etcs_scenario.timetable}/train_schedules/",
        json=[
            {
                "train_name": "slowdowns to respect MRSP and ETCS with intermediate stop",
                "labels": [],
                "rolling_stock_name": etcs_rolling_stock_name,
                "start_time": "2024-01-01T07:00:00Z",
                "path": [
                    {"id": "zero", "track": "TA0", "offset": 0},
                    {"id": "stop", "track": "TH0", "offset": 662_000},
                    {"id": "last", "track": "TH1", "offset": 5_000_000},
                ],
                "schedule": [
                    {"at": "zero", "stop_for": "P0D"},
                    {"at": "stop", "stop_for": "PT10S", "reception_signal": "STOP"},
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
    ts_id_response = session.get(f"{EDITOAST_URL}train_schedule/{schedule_id}/")
    ts_id_response.raise_for_status()
    simu_response = session.get(
        f"{EDITOAST_URL}train_schedule/{schedule_id}/simulation?infra_id={etcs_scenario.infra}"
    )
    simulation_final_output = simu_response.json()["final_output"]

    assert len(simulation_final_output["positions"]) == len(
        simulation_final_output["speeds"]
    )

    # To debug this test: please add a breakpoint then use front to display speed-space chart
    # (activate Context for Slopes and Speed limits).

    # zone entry buffer_stop.0
    spacing_req_z0 = simulation_final_output["spacing_requirements"][0]
    assert spacing_req_z0["zone"] == "zone.[DA2:DECREASING, buffer_stop.0:INCREASING]"
    assert spacing_req_z0["begin_time"] == 0
    assert spacing_req_z0["end_time"] == 103241

    # zone entry DA2 (triggered by SA2)
    spacing_req_z1 = simulation_final_output["spacing_requirements"][1]
    assert (
        spacing_req_z1["zone"]
        == "zone.[DA2:INCREASING, DA3:DECREASING, DA7:INCREASING]"
    )
    assert spacing_req_z1["begin_time"] == 62181
    assert spacing_req_z1["end_time"] == 111927

    # zone entry DA3 (triggered by SA2)
    spacing_req_z2 = simulation_final_output["spacing_requirements"][2]
    assert spacing_req_z2["zone"] == "zone.[DA3:INCREASING, DA6_1:DECREASING]"
    assert spacing_req_z2["begin_time"] == 62181
    assert spacing_req_z2["end_time"] == 145858

    # zone entry DD0_8 (triggered by SD0_8)
    spacing_req_zone_intersect_full_speed = simulation_final_output[
        "spacing_requirements"
    ][19]
    assert (
        spacing_req_zone_intersect_full_speed["zone"]
        == "zone.[DD0_8:INCREASING, DD0_9:DECREASING]"
    )
    assert spacing_req_zone_intersect_full_speed["begin_time"] == 347978
    assert spacing_req_zone_intersect_full_speed["end_time"] == 464473

    # zone entry DH1 (triggered by SG0)
    spacing_req_zone_stop = simulation_final_output["spacing_requirements"][32]
    assert spacing_req_zone_stop["zone"] == "zone.[DH1:INCREASING, DH2:DECREASING]"
    assert spacing_req_zone_stop["begin_time"] == 535548
    assert spacing_req_zone_stop["end_time"] == 851123

    # zone entry DH1_2 (triggered by SH1_2)
    spacing_req_zone_final = simulation_final_output["spacing_requirements"][36]
    assert (
        spacing_req_zone_final["zone"]
        == "zone.[DH1_2:INCREASING, buffer_stop.7:DECREASING]"
    )
    assert spacing_req_zone_final["begin_time"] == 899826
    assert spacing_req_zone_final["end_time"] == 1042849


TIME_START_BRAKING_ETCS_FROM_BUFFER0_TO_SG0 = 535_548


def test_etcs_routing_req(
    etcs_scenario: Scenario, etcs_rolling_stock: int, session: Session
):
    """
    routing requirements should:
    * start at the same time the braking curve starts if stopping on closed signal
      on the signal protecting said route
    * end when leaving the zone (routes are "softly released": as soon as possible)
    """
    rolling_stock_response = session.get(
        EDITOAST_URL + f"light_rolling_stock/{etcs_rolling_stock}"
    )
    etcs_rolling_stock_name = rolling_stock_response.json()["name"]
    ts_response = session.post(
        f"{EDITOAST_URL}timetable/{etcs_scenario.timetable}/train_schedules/",
        json=[
            {
                "train_name": "slowdowns to respect MRSP and ETCS with intermediate stop",
                "labels": [],
                "rolling_stock_name": etcs_rolling_stock_name,
                "start_time": "2024-01-01T07:00:00Z",
                "path": [
                    {"id": "zero", "track": "TA0", "offset": 0},
                    {"id": "stop", "track": "TH0", "offset": 662_000},
                    {"id": "last", "track": "TH1", "offset": 5_000_000},
                ],
                "schedule": [
                    {"at": "zero", "stop_for": "P0D"},
                    {"at": "stop", "stop_for": "PT10S", "reception_signal": "STOP"},
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
    ts_id_response = session.get(f"{EDITOAST_URL}train_schedule/{schedule_id}/")
    ts_id_response.raise_for_status()
    simu_response = session.get(
        f"{EDITOAST_URL}train_schedule/{schedule_id}/simulation?infra_id={etcs_scenario.infra}"
    )
    simulation_final_output = simu_response.json()["final_output"]

    assert len(simulation_final_output["positions"]) == len(
        simulation_final_output["speeds"]
    )

    # To debug this test: please add a breakpoint then use front to display speed-space chart
    # (activate Context for Slopes and Speed limits).

    # route entry buffer_stop.0
    routing_req_0 = simulation_final_output["routing_requirements"][0]
    assert routing_req_0["route"] == "rt.buffer_stop.0->DA2"
    assert routing_req_0["begin_time"] == 0
    assert len(routing_req_0["zones"]) == 1
    assert (
        routing_req_0["zones"][0]["zone"]
        == "zone.[DA2:DECREASING, buffer_stop.0:INCREASING]"
    )
    assert routing_req_0["zones"][0]["end_time"] == 103_241

    routing_req_1 = simulation_final_output["routing_requirements"][1]
    assert routing_req_1["route"] == "rt.DA2->DA5"
    assert routing_req_1["begin_time"] == 65_194
    assert len(routing_req_1["zones"]) == 7

    # zone entry DA2 (triggered by SA2)
    assert (
        routing_req_1["zones"][0]["zone"]
        == "zone.[DA2:INCREASING, DA3:DECREASING, DA7:INCREASING]"
    )
    assert routing_req_1["zones"][0]["end_time"] == 111_927

    # zone entry DA3 (triggered by SA2)
    assert (
        routing_req_1["zones"][1]["zone"] == "zone.[DA3:INCREASING, DA6_1:DECREASING]"
    )
    assert routing_req_1["zones"][1]["end_time"] == 145_858

    routing_req_3 = simulation_final_output["routing_requirements"][3]
    assert routing_req_3["route"] == "rt.DC5->DD2"
    assert routing_req_3["begin_time"] == 214_492
    assert len(routing_req_3["zones"]) == 17
    # zone entry DD0_8 (triggered by SC5)
    assert (
        routing_req_3["zones"][9]["zone"] == "zone.[DD0_8:INCREASING, DD0_9:DECREASING]"
    )
    assert routing_req_3["zones"][9]["end_time"] == 464_473

    routing_req_6 = simulation_final_output["routing_requirements"][6]
    assert routing_req_6["route"] == "rt.DG0->DH2"
    # matches the start of the braking curve if stop on closed-signal SG0
    assert routing_req_6["begin_time"] == TIME_START_BRAKING_ETCS_FROM_BUFFER0_TO_SG0
    assert len(routing_req_6["zones"]) == 2
    # zone entry DH1 (triggered by SG0)
    assert routing_req_6["zones"][1]["zone"] == "zone.[DH1:INCREASING, DH2:DECREASING]"
    assert routing_req_6["zones"][1]["end_time"] == 851_123

    routing_req_7 = simulation_final_output["routing_requirements"][7]
    assert routing_req_7["route"] == "rt.DH2->buffer_stop.7"
    assert routing_req_7["begin_time"] == 813_526
    assert len(routing_req_7["zones"]) == 4
    # zone entry DH1_2 (triggered by SH2)
    assert (
        routing_req_7["zones"][3]["zone"]
        == "zone.[DH1_2:INCREASING, buffer_stop.7:DECREASING]"
    )
    assert routing_req_7["zones"][3]["end_time"] == 1_042_849


def test_etcs_stop_at_requirements_eoa(
    etcs_scenario: Scenario, etcs_rolling_stock: int, session: Session
):
    """
    Stopping exactly at the EoA from routing and spacing requirements (route-delimiter signal): SG0

    Reserving route/spacing at the moment of the stop (speed == 0km/h) for now.
    Note: no specification was written on that, it could change (start of the braking curve?) when
      the curves are a complete match.
    """
    rolling_stock_response = session.get(
        EDITOAST_URL + f"light_rolling_stock/{etcs_rolling_stock}"
    )
    etcs_rolling_stock_name = rolling_stock_response.json()["name"]
    ts_response = session.post(
        f"{EDITOAST_URL}timetable/{etcs_scenario.timetable}/train_schedules/",
        json=[
            {
                "train_name": "stop exactly at EoA from requirements",
                "labels": [],
                "rolling_stock_name": etcs_rolling_stock_name,
                "start_time": "2024-01-01T07:00:00Z",
                "path": [
                    {"id": "zero", "track": "TA0", "offset": 0},
                    {"id": "stop", "track": "TG0", "offset": 800_000},
                    {"id": "last", "track": "TH1", "offset": 5_000_000},
                ],
                "schedule": [
                    {"at": "zero", "stop_for": "P0D"},
                    {"at": "stop", "stop_for": "PT10S", "reception_signal": "STOP"},
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
    ts_id_response = session.get(f"{EDITOAST_URL}train_schedule/{schedule_id}/")
    ts_id_response.raise_for_status()
    simu_response = session.get(
        f"{EDITOAST_URL}train_schedule/{schedule_id}/simulation?infra_id={etcs_scenario.infra}"
    )
    simulation_final_output = simu_response.json()["final_output"]

    assert len(simulation_final_output["positions"]) == len(
        simulation_final_output["speeds"]
    )

    # To debug this test: please add a breakpoint then use front to display speed-space chart
    # (activate Context for Slopes and Speed limits).

    # Middle stop on SG0 braking curve
    offset_start_brake_288_to_0 = 33_123_530
    speed_start_brake_288_to_0 = _get_current_or_next_speed_at(
        simulation_final_output, offset_start_brake_288_to_0
    )
    _assert_equal_speeds(speed_start_brake_288_to_0, MAX_SPEED_288)
    assert (
        _get_current_or_next_speed_at(
            simulation_final_output, offset_start_brake_288_to_0 + 1
        )
        < speed_start_brake_288_to_0
    )
    time_start_brake_288_to_0 = _get_current_or_next_time_at(
        simulation_final_output, offset_start_brake_288_to_0
    )
    # matching the reservation time for spacing and routing if no stop
    assert time_start_brake_288_to_0 == TIME_START_BRAKING_ETCS_FROM_BUFFER0_TO_SG0

    routing_req_6 = simulation_final_output["routing_requirements"][6]
    assert routing_req_6["route"] == "rt.DG0->DH2"
    assert routing_req_6["begin_time"] == 772_852
    assert len(routing_req_6["zones"]) == 2
    assert (
        routing_req_6["zones"][0]["zone"]
        == "zone.[DG0:INCREASING, DG1:DECREASING, DH0:INCREASING, DH1:DECREASING]"
    )
    assert routing_req_6["zones"][0]["end_time"] == 842_038
    assert routing_req_6["zones"][1]["zone"] == "zone.[DH1:INCREASING, DH2:DECREASING]"
    assert routing_req_6["zones"][1]["end_time"] == 864_137

    # zone entry DG0 (triggered by SG0)
    spacing_req_zone_stop = simulation_final_output["spacing_requirements"][31]
    assert (
        spacing_req_zone_stop["zone"]
        == "zone.[DG0:INCREASING, DG1:DECREASING, DH0:INCREASING, DH1:DECREASING]"
    )
    assert spacing_req_zone_stop["begin_time"] == 772_852
    assert spacing_req_zone_stop["end_time"] == 842_038


def test_etcs_schedule_braking_curves_endpoint(
    etcs_scenario: Scenario, etcs_rolling_stock: int, session: Session
):
    rolling_stock_response = session.get(
        EDITOAST_URL + f"light_rolling_stock/{etcs_rolling_stock}"
    )
    etcs_rolling_stock_name = rolling_stock_response.json()["name"]
    ts_response = session.post(
        f"{EDITOAST_URL}timetable/{etcs_scenario.timetable}/train_schedules/",
        json=[_get_etcs_braking_curves_train_data(etcs_rolling_stock_name)],
    )

    schedule = ts_response.json()[0]
    schedule_id = schedule["id"]
    ts_id_response = session.get(f"{EDITOAST_URL}train_schedule/{schedule_id}/")
    ts_id_response.raise_for_status()
    etcs_braking_curves_response = session.get(
        f"{EDITOAST_URL}train_schedule/{schedule_id}/etcs_braking_curves?infra_id={etcs_scenario.infra}"
    )
    _check_etcs_braking_curves_response(etcs_braking_curves_response)


def _get_etcs_braking_curves_train_data(rolling_stock_name: str) -> dict[str, Any]:
    return {
        "train_name": "3 brakes + 2 slowdowns + 29 signals",
        "labels": [],
        "rolling_stock_name": rolling_stock_name,
        "start_time": "2024-01-01T07:00:00Z",
        "path": [
            {"id": "zero", "track": "TA0", "offset": 862_000},
            {"id": "first", "track": "TD0", "offset": 1_7156_000},
            {"id": "second", "track": "TH1", "offset": 1_177_000},
            {"id": "last", "track": "TH1", "offset": 3_922_000},
        ],
        "schedule": [
            {"at": "zero", "stop_for": "P0D"},
            {"at": "first", "stop_for": "PT10S", "reception_signal": "STOP"},
            {"at": "second", "stop_for": "PT10S", "reception_signal": "STOP"},
            {"at": "last", "stop_for": "P0D"},
        ],
        "margins": {"boundaries": [], "values": ["0%"]},
        "initial_speed": 0,
        "comfort": "STANDARD",
        "constraint_distribution": "STANDARD",
        "speed_limit_tag": "foo",
        "power_restrictions": [],
    }


def _check_etcs_braking_curves_response(etcs_braking_curves_response: Response):
    slowdowns = etcs_braking_curves_response.json()["slowdowns"]
    stops = etcs_braking_curves_response.json()["stops"]
    conflicts = etcs_braking_curves_response.json()["conflicts"]

    # Check that the correct stop curves (EoAs = stops) are present
    first_stop_offset = 29_294_000
    second_stop_offset = 42_315_000
    final_stop_offset = 45_060_000
    stop_offsets = [
        first_stop_offset,
        second_stop_offset,
        final_stop_offset,
    ]
    start_braking_curves_offsets = [
        [21_467_192, MAX_SPEED_288],
        [
            34_638_530,
            MAX_SPEED_288,
        ],  # Hitting the LoA maintain-speed, but not the actual MRSP
        [43_763_476, SPEED_LIMIT_142],
    ]
    assert len(stops) == len(stop_offsets)
    for i in range(len(stops)):
        used_curve_type = "indication"
        if i == len(stops) - 1:
            # The last stop is on an open signal: the indication is null and the used curve is the permitted speed
            used_curve_type = "permitted_speed"
            assert stops[i]["indication"] is None
        used_curve = stops[i][used_curve_type]
        indication = stops[i]["indication"]
        permitted_speed = stops[i]["permitted_speed"]
        guidance = stops[i]["guidance"]
        assert used_curve["positions"][0] == start_braking_curves_offsets[i][0]
        assert used_curve["speeds"][0] == start_braking_curves_offsets[i][1]
        assert used_curve["positions"][-1] == stop_offsets[i]
        assert used_curve["speeds"][-1] == 0
        assert permitted_speed["positions"][-1] == stop_offsets[i]
        assert permitted_speed["speeds"][-1] == 0
        assert guidance["positions"][-1] == stop_offsets[i]
        assert guidance["speeds"][-1] == 0
        if indication is not None:
            assert indication["positions"][0] < permitted_speed["positions"][0] or (
                indication["positions"][0] == permitted_speed["positions"][0]
                and indication["speeds"][0] < permitted_speed["speeds"][0]
            )
        assert (
            permitted_speed["positions"][0] <= guidance["positions"][0]
            and permitted_speed["speeds"][0] <= guidance["speeds"][0]
        )

    # Check that the correct slowdown curves (LoAs = slowdowns) are present
    first_slowdown_offset = 40_638_000
    second_slowdown_offset = 44_638_000
    slowdown_offsets = [
        [first_slowdown_offset, SPEED_LIMIT_142],
        [second_slowdown_offset, SPEED_LIMIT_112],
    ]
    start_braking_curves_offsets = [
        [34_289_913, MAX_SPEED_288],
        [43_551_825, SPEED_LIMIT_142],
    ]
    assert len(slowdowns) == len(slowdown_offsets)
    for i in range(len(slowdowns)):
        indication = slowdowns[i]["indication"]
        permitted_speed = slowdowns[i]["permitted_speed"]
        guidance = slowdowns[i]["guidance"]
        assert indication["positions"][0] == start_braking_curves_offsets[i][0]
        assert indication["speeds"][0] == start_braking_curves_offsets[i][1]
        assert indication["positions"][-1] == slowdown_offsets[i][0]
        assert indication["speeds"][-1] == slowdown_offsets[i][1]
        assert permitted_speed["positions"][-1] == slowdown_offsets[i][0]
        assert permitted_speed["speeds"][-1] == slowdown_offsets[i][1]
        assert guidance["positions"][-1] == slowdown_offsets[i][0]
        assert guidance["speeds"][-1] == slowdown_offsets[i][1]
        assert indication["positions"][0] < permitted_speed["positions"][0] or (
            indication["positions"][0] == permitted_speed["positions"][0]
            and indication["speeds"][0] < permitted_speed["speeds"][0]
        )
        assert (
            permitted_speed["positions"][0] <= guidance["positions"][0]
            and permitted_speed["speeds"][0] <= guidance["speeds"][0]
        )

    # Check that the correct conflict curves are present: 29 spacing conflict curves and 7 routing conflict curves
    assert len(conflicts) == 36
    spacing_count = 0
    routing_count = 0
    for i in range(len(conflicts)):
        indication = conflicts[i]["indication"]
        permitted_speed = conflicts[i]["permitted_speed"]
        guidance = conflicts[i]["guidance"]
        conflict_type = conflicts[i]["conflict_type"]
        assert indication["speeds"][-1] == 0
        assert permitted_speed["speeds"][-1] == 0
        assert guidance["speeds"][-1] == 0
        assert indication["positions"][0] < permitted_speed["positions"][0] or (
            indication["positions"][0] == permitted_speed["positions"][0]
            and indication["speeds"][0] < permitted_speed["speeds"][0]
        )
        assert (
            permitted_speed["positions"][0] <= guidance["positions"][0]
            and permitted_speed["speeds"][0] <= guidance["speeds"][0]
        )
        if conflict_type == "Spacing":
            spacing_count += 1
        elif conflict_type == "Routing":
            routing_count += 1
    assert spacing_count == 29
    assert routing_count == 7
    last_conflict_curves = conflicts[-1]
    assert last_conflict_curves["indication"]["positions"][0] == 42_766_050
    assert last_conflict_curves["indication"]["positions"][-1] == 44_538_000


def _assert_equal_speeds(left, right):
    assert abs(left - right) < 1e-2


def _get_current_or_next_speed_at(
    simulation_final_output: dict[str, Any], position: int
) -> int:
    idx = bisect.bisect_left(simulation_final_output["positions"], position)
    return simulation_final_output["speeds"][idx]


def _get_current_or_prev_speed_at(
    simulation_final_output: dict[str, Any], position: int
) -> int:
    idx = bisect.bisect_left(simulation_final_output["positions"], position)
    if simulation_final_output["positions"][idx] > position and idx > 0:
        return simulation_final_output["speeds"][idx - 1]
    else:
        return simulation_final_output["speeds"][idx]


def _get_current_or_next_time_at(
    simulation_final_output: dict[str, Any], position: int
) -> int:
    idx = bisect.bisect_left(simulation_final_output["positions"], position)
    return simulation_final_output["times"][idx]
