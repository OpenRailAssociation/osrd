import enum
from re import L

from railjson_generator import (
    InfraBuilder,
    SimulationBuilder,
    ApplicableDirection,
    Location,
)
from railjson_generator.schema.infra.direction import Direction


def place_regular_signals_detectors(
    track_section: "TrackSection",
    label_suffix: str,
    min_offset: float = 0,
    max_offset: float = None,
    period: float = 1500,
):
    """Place signals and detectors on the track section, every <period> meters."""
    if max_offset is None:
        max_offset = track_section.length
    elif max_offset < 0:
        max_offset = track_section.length + max_offset
    n_signals = ((max_offset - min_offset) // period) - 1
    signal_step = (max_offset - min_offset) / (n_signals + 1)
    for i in range(n_signals):
        for j, direction in enumerate(
            [Direction.START_TO_STOP, Direction.STOP_TO_START]
        ):
            detector = track_section.add_detector(
                label=f"D{label_suffix}_{i}" + "r" * j,
                position=min_offset + i * signal_step + 20 + (-40 * j),
            )
            track_section.add_signal(
                label=f"S{label_suffix}_{i}" + "r" * j,
                linked_detector=detector,
                direction=direction,
                position=min_offset + i * signal_step,
            )


# Reference latitudes and longitudes
LAT_LINE_SPACE = 0.0001

# The three lines of the west station
LAT_0 = 49.5
LAT_1 = LAT_0 - LAT_LINE_SPACE
LAT_2 = LAT_1 - LAT_LINE_SPACE
# The line of the north station
LAT_3 = 49.51
# The lines of the north-east station
LAT_4 = 49.513

LONG_SWITCH_LENGTH = 0.005


builder = InfraBuilder()

# ================================
#  Around station B: South-West
# ================================
tb0 = builder.add_track_section(length=300, label="TB0")

# ================================
#  Around station A: West
# ================================
# track sections
ta0 = builder.add_track_section(length=2000, label="TA0")
ta1 = builder.add_track_section(length=1950, label="TA1")
ta2 = builder.add_track_section(length=1950, label="TA2")
ta3 = builder.add_track_section(length=50, label="TA3")
ta4 = builder.add_track_section(length=50, label="TA4")
ta5 = builder.add_track_section(length=50, label="TA5")
ta6 = builder.add_track_section(length=10000, label="TA6")
ta7 = builder.add_track_section(length=10000, label="TA7")

# switches
pa0 = builder.add_point_switch(
    label="PA0",
    base=ta1.end(),
    left=ta3.begin(),
    right=ta4.begin(),
    signal_on_ports={"base": ("DA0", "SA0")},
)
pa0.set_coords(-0.365, LAT_1)
pa1 = builder.add_point_switch(
    label="PA1",
    base=ta5.begin(),
    left=tb0.end(),
    right=ta2.end(),
    signal_on_ports={"left": ("DB0", "SB0"), "right": ("DA1", "SA1")},
)
pa1.set_coords(-0.365, LAT_1 - LAT_LINE_SPACE)
pa2 = builder.add_point_switch(
    label="PA2",
    base=ta6.begin(),
    left=ta3.end(),
    right=ta0.end(),
    signal_on_ports={"base": ("DA3", "SA3"), "right": ("DA2", "SA2")},
)
pa2.set_coords(-0.037, LAT_0)
pa3 = builder.add_point_switch(
    label="PA3",
    base=ta7.begin(),
    left=ta5.end(),
    right=ta4.end(),
    signal_on_ports={"base": ("DA4", "SA4")},
)
pa3.set_coords(-0.037, LAT_1)

ta0.set_remaining_coords([[-0.4, LAT_0]])
ta1.set_remaining_coords([[-0.4, LAT_1]])
ta2.set_remaining_coords([[-0.4, LAT_2]])

# We set TB0's coordinates only here because we had to wait for PA1 to be created
tb0.set_remaining_coords([[-0.4, 49.49], [-0.373, 49.49], [-0.37, 49.492]])

# Extra detectors, which are not associated to signals

da7 = ta3.add_detector(label="DA7", position=ta3.length / 2)
da8 = ta4.add_detector(label="DA8", position=ta4.length / 2)
da9 = ta5.add_detector(label="DA9", position=ta5.length / 2)

# Extra signals
place_regular_signals_detectors(ta6, "A6", 200, -200)
place_regular_signals_detectors(ta7, "A7", 200, -200)

# ================================
#  Around station C: Mid - West
# ================================
# track sections
tc0 = builder.add_track_section(length=1050, label="TC0")
tc1 = builder.add_track_section(length=1000, label="TC1")
tc2 = builder.add_track_section(length=1000, label="TC2")
tc3 = builder.add_track_section(length=1050, label="TC3")

# I have to create them here in order to create switches
td0 = builder.add_track_section(length=25000, label="TD0")
td1 = builder.add_track_section(length=25000, label="TD1")

# Switches
pc0 = builder.add_point_switch(
    label="PC0",
    base=ta6.end(),
    left=tc0.begin(),
    right=tc1.begin(),
    signal_on_ports={
        "base": ("DA5", "SA5"),
        "left": ("DC0", "SC0"),
        "right": ("DC1", "SC1"),
    },
)
pc0.set_coords(-0.31, LAT_0)
pc1 = builder.add_point_switch(
    label="PC1",
    base=ta7.end(),
    left=tc2.begin(),
    right=tc3.begin(),
    signal_on_ports={
        "base": ("DA6", "SA6"),
        "left": ("DC2", "SC2"),
        "right": ("DC3", "SC3"),
    },
)
pc1.set_coords(-0.31, LAT_1)
pc2 = builder.add_point_switch(
    label="PC2",
    base=td0.begin(),
    left=tc1.end(),
    right=tc0.end(),
    signal_on_ports={
        "base": ("DD0", "SD0"),
        "left": ("DC5", "SC5"),
        "right": ("DC4", "SC4"),
    },
)
pc2.set_coords(-0.296, LAT_0)
pc3 = builder.add_point_switch(
    label="PC3",
    base=td1.begin(),
    left=tc3.end(),
    right=tc2.end(),
    signal_on_ports={
        "base": ("DD1", "SD1"),
        "left": ("DC7", "SC7"),
        "right": ("DC6", "SC6"),
    },
)
pc3.set_coords(-0.296, LAT_1)


tc0.set_remaining_coords(
    [[-0.309, LAT_0 + LAT_LINE_SPACE], [-0.297, LAT_0 + LAT_LINE_SPACE]]
)
tc3.set_remaining_coords(
    [[-0.309, LAT_1 - LAT_LINE_SPACE], [-0.297, LAT_1 - LAT_LINE_SPACE]]
)

# ================================
#  Around station D: Mid-East
# ================================
# track sections
td2 = builder.add_track_section(length=2000, label="TD2")
td3 = builder.add_track_section(length=3000, label="TD3")

te0 = builder.add_track_section(length=1500, label="TE0")
tf0 = builder.add_track_section(length=3, label="TF0")
tf1 = builder.add_track_section(length=5000, label="TF1")

# switches
pd0 = builder.add_cross_switch(
    label="PD0",
    north=te0.end(),
    south=tf0.begin(),
    east=td2.begin(),
    west=td0.end(),
    signal_on_ports={
        "north": ("DE0", "SE0"),
        "east": ("DD4", "SD4"),
        "west": ("DD2", "SD2"),
    },
)
pd0.set_coords(-0.172, LAT_0)
pd1 = builder.add_cross_switch(
    label="PD1",
    north=tf0.end(),
    south=tf1.begin(),
    east=td3.begin(),
    west=td1.end(),
    signal_on_ports={
        "south": ("DF0", "SF0"),
        "east": ("DD5", "SD5"),
        "west": ("DD3", "SD3"),
    },
)
pd1.set_coords(-0.172, LAT_1)

place_regular_signals_detectors(td0, "D0", 200, -200)
place_regular_signals_detectors(td1, "D1", 200, -200)

# ================================
#  Around station E: North
# ================================
# track sections
te1 = builder.add_track_section(length=2000, label="TE1")
te2 = builder.add_track_section(length=2050, label="TE2")
te3 = builder.add_track_section(length=2000, label="TE3")

tg0 = builder.add_track_section(length=1000, label="TG0")

# switches
pe0 = builder.add_point_switch(
    label="PE0",
    base=te0.begin(),
    left=te1.end(),
    right=te2.end(),
    signal_on_ports={
        "base": ("DE1", "SE1"),
        "left": ("DE2", "SE2"),
        "right": ("DE3", "SE3"),
    },
)
pe0.set_coords(-0.165, LAT_3)
pe1 = builder.add_point_switch(
    label="PE1",
    base=te3.end(),
    left=te2.begin(),
    right=te1.begin(),
    signal_on_ports={
        "base": ("DE6", "SE6"),
        "left": ("DE5", "SE5"),
        "right": ("DE4", "SE4"),
    },
)
pe1.set_coords(-0.15, LAT_3)
pe2 = builder.add_point_switch(
    label="PE2",
    base=td2.end(),
    left=te3.begin(),
    right=tg0.begin(),
    signal_on_ports={
        "base": ("DD6", "SD6"),
        "left": ("DE7", "SE7"),
        "right": ("DD7", "SD7"),
    },
)
pe2.set_coords(-0.15, LAT_0)

tf0.set_remaining_coords([[-0.172, LAT_3 - 0.002]])
te2.set_remaining_coords(
    [
        [-0.164, LAT_3 + LAT_LINE_SPACE],
        [-0.151, LAT_3 + LAT_LINE_SPACE],
    ]
)
te3.set_remaining_coords([[-0.145, LAT_0 + 0.002], [-0.145, LAT_3 - 0.002]])

# ================================
#  Around station F: South
# ================================

tf1.set_remaining_coords([[-0.172, 49.47], [-0.167, 49.466], [-0.135, 49.466]])

# ================================
#  Around station G: North-West
# ================================
# track sections
tg1 = builder.add_track_section(length=4000, label="TG1")
tg2 = builder.add_track_section(length=3000, label="TG2")
tg3 = builder.add_track_section(length=50, label="TG3")
tg4 = builder.add_track_section(length=2000, label="TG4")
tg5 = builder.add_track_section(length=2000, label="TG5")

pg0 = builder.add_point_switch(
    label="PG0",
    base=tg1.end(),
    left=tg4.begin(),
    right=tg3.begin(),
    signal_on_ports={"base": ("DG3", "SG3"), "left": ("DG5", "SG5")},
)
pg0.set_coords(-0.1082, LAT_4)
pg1 = builder.add_point_switch(
    label="PG1",
    base=tg5.begin(),
    left=tg2.end(),
    right=tg3.end(),
    signal_on_ports={"base": ("DG6", "SG6"), "left": ("DG4", "SG4")},
)
pg1.set_coords(-0.108, LAT_4 - LAT_LINE_SPACE)

tg4.set_remaining_coords([[-0.09, LAT_4]])
tg5.set_remaining_coords([[-0.09, LAT_4 - LAT_LINE_SPACE]])

dg6 = tg3.add_detector(label="DG7", position=tg3.length / 2)

# ================================
#  Around station H: South-West
# ================================
# track sections
th0 = builder.add_track_section(length=1000, label="TH0")
th1 = builder.add_track_section(length=5000, label="TH1")

# switches
ph0 = builder.add_double_cross_switch(
    label="PH0",
    north_1=tg1.begin(),
    north_2=th0.begin(),
    south_1=tg0.end(),
    south_2=td3.end(),
    signal_on_ports={
        "north_1": ("DG1", "SG1"),
        "north_2": ("DH1", "SH1"),
        "south_1": ("DG0", "SG0"),
        "south_2": ("DH0", "SH0"),
    },
)
ph0.set_coords(-0.135, LAT_0 - LAT_LINE_SPACE / 2)
ph1 = builder.add_point_switch(
    label="PH1",
    base=th0.end(),
    left=tg2.begin(),
    right=th1.begin(),
    signal_on_ports={
        "base": ("DH2", "SH2"),
        "left": ("DG2", "SG2"),
        "right": ("DH3", "SH3"),
    },
)
ph1.set_coords(-0.12, LAT_1)

# TODO finish coords
td3.set_remaining_coords([[-0.1354, LAT_1]])
tg0.set_remaining_coords([[-0.1354, LAT_0]])
tg1.set_remaining_coords(
    [
        [-0.1346, LAT_0],
        [-0.12, LAT_0],
        [-0.115, 49.503],
        [-0.115, 49.51],
        [-0.11, LAT_4],
    ]
)
tg2.set_remaining_coords(
    [
        [-0.1199, LAT_1],
        [-0.1149, 49.50296],
        [-0.1149, 49.50997],
        [-0.09, LAT_4 - LAT_LINE_SPACE],
    ]
)
th0.set_remaining_coords([[-0.1346, LAT_1]])
th1.set_remaining_coords(
    [[-0.115, 49.497], [-0.115, 49.487], [-0.11, 49.484], [-0.09, 49.484]]
)

# ================================
# Produce the railjson
# ================================

# Build infra
infra = builder.build()

# Save railjson
infra.save("infra.json")
