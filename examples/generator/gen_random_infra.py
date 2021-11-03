from pathlib import Path
import random
from typing import List

from railjson_generator import (
    InfraBuilder,
    SimulationBuilder,
    ApplicableDirection,
    Location,
)
from railjson_generator.schema.infra.endpoint import TrackEndpoint, Endpoint
from railjson_generator.schema.infra.track_section import TrackSection


def _random_endpoint(track: TrackSection):
    if random.randint(0, 1) == 0:
        return track.begin()
    else:
        return track.end()


def _add_detector_at(track: TrackSection, position: float):
    detector = track.add_detector(position=position)
    length = track.length
    track.add_signal(max(0, detector.position - 25), ApplicableDirection.NORMAL, detector)
    track.add_signal(min(length, detector.position + 25), ApplicableDirection.REVERSE, detector)


def _endpoint_offset(endpoint: TrackEndpoint, offset: float):
    length = endpoint.track_section.length
    if endpoint.endpoint is Endpoint.END:
        return min(length * 0.75, length - offset)
    else:
        return max(length * 0.25, offset)


def _make_switch(builder: InfraBuilder, a: TrackEndpoint, b: TrackEndpoint, c: TrackEndpoint):
    print("link :")
    builder.add_switch(a, b, c)
    for endpoint in [a, b, c]:
        print("    ", endpoint.track_section.label, endpoint.endpoint)
        _add_detector_at(endpoint.track_section, _endpoint_offset(endpoint, 50))


def _link_all_tracks(builder: InfraBuilder, tracks: List[TrackSection]):
    open_endpoints = list()
    for track in tracks:
        open_endpoints.append(track.begin())
        open_endpoints.append(track.end())
    tracks_not_linked = set(track.label for track in tracks)
    while True:
        random.shuffle(open_endpoints)
        a, b, c = open_endpoints[:3]
        if len(set(endpoint.track_section.label for endpoint in [a, b, c])) == 3:
            _make_switch(builder, a, b, c)
            open_endpoints = open_endpoints[3:]
            for endpoint in [a, b, c]:
                tracks_not_linked.discard(endpoint.track_section.label)
        if len(tracks_not_linked) == 0:
            if len(open_endpoints) < 3 or random.randint(0, 3) == 0:
                break


def _add_random_detectors(tracks: List[TrackSection]):
    for track in tracks:
        min_position = 50
        max_position = track.length - 50
        if min_position < max_position:
            for _ in range(random.randint(0, 3)):
                _add_detector_at(track, min_position + random.random() * (max_position - min_position))


def generate_random_infra(seed, n_tracks, infra_path, sim_path):

    random.seed(seed)

    builder = InfraBuilder()

    # Create track sections
    tracks = [builder.add_track_section(length=50 + random.random() * 5000) for _ in range(n_tracks)]

    _link_all_tracks(builder, tracks)

    _add_random_detectors(tracks)

    # Build infra: Generate BufferStops, TVDSections and Routes
    infra = builder.build()

    # Save railjson
    infra.save(Path(infra_path))

    # GENERATE SIMULATION
    builder = SimulationBuilder(infra)

    # TODO: generate random trains
    first_train = builder.add_train_schedule(
        Location(tracks[0], 0), Location(tracks[0], tracks[0].length), label="First", departure_time=10
    )
    first_train.add_stop(10, position=tracks[0].length)

    # Build simulation
    sim = builder.build()

    # Save railjson
    sim.save(Path(sim_path))


if __name__ == "__main__":
    generate_random_infra(0, 15, "infra.json", "simulation.json")
