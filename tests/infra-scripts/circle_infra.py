#!/usr/bin/env python3

import sys
from pathlib import Path

from railjson_generator import InfraBuilder
from small_infra_creator import ScenarioData


def _build_scenario_data():
    # GENERATE INFRA
    builder = InfraBuilder()

    # Create track sections

    track_a = builder.add_track_section(length=200, label="track_a")
    track_b = builder.add_track_section(length=200, label="track_b")
    track_c = builder.add_track_section(length=200, label="track_c")
    track_d = builder.add_track_section(length=200, label="track_d")
    builder.add_link(track_d.end(), track_a.begin())

    builder.add_point_switch(
        track_a.end(), track_b.begin(), track_c.begin(), label="switch1"
    )
    builder.add_point_switch(
        track_d.begin(), track_b.end(), track_c.end(), label="switch2"
    )

    # Build infra
    return ScenarioData(infra=builder.build())


scenario_data = _build_scenario_data()

if __name__ == "__main__":
    scenario_data.infra.save(Path(sys.argv[1]) / "infra.json")
    scenario_data.external_inputs.save(
        Path(sys.argv[1]) / "external_generated_inputs.json"
    )
