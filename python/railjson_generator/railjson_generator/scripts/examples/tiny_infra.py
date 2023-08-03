from pathlib import Path

from railjson_generator import (
    ApplicableDirection,
    Direction,
    InfraBuilder,
    Location,
    SimulationBuilder,
    get_output_dir,
)

OUTPUT_DIR = get_output_dir()


# GENERATE INFRA
builder = InfraBuilder()

# Create operational points
station_foo = builder.add_operational_point("op.station_foo")
station_bar = builder.add_operational_point("op.station_bar")

# Create track sections

ne_micro_foo_a = builder.add_track_section(length=200, label="ne.micro.foo_a")
ne_micro_foo_a.add_curve(0, 200, 2000)
station_foo.add_part(ne_micro_foo_a, 100)
ne_micro_foo_a.add_buffer_stop(label="buffer_stop_a", position=0)
tde_foo_a_switch_foo = ne_micro_foo_a.add_detector(label="tde.foo_a-switch_foo", position=175)
signal = ne_micro_foo_a.add_signal(
    label="il.sig.C1", position=150, direction=Direction.START_TO_STOP, linked_detector=tde_foo_a_switch_foo
)
signal.add_logical_signal("BAL", settings={"Nf": "true"})

ne_micro_foo_b = builder.add_track_section(length=200, label="ne.micro.foo_b")
ne_micro_foo_b.add_slope(0, 200, 10)
ne_micro_foo_b.add_curve(0, 200, 2000)
station_foo.add_part(ne_micro_foo_b, 100)
ne_micro_foo_b.add_buffer_stop(label="buffer_stop_b", position=0)
tde_foo_b_switch_foo = ne_micro_foo_b.add_detector(label="tde.foo_b-switch_foo", position=175)
signal = ne_micro_foo_b.add_signal(
    label="il.sig.C3", position=150, direction=Direction.START_TO_STOP, linked_detector=tde_foo_b_switch_foo
)
signal.add_logical_signal("BAL", settings={"Nf": "true"})

ne_micro_bar_a = builder.add_track_section(length=200, label="ne.micro.bar_a")
station_bar.add_part(ne_micro_bar_a, 100)
ne_micro_bar_a.add_buffer_stop(label="buffer_stop_c", position=200)
tde_track_bar = ne_micro_bar_a.add_detector(label="tde.track-bar", position=25)
signal = ne_micro_bar_a.add_signal(
    label="il.sig.C2", position=50, direction=Direction.STOP_TO_START, linked_detector=tde_track_bar
)
signal.add_logical_signal("BAL", settings={"Nf": "true"})
signal = ne_micro_bar_a.add_signal(
    label="il.sig.S7", position=0, direction=Direction.START_TO_STOP, linked_detector=tde_track_bar
)
signal.add_logical_signal("BAL", settings={"Nf": "false"})

ne_micro_foo_to_bar = builder.add_track_section(length=10000, label="ne.micro.foo_to_bar")
ne_micro_foo_to_bar.add_slope(0, 5000, 10)
ne_micro_foo_to_bar.add_slope(5000, 10000, -10)
tde_switch_foo_track = ne_micro_foo_to_bar.add_detector(label="tde.switch_foo-track", position=25)
signal = ne_micro_foo_to_bar.add_signal(
    label="il.sig.C6", position=50, direction=Direction.STOP_TO_START, linked_detector=tde_switch_foo_track
)
signal.add_logical_signal("BAL", settings={"Nf": "true"})

speed_section = builder.add_speed_section(60.0 / 3.6)
speed_section.add_track_range(ne_micro_foo_to_bar, 2_000, 6_000, ApplicableDirection.BOTH)

# TODO catenaries on ne_micro_foo_to_bar


# Add links
link = builder.add_link(ne_micro_foo_to_bar.end(), ne_micro_bar_a.begin())
switch = builder.add_point_switch(
    ne_micro_foo_to_bar.begin(), ne_micro_foo_b.end(), ne_micro_foo_a.end(), label="il.switch_foo"
)

# Set coordinates

center_x = -42
center_y = 70
switch.set_coords(center_x, center_y + 1)
link.set_coords(center_x, center_y + 2)
ne_micro_foo_a.begin().set_coords(center_x, center_y)
ne_micro_foo_b.begin().set_coords(center_x + 1, center_y)
ne_micro_bar_a.end().set_coords(center_x, center_y + 3)

# Build infra
infra = builder.build()

# Save railjson
infra.save(OUTPUT_DIR / "infra.json")

# GENERATE SIMULATION
builder = SimulationBuilder()
builder.add_train_schedule(Location(ne_micro_foo_b, 100), Location(ne_micro_bar_a, 100), label="Test.")
sim = builder.build()
sim.save(OUTPUT_DIR / Path("simulation.json"))

# Simulation with 2 trains
builder_2trains = SimulationBuilder()
builder_2trains.add_train_schedule(Location(ne_micro_foo_b, 100), Location(ne_micro_bar_a, 100), label="First")
builder_2trains.add_train_schedule(Location(ne_micro_foo_a, 100), Location(ne_micro_bar_a, 100), label="Second")
sim2 = builder_2trains.build()
sim2.save(OUTPUT_DIR / Path("simulation_2trains.json"))
