from pathlib import Path
import random
from typing import List

from railjson_generator import (
    InfraBuilder,
    SimulationBuilder,
    ApplicableDirection,
    Location,
)
from railjson_generator.schema.infra.direction import Direction
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
        print(f"\t{endpoint.track_section.label} {endpoint.endpoint}")
        _add_detector_at(endpoint.track_section, _endpoint_offset(endpoint, 50))


def _link_all_tracks(builder: InfraBuilder, tracks: List[TrackSection]):
    random.shuffle(tracks)
    open_endpoints = [tracks[0].begin(), tracks[0].end()]
    i = 1
    while i < len(tracks):
        track = tracks[i]
        endpoint = _random_endpoint(track)
        random.shuffle(open_endpoints)
        if len(open_endpoints) > 1 and random.randint(0, 2) == 0:
            a, b = open_endpoints[:2]
            if len(set(e.track_section.label for e in [a, b])) == 2:
                _make_switch(builder, endpoint, a, b)
                open_endpoints = open_endpoints[3:]
                open_endpoints.append(endpoint.opposite())
                i += 1
                continue
        if i < len(tracks) - 1 and random.randint(0, 1) == 0:
            connected_endpoint = open_endpoints[0]
            other_endpoint = _random_endpoint(tracks[i + 1])
            _make_switch(builder, connected_endpoint, endpoint, other_endpoint)
            open_endpoints[0] = other_endpoint.opposite()
            i += 1
        else:
            link_to = open_endpoints.pop()
            builder.add_link(endpoint, link_to)
            print(f"link:\n\t{endpoint.track_section.label} {endpoint.endpoint}")
            print(f"\t{link_to.track_section.label} {link_to.endpoint}")
        open_endpoints.append(endpoint.opposite())
        i += 1


def _add_random_detectors(tracks: List[TrackSection]):
    for track in tracks:
        min_position = 50
        max_position = track.length - 50
        if min_position < max_position:
            for _ in range(random.randint(0, 3)):
                _add_detector_at(track, min_position + random.random() * (max_position - min_position))


def _generate_random_schedule(builder: SimulationBuilder, tracks: List[TrackSection], label: str):
    track = random.choice(tracks)
    origin = Location(track, random.random() * track.length)
    direction = Direction.START_TO_STOP if random.randint(0, 1) == 1 else Direction.STOP_TO_START
    while random.randint(0, 5) != 0:
        neighbors = track.neighbors(direction)
        if not neighbors:
            break
        next_track_endpoint = random.choice(neighbors)
        direction = Direction.START_TO_STOP \
            if next_track_endpoint.endpoint is Endpoint.BEGIN else Direction.STOP_TO_START
        track = next_track_endpoint.track_section
    destination = Location(track, random.random() * track.length)
    builder.add_train_schedule(
        origin, destination, label=label, departure_time=random.random() * 60
    )


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

    for i in range(15):
        _generate_random_schedule(builder, tracks, str(i))

    # Build simulation
    sim = builder.build()

    # Save railjson
    sim.save(Path(sim_path))


if __name__ == "__main__":
    generate_random_infra(0, 25, "infra.json", "simulation.json")
