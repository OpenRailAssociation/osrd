#!/usr/bin/env python3

import sys
from pathlib import Path

from railjson_generator import ApplicableDirection, InfraBuilder
from small_infra_creator import ScenarioData


def _build_scenario_data():
    # GENERATE INFRA
    builder = InfraBuilder()

    # Create track sections
    tracks = [builder.add_track_section(length=1000) for _ in range(7)]

    # Create switches
    switch_0 = builder.add_point_switch(
        tracks[2].begin(), tracks[1].end(), tracks[0].end()
    )
    switch_1 = builder.add_point_switch(
        tracks[2].end(), tracks[3].begin(), tracks[4].begin()
    )
    switch_2 = builder.add_point_switch(
        tracks[4].end(), tracks[5].begin(), tracks[6].begin()
    )

    # Set coordinates

    tracks[0].begin().set_coords(0, 250)
    tracks[1].begin().set_coords(0, -250)
    tracks[3].end().set_coords(3030, 250)
    tracks[5].end().set_coords(4030, -500)
    tracks[6].end().set_coords(4030, 0)
    switch_0.set_coords(1000, 0)
    switch_1.set_coords(2030, 0)
    switch_2.set_coords(3030, -250)

    # Add detector and signals
    for i in (2, 3, 4, 5, 6):
        track = tracks[i]
        detector = track.add_detector(position=200)
        signal = track.add_signal(
            detector.position - 25,
            ApplicableDirection.START_TO_STOP,
            is_route_delimiter=False,
        )
        signal.add_logical_signal("BAL", settings={"Nf": "false"})
        signal = track.add_signal(
            detector.position + 25,
            ApplicableDirection.STOP_TO_START,
            is_route_delimiter=False,
        )
        signal.add_logical_signal("BAL", settings={"Nf": "false"})

    for i in (0, 1, 2, 4):
        track = tracks[i]
        detector = track.add_detector(position=800)
        signal = track.add_signal(
            detector.position - 25,
            ApplicableDirection.START_TO_STOP,
            is_route_delimiter=False,
        )
        signal.add_logical_signal("BAL", settings={"Nf": "false"})
        signal = track.add_signal(
            detector.position + 25,
            ApplicableDirection.STOP_TO_START,
            is_route_delimiter=False,
        )
        signal.add_logical_signal("BAL", settings={"Nf": "false"})

    # Build infra: Generate BufferStops, TVDSections and Routes
    return ScenarioData(infra=builder.build())


scenario_data = _build_scenario_data()

if __name__ == "__main__":
    scenario_data.infra.save(Path(sys.argv[1]) / "infra.json")
    scenario_data.external_inputs.save(
        Path(sys.argv[1]) / "external_generated_inputs.json"
    )
