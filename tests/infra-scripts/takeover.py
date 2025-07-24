#!/usr/bin/env python3
import sys
from dataclasses import dataclass
from pathlib import Path

from railjson_generator import ApplicableDirection, Direction, InfraBuilder
from railjson_generator.schema.infra.electrification import Electrification
from railjson_generator.schema.infra.track_section import TrackSection
from small_infra_creator import ScenarioData

# See https://github.com/OpenRailAssociation/osrd/issues/10570 for context
# The goal of this infra is to test minimal takeover setups in STDCM
#
#
#                            t.takeover
#                         _>__>______>>__
#           t.1          /     op.center \         t.3
#  op___>___>___>___>___s________>___op___s___>___>___>___>___>___op
# op.start             s.1      t.2      s.2                     op.end
#
# op.* = operational point id
# t.* = track id
# s.* = switch id
# > = signal
#
# Signals are placed roughly every 2km on t.1 and t.3.
# Signal placements are described more accurately on t.takeover
# in the signal array as comments.


def _build_scenario_data():
    # GENERATE INFRA
    builder = InfraBuilder()

    # Create operational points
    op_start = builder.add_operational_point(
        "op.start", trigram="STA", uic=8700, weight=1
    )
    op_center = builder.add_operational_point(
        "op.center", trigram="CEN", uic=8711, weight=0.5
    )
    op_takeover = builder.add_operational_point(
        "op.takeover", trigram="TAK", uic=8733, weight=0.5
    )
    op_end = builder.add_operational_point("op.end", trigram="END", uic=8722, weight=1)

    # Create track sections

    t_1 = builder.add_track_section(length=20_000, label="t_1")
    t_2 = builder.add_track_section(length=2_000, label="t_2")
    t_takeover = builder.add_track_section(length=2_100, label="t_takeover")
    t_3 = builder.add_track_section(length=20_000, label="t_3")

    # Add objects on tracks

    op_start.add_part(t_1, 0)
    op_end.add_part(t_3, 20_000)
    op_center.add_part(t_2, 1_500)
    op_takeover.add_part(t_takeover, 1_500)
    t_1.add_buffer_stop(label="bf.1", position=0)
    t_3.add_buffer_stop(label="bf.3", position=20_000)

    builder.infra.electrifications.append(
        Electrification("electrification_1500", "1500V", [t_1, t_2, t_3, t_takeover])
    )

    speed_limit = builder.add_speed_section(30 / 3.6)
    speed_limit.add_track_range(
        t_takeover, 0, t_takeover.length, ApplicableDirection.BOTH
    )

    # Signals

    default_sight_distance = 400

    @dataclass
    class Signal:
        name: str
        track: TrackSection
        position: int
        is_route_delimiter: bool
        sight_distance: int = default_sight_distance

    raw_signals: list[Signal] = [
        Signal("s.2.1500", t_2, 1_500, False),
        Signal("s.takeover.start.1", t_takeover, 1, True),
        # start.1 -> start.2 : needs to be at least as long as the new train
        # (we still have constraints from the main path while the tail hasn't left)
        Signal("s.takeover.start.2", t_takeover, 500, True),
        # start.2 -> end.1 : where the engineering allowance happens.
        # Needs to be long enough to almost stop and speed up from/to the maximum
        # speed set on the takeover track (here 30km/h)
        Signal(
            "s.takeover.end.1", t_takeover, 2_000 - default_sight_distance - 2, True, 0
        ),
        # end.1 -> end.2 : stops the signal propagation to the main track
        Signal(
            "s.takeover.end.2", t_takeover, 2_000 - default_sight_distance - 1, True, 0
        ),
        # end.2 -> end of the takeover track : needs to be as long as the default
        # signal sight distance. We must not see the signals on the main track while
        # in the block used for the engineering allowance.
    ]
    for offset in range(0, 20_000, 2_000):
        raw_signals.append(Signal(f"s.1.{offset}", t_1, offset, False))
        raw_signals.append(Signal(f"s.3.{offset}", t_3, offset, False))

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
            sight_distance=raw_signal.sight_distance,
        )
        signal.add_logical_signal(
            "BAL", settings={"Nf": "true" if raw_signal.is_route_delimiter else "false"}
        )
        signals.append(signal)

    # Add links

    builder.add_point_switch(t_1.end(), t_2.begin(), t_takeover.begin(), label="s.1")
    builder.add_point_switch(t_3.begin(), t_2.end(), t_takeover.end(), label="s.2")

    # Set coordinates

    lat_track_1 = 50
    lat_track_2 = 49.999

    t_1.begin().set_coords(-0.12, lat_track_1)
    t_1.end().set_coords(-0.1, lat_track_1)
    t_2.begin().set_coords(-0.1, lat_track_1)
    t_2.end().set_coords(-0.09, lat_track_1)
    t_3.begin().set_coords(-0.09, lat_track_1)
    t_3.end().set_coords(-0.07, lat_track_1)

    t_takeover.begin().set_coords(-0.1, lat_track_2)
    t_takeover.end().set_coords(-0.09, lat_track_2)

    # Build infra
    return ScenarioData(infra=builder.build())


scenario_data = _build_scenario_data()

if __name__ == "__main__":
    scenario_data.infra.save(Path(sys.argv[1]) / "infra.json")
    scenario_data.external_inputs.save(
        Path(sys.argv[1]) / "external_generated_inputs.json"
    )
