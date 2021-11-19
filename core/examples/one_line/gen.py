from pathlib import Path

from railjson_generator import (
    InfraBuilder,
    SimulationBuilder,
    ApplicableDirection,
    Location,
)

CURRENT_DIR = Path(__file__).parent

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
    builder.add_link(first_endpoint, second_endpoint, ApplicableDirection.BOTH)

# Add detector and signals
for track in tracks:
    detector = track.add_detector(position=500)
    track.add_signal(detector.position, ApplicableDirection.NORMAL, detector)
    track.add_signal(detector.position, ApplicableDirection.REVERSE, detector)

# Build infra
infra = builder.build()

# Save railjson
infra.save(CURRENT_DIR / "infra.json")

# GENERATE SIMULATION
builder = SimulationBuilder(infra)

first_train = builder.add_train_schedule(
    Location(tracks[0], 10), Location(tracks[9], 990)
)

# Build simulation
sim = builder.build()

# Save railjson
sim.save(CURRENT_DIR / "simulation.json")
