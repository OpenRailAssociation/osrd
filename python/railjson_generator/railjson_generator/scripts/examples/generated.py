import random
from pathlib import Path
from typing import List

from railjson_generator import (
    ApplicableDirection,
    InfraBuilder,
    Location,
    SimulationBuilder,
    get_output_dir,
)
from railjson_generator.schema.infra.direction import Direction
from railjson_generator.schema.infra.endpoint import Endpoint, TrackEndpoint
from railjson_generator.schema.infra.track_section import TrackSection

OUTPUT_DIR = get_output_dir()


def _random_endpoint(track: TrackSection):
    if random.randint(0, 1) == 0:
        return track.begin()
    else:
        return track.end()


def _rand_range(a, b):
    return a + random.random() * (b - a)


def _add_detector_at(track: TrackSection, position: float):
    detector = track.add_detector(position=position)
    length = track.length
    s1 = track.add_signal(max(0, detector.position), ApplicableDirection.START_TO_STOP, detector)
    s2 = track.add_signal(min(length, detector.position), ApplicableDirection.STOP_TO_START, detector)
    s1.add_logical_signal("BAL", settings={"Nf": "true"})
    s2.add_logical_signal("BAL", settings={"Nf": "true"})


def _endpoint_offset(endpoint: TrackEndpoint, offset: float):
    length = endpoint.track_section.length
    if endpoint.endpoint is Endpoint.END:
        return min(length * 0.75, length - offset)
    else:
        return max(length * 0.25, offset)


def _make_switch(builder: InfraBuilder, a: TrackEndpoint, b: TrackEndpoint, c: TrackEndpoint):
    builder.add_point_switch(a, b, c)
    for endpoint in [a, b, c]:
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
        open_endpoints.append(endpoint.opposite())
        i += 1


def _add_random_detectors(tracks: List[TrackSection]):
    for track in tracks:
        min_position = 50
        max_position = track.length - 50
        if min_position < max_position:
            for _ in range(random.randint(0, 3)):
                _add_detector_at(track, min_position + random.random() * (max_position - min_position))


def _make_random_ranges(n_ranges: int, length: float):
    points = [0, length]
    points += [random.random() * length for _ in range(n_ranges - 1)]
    points.sort()
    return list(zip(points, points[1:]))


def _add_random_curves_slopes(tracks: List[TrackSection]):
    for track in tracks:
        length = track.length
        for begin, end in _make_random_ranges(random.randint(0, 5), length):
            if random.randint(0, 1) == 0:
                track.add_curve(begin, end, _rand_range(2000, 10000))
        for begin, end in _make_random_ranges(random.randint(0, 5), length):
            if random.randint(0, 1) == 0:
                track.add_slope(begin, end, _rand_range(-20, 20))


def _add_random_speed_sections(tracks: List[TrackSection], infra_builder: InfraBuilder):
    speed_sections = [infra_builder.add_speed_section(_rand_range(5, 30)) for _ in range(10)]
    for track in tracks:
        for begin, end in _make_random_ranges(random.randint(0, 5), track.length):
            if random.randint(0, 3) == 0:
                speed_section = random.choice(speed_sections)
                speed_section.add_track_range(track, begin, end, ApplicableDirection.BOTH)


def _generate_random_schedule(builder: SimulationBuilder, tracks: List[TrackSection], label: str):
    track = random.choice(tracks)
    origin = Location(track, random.random() * track.length)
    direction = Direction.START_TO_STOP if random.randint(0, 1) == 1 else Direction.STOP_TO_START
    seen = {track.label}
    while random.randint(0, 5) != 0:
        neighbors = track.neighbors(direction)
        if not neighbors:
            break
        next_track_endpoint = random.choice(neighbors)
        if next_track_endpoint.track_section.label in seen:
            break
        direction = (
            Direction.START_TO_STOP if next_track_endpoint.endpoint is Endpoint.BEGIN else Direction.STOP_TO_START
        )
        track = next_track_endpoint.track_section
        seen.add(track.label)
    destination = Location(track, random.random() * track.length)
    builder.add_train_schedule(origin, destination, label=label, departure_time=random.random() * 60)


def generate_random_infra(seed, n_tracks, n_trains, n_speed_categories, infra_path, sim_path):
    random.seed(seed)

    builder = InfraBuilder()

    # Create track sections
    tracks = [builder.add_track_section(length=50 + random.random() * 5000) for _ in range(n_tracks)]

    _link_all_tracks(builder, tracks)
    _add_random_detectors(tracks)
    _add_random_curves_slopes(tracks)
    _add_random_speed_sections(tracks, builder)

    # Build infra: Generate BufferStops, TVDSections and Routes
    infra = builder.build()

    # Save railjson
    infra.save(Path(infra_path))

    # GENERATE SIMULATION
    builder = SimulationBuilder()

    for i in range(n_trains):
        _generate_random_schedule(builder, tracks, str(i))

    # Build simulation
    sim = builder.build()

    # Save railjson
    sim.save(Path(sim_path))


for i in range(10):
    root = (OUTPUT_DIR / str(i)).resolve()
    root.mkdir(exist_ok=True, parents=True)
    generate_random_infra(i, 35, 3, 10, root / "infra.json", root / "simulation.json")
