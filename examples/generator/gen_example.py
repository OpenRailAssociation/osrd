from pathlib import Path

from railjson_generator import (
    InfraBuilder,
    SimulationBuilder,
    ApplicableDirection,
    Location,
)

# GENERATE INFRA
builder = InfraBuilder()

# Create track sections
tracks = [builder.add_track_section(length=1000) for _ in range(7)]

# Create switches
builder.add_switch(tracks[2].begin(), tracks[1].end(), tracks[0].end())
builder.add_switch(tracks[2].end(), tracks[3].begin(), tracks[4].begin())
builder.add_switch(tracks[4].end(), tracks[5].begin(), tracks[6].begin())

# Add Buffer Stops (Optional: buffer stops are auto generated when building infra)
tracks[0].add_buffer_stop(position=100, label="Custom Buffer Stop")

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


# Add operational points
my_op = builder.add_operational_point("my-op")
my_op.set_position(tracks[0], 500)
my_op.set_position(tracks[1], 500)

# Build infra: Generate BufferStops, TVDSections and Routes
infra = builder.build()

# Save railjson
infra.save(Path("infra.json"))

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
sim.save(Path("simulation.json"))
