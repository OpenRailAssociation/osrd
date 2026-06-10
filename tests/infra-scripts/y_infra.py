#!/usr/bin/env python3
import sys
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

from railjson_generator import Direction, InfraBuilder
from railjson_generator.schema.infra.track_section import TrackSection
from small_infra_creator import ScenarioData

#  op.a  s.a1   s.a2  s.a3
#  op______≷______≷____>>__
#             t.a          \
#  op.b  s.b1    s.b2 s.b3  \    s.c1  s.c2  s.c3   s.c4  s.c5
#  op______≷______≷____>>____+____<<____>______<_____>_____<___op|
#             t.b                         t.center             op.c
#
# op.* = operational point id
# t.* = track id
# > = signal
# >> = signal that start a route ("Nf")
# ≷ = signals on both directions
#
# This infra is used to test backtracks,
# specifically when tracks, routes, blocks aren't nicely aligned with one another.
# On t.center, there are signals on both directions but not at the same locations.
#
# Signals pointing toward the left (resp. right) are named "s.left.*" (resp. "s.right.*"),
# even when there are no matching signal on the opposite direction.


def _build_scenario_data() -> ScenarioData:
    builder = InfraBuilder()

    # Create operational points
    op_a = builder.add_operational_point(label="op.a", secondary_code="A")
    op_b = builder.add_operational_point(label="op.b", secondary_code="B")
    op_c = builder.add_operational_point(label="op.c", secondary_code="C")

    # Create track sections
    t_a = builder.add_track_section(length=10_000, label="t_a")
    t_b = builder.add_track_section(length=10_000, label="t_b")
    t_center = builder.add_track_section(length=10_000, label="t_center")

    # Add objects on tracks
    op_a.add_part(t_a, 0, "V1")
    op_b.add_part(t_b, 0, "V1")
    op_c.add_part(t_center, 10_000, "V1")
    t_a.add_buffer_stop(label="bf.a", position=0)
    t_b.add_buffer_stop(label="bf.b", position=0)
    t_center.add_buffer_stop(label="bf.c", position=10_000)

    # Signals
    class Directions(Enum):
        LEFT = "left"
        RIGHT = "right"
        BOTH = "both"

    @dataclass
    class Signal:
        name: str
        track: TrackSection
        position: int
        is_route_delimiter: bool
        directions: Directions

    raw_signals: list[Signal] = [
        Signal("a1", t_a, 3_000, False, Directions.BOTH),
        Signal("a2", t_a, 6_000, False, Directions.BOTH),
        Signal("a3", t_a, 9_000, True, Directions.RIGHT),
        Signal("b1", t_b, 3_000, False, Directions.BOTH),
        Signal("b2", t_b, 6_000, False, Directions.BOTH),
        Signal("b3", t_b, 9_000, True, Directions.RIGHT),
        Signal("c1", t_center, 1_000, True, Directions.LEFT),
        Signal("c2", t_center, 3_000, False, Directions.RIGHT),
        Signal("c3", t_center, 5_000, False, Directions.LEFT),
        Signal("c4", t_center, 7_000, False, Directions.RIGHT),
        Signal("c5", t_center, 9_000, False, Directions.LEFT),
    ]
    signals = []
    for raw_signal in raw_signals:
        raw_signal.track.add_detector(
            label=f"det.{raw_signal.name}", position=raw_signal.position
        )
        for direction in [Directions.LEFT, Directions.RIGHT]:
            if (
                raw_signal.directions != Directions.BOTH
                and raw_signal.directions != direction
            ):
                continue
            name = f"s.{direction.value}.{raw_signal.name}"
            if direction == Directions.LEFT:
                rjs_direction = Direction.STOP_TO_START
            else:
                rjs_direction = Direction.START_TO_STOP
            signal = raw_signal.track.add_signal(
                label=name,
                position=raw_signal.position,
                direction=rjs_direction,
                is_route_delimiter=raw_signal.is_route_delimiter,
            )
            signal.add_logical_signal(
                "BAL",
                settings={"Nf": "true" if raw_signal.is_route_delimiter else "false"},
            )
            signals.append(signal)

    # Add link
    builder.add_point_switch(t_center.begin(), t_a.end(), t_b.end(), label="switch")

    # Set coordinates
    lat_track_1 = 50
    lat_track_2 = 49.98

    t_a.begin().set_coords(-0.3, lat_track_1)
    t_a.end().set_coords(-0.1, lat_track_2)
    t_b.begin().set_coords(-0.3, lat_track_2)
    t_b.end().set_coords(-0.1, lat_track_2)

    t_center.begin().set_coords(-0.1, lat_track_2)
    t_center.end().set_coords(0.1, lat_track_2)

    return ScenarioData(infra=builder.build())


scenario_data = _build_scenario_data()

if __name__ == "__main__":
    scenario_data.infra.save(Path(sys.argv[1]) / "infra.json")
    scenario_data.external_inputs.save(
        Path(sys.argv[1]) / "external_generated_inputs.json"
    )
