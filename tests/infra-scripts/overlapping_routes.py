#!/usr/bin/env python3
import sys
from dataclasses import dataclass
from pathlib import Path

from railjson_generator import Direction, InfraBuilder
from railjson_generator.schema.infra.track_section import TrackSection
from small_infra_creator import ScenarioData

#  op.a1                                               op.b1
#  op_____>>___                               ____>>______op
#       t.a1    \                            /     t.b1
#  op.a2         \                          /           op.b2
#  op_____>>_____s.a_____>_____>_____>_____s.b_____>>______op
#       t.a2               t.center                t.b2
#
# op.* = operational point id
# t.* = track id
# s.* = switch id
# > = signal
# >> = signal that start a route ("Nf")
#
# This infra is used to test blocks that have overlapping routes.
# There are 4 routes : a1->b1, a1->b2, a2->b1, a2->b2.
# They all overlap on t.center


def _build_scenario_data():
    # GENERATE INFRA
    builder = InfraBuilder()

    # Create operational points
    op_a1 = builder.add_operational_point("op.a1")
    op_a2 = builder.add_operational_point("op.a2")
    op_b1 = builder.add_operational_point("op.b1")
    op_b2 = builder.add_operational_point("op.b2")

    # Create track sections

    t_a1 = builder.add_track_section(length=1_000, label="t_a1")
    t_b1 = builder.add_track_section(length=1_000, label="t_b1")
    t_a2 = builder.add_track_section(length=1_000, label="t_a2")
    t_b2 = builder.add_track_section(length=1_000, label="t_b2")
    t_center = builder.add_track_section(length=10_000, label="t_center")

    # Add objects on tracks

    op_a1.add_part(t_a1, 0)
    op_b1.add_part(t_b1, 0)
    op_a2.add_part(t_a2, 1_000)
    op_b2.add_part(t_b2, 1_000)
    t_a1.add_buffer_stop(label="bf.a1", position=0)
    t_a2.add_buffer_stop(label="bf.a2", position=0)
    t_b1.add_buffer_stop(label="bf.b1", position=1_000)
    t_b2.add_buffer_stop(label="bf.b2", position=1_000)

    # Signals

    @dataclass
    class Signal:
        name: str
        track: TrackSection
        position: int
        is_route_delimiter: bool

    raw_signals: list[Signal] = [
        Signal("s.a1.nf", t_a1, 900, True),
        Signal("s.a2.nf", t_a2, 900, True),
        Signal("s.center.1", t_center, 4_000, False),
        Signal("s.center.2", t_center, 6_000, False),
        Signal("s.center.3", t_center, 8_000, False),
        Signal("s.b1.nf", t_b1, 100, True),
        Signal("s.b2.nf", t_b2, 100, True),
    ]
    signals = []
    for raw_signal in raw_signals:
        raw_signal.track.add_detector(
            label=f"det.{raw_signal.name[2:]}", position=raw_signal.position
        )
        signal = raw_signal.track.add_signal(
            label=raw_signal.name,
            position=raw_signal.position,
            direction=Direction.START_TO_STOP,
            is_route_delimiter=raw_signal.is_route_delimiter,
        )
        signal.add_logical_signal(
            "BAL", settings={"Nf": "true" if raw_signal.is_route_delimiter else "false"}
        )
        signals.append(signal)

    # Add links

    builder.add_point_switch(t_center.begin(), t_a1.end(), t_a2.end(), label="s.a")
    builder.add_point_switch(t_center.end(), t_b1.begin(), t_b2.begin(), label="s.b")

    # Set coordinates

    lat_track_1 = 50
    lat_track_2 = 49.98

    t_a1.begin().set_coords(-0.12, lat_track_1)
    t_a1.end().set_coords(-0.1, lat_track_2)
    t_a2.begin().set_coords(-0.12, lat_track_2)
    t_a2.end().set_coords(-0.1, lat_track_2)

    t_center.begin().set_coords(-0.1, lat_track_2)
    t_center.end().set_coords(0.1, lat_track_2)

    t_b1.begin().set_coords(0.1, lat_track_2)
    t_b1.end().set_coords(0.12, lat_track_1)
    t_b2.begin().set_coords(0.1, lat_track_2)
    t_b2.end().set_coords(0.12, lat_track_2)

    # Build infra
    return ScenarioData(infra=builder.build())


scenario_data = _build_scenario_data()

if __name__ == "__main__":
    scenario_data.infra.save(Path(sys.argv[1]) / "infra.json")
    scenario_data.external_inputs.save(
        Path(sys.argv[1]) / "external_generated_inputs.json"
    )
