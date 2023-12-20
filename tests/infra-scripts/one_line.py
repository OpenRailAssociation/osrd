#!/usr/bin/env python3

from railjson_generator import ApplicableDirection, InfraBuilder, get_output_dir

OUTPUT_DIR = get_output_dir()

# GENERATE INFRA
builder = InfraBuilder()

# Create track sections
tracks = [builder.add_track_section(length=1000) for _ in range(10)]
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
    first_endpoint = first_track.begin() if first_track.inverted else first_track.end()
    second_endpoint = second_track.end() if second_track.inverted else second_track.begin()
    builder.add_link(first_endpoint, second_endpoint)

# Add detector and signals
for track in tracks:
    detector = track.add_detector(position=500)
    signal = track.add_signal(detector.position, ApplicableDirection.START_TO_STOP, is_route_delimiter=True)
    signal.add_logical_signal("BAL", settings={"Nf": "true"})
    signal = track.add_signal(detector.position, ApplicableDirection.STOP_TO_START, is_route_delimiter=True)
    signal.add_logical_signal("BAL", settings={"Nf": "true"})

# Build infra
infra = builder.build()

# Save railjson
infra.save(OUTPUT_DIR / "infra.json")
