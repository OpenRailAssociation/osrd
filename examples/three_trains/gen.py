#!/usr/bin/env python3

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
tracks = [builder.add_track_section(length=1000) for _ in range(7)]

# Create switches
switch_0 = builder.add_switch(tracks[2].begin(), tracks[1].end(), tracks[0].end())
switch_1 = builder.add_switch(tracks[2].end(), tracks[3].begin(), tracks[4].begin())
switch_2 = builder.add_switch(tracks[4].end(), tracks[5].begin(), tracks[6].begin())

# Add detector and signals
for i in (2, 3, 4, 5, 6):
    track = tracks[i]
    detector = track.add_detector(position=200)
    track.add_signal(detector.position - 25, ApplicableDirection.NORMAL, detector)
    track.add_signal(detector.position + 25, ApplicableDirection.REVERSE, detector)

for i in (0, 1, 2, 4):
    track = tracks[i]
    detector = track.add_detector(position=800)
    track.add_signal(detector.position - 25, ApplicableDirection.NORMAL, detector)
    track.add_signal(detector.position + 25, ApplicableDirection.REVERSE, detector)

# Build infra: Generate BufferStops, TVDSections and Routes
infra = builder.build()

# Save railjson
infra.save(CURRENT_DIR / Path("infra.json"))

# GENERATE SIMULATION
builder = SimulationBuilder(infra)
train_0 = builder.add_train_schedule(Location(tracks[5], 900), Location(tracks[0], 200), label="train.0")
train_1 = builder.add_train_schedule(Location(tracks[0], 200), Location(tracks[6], 900), label="train.1")
train_2 = builder.add_train_schedule(Location(tracks[1], 200), Location(tracks[3], 900), label="train.2")

# Add train succession tables
builder.add_tst(switch_0, train_1, train_2, train_0)
builder.add_tst(switch_1, train_1, train_2, train_0)
builder.add_tst(switch_2, train_1, train_0)

# Build simulation
sim = builder.build()

# Save railjson
sim.save(CURRENT_DIR / Path("simulation.json"))
