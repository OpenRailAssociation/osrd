#!/usr/bin/env python3

from pathlib import Path

from railjson_generator import (
    InfraBuilder,
    SimulationBuilder,
    ApplicableDirection,
    Location,
)
from railjson_generator.schema.infra.direction import Direction

CURRENT_DIR = Path(__file__).parent

# GENERATE INFRA
builder = InfraBuilder()

# Create track sections
tracks = [builder.add_track_section(length=1000) for _ in range(7)]


# Create switches
switch_0 = builder.add_switch(tracks[2].begin(), tracks[1].end(), tracks[0].end())
switch_1 = builder.add_switch(tracks[2].end(), tracks[3].begin(), tracks[4].begin())
switch_2 = builder.add_switch(tracks[4].end(), tracks[5].begin(), tracks[6].begin())

# Set coordinates (optional)

tracks[0].begin().set_coords(0, 250)
tracks[1].begin().set_coords(0, -250)
tracks[3].end().set_coords(3030, 250)
tracks[5].end().set_coords(4030, -500)
tracks[6].end().set_coords(4030, 0)
switch_0.set_coords(1000, 0)
switch_1.set_coords(2030, 0)
switch_2.set_coords(3030, -250)

# Add Buffer Stops (Optional: buffer stops are auto generated when building infra)
tracks[0].add_buffer_stop(position=100, label="Custom Buffer Stop")

# Add detector and signals
for i in (2, 3, 4, 5, 6):
    track = tracks[i]
    detector = track.add_detector(position=200)
    track.add_signal(detector.position - 25, Direction.START_TO_STOP, detector)
    track.add_signal(detector.position + 25, Direction.STOP_TO_START, detector)

for i in (0, 1, 2, 4):
    track = tracks[i]
    detector = track.add_detector(position=800)
    track.add_signal(detector.position - 25, Direction.START_TO_STOP, detector)
    track.add_signal(detector.position + 25, Direction.STOP_TO_START, detector)


# Add operational points
my_op = builder.add_operational_point("my-op")
my_op.set_position(tracks[0], 500)
my_op.set_position(tracks[1], 500)

# Build infra: Generate BufferStops, TVDSections and Routes
infra = builder.build()

# Save railjson
infra.save(CURRENT_DIR / Path("infra.json"))

# GENERATE SIMULATION
builder = SimulationBuilder(infra)

first_train = builder.add_train_schedule(
    Location(tracks[0], 200), Location(tracks[5], 900), label="First", departure_time=10
)
first_train.add_stop(10, location=Location(tracks[4], 250))
first_train.add_stop(10, position=2550)

second_train = builder.add_train_schedule(
    Location(tracks[1], 200),
    Location(tracks[2], 600),
    Location(tracks[6], 900),
    label="Second",
)

# Add train succession tables
for switch in infra.switches:
    builder.add_tst(switch, first_train, second_train)

# Build simulation
sim = builder.build()

# Save railjson
sim.save(CURRENT_DIR / Path("simulation.json"))
