#!/usr/bin/env python3

import sys
from pathlib import Path
from typing import cast

from railjson_generator import ApplicableDirection, InfraBuilder
from small_infra_creator import ScenarioData

from railjson_generator.schema.infra.track_section import TrackSection


class TrackSectionWithInvertedFlag(TrackSection):
    inverted: bool


def _build_scenario_data():
    # GENERATE INFRA
    builder = InfraBuilder()

    # Create track sections
    base_tracks: list[TrackSection] = [
        builder.add_track_section(length=1000) for _ in range(10)
    ]
    tracks = [cast(TrackSectionWithInvertedFlag, track) for track in base_tracks]
    for i, track in enumerate(tracks):
        track.inverted = i % 2 == 1

    # Set coordinates
    for i, track in enumerate(tracks):
        if track.inverted:
            track.begin().set_coords(1000 * i, 0)
            track.end().set_coords(1000 * (i + 1), 0)
        else:
            track.end().set_coords(1000 * i, 0)
            track.begin().set_coords(1000 * (i + 1), 0)

    # Add links
    for first_track, second_track in zip(tracks[:-1], tracks[1:]):
        first_endpoint = (
            first_track.begin() if first_track.inverted else first_track.end()
        )
        second_endpoint = (
            second_track.end() if second_track.inverted else second_track.begin()
        )
        builder.add_link(first_endpoint, second_endpoint)

    # Add detector and signals
    for track in tracks:
        detector = track.add_detector(position=500)
        signal = track.add_signal(
            detector.position,
            ApplicableDirection.START_TO_STOP,
            is_route_delimiter=True,
        )
        signal.add_logical_signal("BAL", settings={"Nf": "true"})
        signal = track.add_signal(
            detector.position,
            ApplicableDirection.STOP_TO_START,
            is_route_delimiter=True,
        )
        signal.add_logical_signal("BAL", settings={"Nf": "true"})

    # Build infra
    return ScenarioData(infra=builder.build())


scenario_data = _build_scenario_data()

if __name__ == "__main__":
    scenario_data.infra.save(Path(sys.argv[1]) / "infra.json")
    scenario_data.external_inputs.save(
        Path(sys.argv[1]) / "external_generated_inputs.json"
    )
