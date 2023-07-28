#!/usr/bin/env python3

from pathlib import Path

from railjson_generator import InfraBuilder, Location, SimulationBuilder, get_output_dir
from railjson_generator.schema.infra.direction import Direction

OUTPUT_DIR = get_output_dir()

# GENERATE INFRA
builder = InfraBuilder()

# Create track sections
tracks = [builder.add_track_section(length=1000) for _ in range(7)]


# Create switches
switch_0 = builder.add_point_switch(tracks[2].begin(), tracks[1].end(), tracks[0].end())
switch_1 = builder.add_point_switch(tracks[2].end(), tracks[3].begin(), tracks[4].begin())
switch_2 = builder.add_point_switch(tracks[4].end(), tracks[5].begin(), tracks[6].begin())

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
    signal = track.add_signal(detector.position - 25, Direction.START_TO_STOP, detector)
    signal.add_logical_signal("BAL", settings={"Nf": "true"})
    signal = track.add_signal(detector.position + 25, Direction.STOP_TO_START, detector)
    signal.add_logical_signal("BAL", settings={"Nf": "true"})

for i in (0, 1, 2, 4):
    track = tracks[i]
    detector = track.add_detector(position=800)
    signal = track.add_signal(detector.position - 25, Direction.START_TO_STOP, detector)
    signal.add_logical_signal("BAL", settings={"Nf": "true"})
    signal = track.add_signal(detector.position + 25, Direction.STOP_TO_START, detector)
    signal.add_logical_signal("BAL", settings={"Nf": "true"})


# Add operational points
my_op = builder.add_operational_point("my-op")
my_op.add_part(tracks[0], 500)
my_op.add_part(tracks[1], 500)

# Build infra: Generate BufferStops, TVDSections and Routes
infra = builder.build()

# Save railjson
infra.save(OUTPUT_DIR / Path("infra.json"))

# GENERATE SIMULATION
builder = SimulationBuilder()

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

# Build simulation
sim = builder.build()

# Save railjson
sim.save(OUTPUT_DIR / Path("simulation.json"))
