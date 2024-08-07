#!/usr/bin/env python3

"""
This script generates an infrastructure of reasonable size containing all objects defined by the RailJSON schema.
For more information, and a diagram of this infrastructure, see:
https://osrd.fr/en/docs/explanation/models/data-models-full-example/
"""
from typing import Mapping, Optional, Tuple

from osrd_schemas.infra import LoadingGaugeType
from railjson_generator import (
    ApplicableDirection,
    ExternalGeneratedInputs,
    InfraBuilder,
    get_output_dir,
)
from railjson_generator.schema.infra.direction import Direction
from railjson_generator.schema.infra.electrification import Electrification
from railjson_generator.schema.infra.track_section import TrackSection

OUTPUT_DIR = get_output_dir()


def place_regular_signals_detectors(
    track_section: TrackSection,
    label_suffix: str,
    prefered_direction: Optional[Direction] = None,
    min_offset: float = 0,
    max_offset: Optional[float] = None,
    period: float = 1500,
):
    """Place signals and detectors regularly on the track section.
    In the prefered direction, every <period> meters,
    in the opposite direction, every 3 *<period> meters."""
    if max_offset is None:
        max_offset = track_section.length
    elif max_offset < 0:
        max_offset = track_section.length + max_offset

    if prefered_direction is None:
        is_prefered = [True, True]
        is_reverse = [False, True]
    else:
        is_prefered = [
            prefered_direction == Direction.START_TO_STOP,
            prefered_direction == Direction.STOP_TO_START,
        ]
        is_reverse = [not pref for pref in is_prefered]

    n_detectors = ((max_offset - min_offset) // period) - 1
    detector_step = (max_offset - min_offset) / (n_detectors + 1)
    for i in range(1, n_detectors + 1):
        track_section.add_detector(
            label=f"D{label_suffix}_{i}",
            position=min_offset + i * detector_step,
        )

        for d, direction in enumerate(Direction):
            if not is_prefered[d] and i % 3 != 2:
                continue
            signal = track_section.add_signal(
                label=f"S{label_suffix}_{i}" + "r" * is_reverse[d],
                is_route_delimiter=False,
                direction=direction,
                position=min_offset + i * detector_step - 20 + 40 * d,
                installation_type="S",
            )
            signal.add_logical_signal("BAL", settings={"Nf": "false"})


def add_signal_on_ports(switch, ports: Mapping[str, Tuple[str, str]]):
    """Add signals and detectors to given ports.
    Args:
        ports: A dictionary of port names to (detector_label, signal_label) pairs.
    """
    # Reference distances, in meters
    SIGNAL_TO_SWITCH = 200
    DETECTOR_TO_SWITCH = 180

    for port, (det_label, sig_label) in ports.items():
        switch.add_detector_on_port(port, DETECTOR_TO_SWITCH, label=det_label)
        signal = switch.add_signal_on_port(port, SIGNAL_TO_SWITCH, label=sig_label, is_route_delimiter=True)
        signal.add_logical_signal(signaling_system="BAL", settings={"Nf": "true"})


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

# Track and line names
V1 = {"track_name": "V1", "track_number": 1}
V2 = {"track_name": "V2", "track_number": 2}

south_west_parking = {"line_name": "South_West_Parking", "line_code": 414141}
west_parking = {"line_name": "West_parking", "line_code": 424242}
west_to_east_road = {"line_name": "West_to_East_road", "line_code": 434343}
north_to_south_loop = {"line_name": "North_to_South_loop", "line_code": 444444}
north_east_road = {"line_name": "North_East_road", "line_code": 454545}
north_east_parking = {"line_name": "North_East_parking", "line_code": 464646}
south_east_parking = {"line_name": "South_East_parking", "line_code": 474647}


builder = InfraBuilder()

# ================================
#  Around station A: West
# ================================

# track sections
ta0 = builder.add_track_section(length=2000, label="TA0", **V1, **west_parking)
ta1 = builder.add_track_section(length=1950, label="TA1", **V2, **west_parking)
ta2 = builder.add_track_section(length=1950, label="TA2", track_name="A", track_number=3, **west_parking)
ta3 = builder.add_track_section(length=50, label="TA3", track_name="J1", track_number=4, **west_parking)
ta4 = builder.add_track_section(length=50, label="TA4", **V2, **west_parking)
ta5 = builder.add_track_section(length=50, label="TA5", track_name="J2", track_number=3, **west_parking)
ta6 = builder.add_track_section(length=10000, label="TA6", **V1, **west_to_east_road)
ta7 = builder.add_track_section(length=10000, label="TA7", **V2, **west_to_east_road)

# I create this track section here to be able to add points using it
tb0 = builder.add_track_section(length=3000, label="TB0", track_name="A", track_number=1, **south_west_parking)

# switches
pa0 = builder.add_point_switch(
    label="PA0",
    base=ta1.end(),
    left=ta3.begin(),
    right=ta4.begin(),
)
add_signal_on_ports(pa0, {"A": ("DA0", "SA0")})
pa0.set_coords(-0.37, LAT_1)
pa1 = builder.add_point_switch(
    label="PA1",
    base=ta5.begin(),
    left=tb0.end(),
    right=ta2.end(),
)
add_signal_on_ports(pa1, {"B1": ("DB0", "SB0"), "B2": ("DA1", "SA1")})
pa1.set_coords(-0.37, LAT_1 - LAT_LINE_SPACE)
pa2 = builder.add_point_switch(
    label="PA2",
    base=ta6.begin(),
    left=ta3.end(),
    right=ta0.end(),
)
add_signal_on_ports(pa2, {"A": ("DA3", "SA3"), "B2": ("DA2", "SA2")})
pa2.set_coords(-0.365, LAT_0)
pa3 = builder.add_point_switch(
    label="PA3",
    base=ta7.begin(),
    left=ta5.end(),
    right=ta4.end(),
)
add_signal_on_ports(pa3, {"A": ("DA4", "SA4")})
pa3.set_coords(-0.365, LAT_1)

ta0.set_remaining_coords([(-0.4, LAT_0)])
ta1.set_remaining_coords([(-0.4, LAT_1)])
ta2.set_remaining_coords([(-0.4, LAT_2)])

# Extra detectors, which are not associated to signals

da7 = ta3.add_detector(label="DA7", position=ta3.length / 2)
da8 = ta4.add_detector(label="DA8", position=ta4.length / 2)
da9 = ta5.add_detector(label="DA9", position=ta5.length / 2)

# Extra signals
place_regular_signals_detectors(ta6, "A6", Direction.START_TO_STOP, 200, -200)
place_regular_signals_detectors(ta7, "A7", Direction.STOP_TO_START, 200, -200)

# Station
west = builder.add_operational_point(label="West_station", trigram="WS", uic=2)
west.add_part(ta0, 700)
west.add_part(ta1, 500)
west.add_part(ta2, 500)

# Slopes
ta6.add_slope(begin=4000, end=4300, slope=-3)
ta6.add_slope(begin=4300, end=4700, slope=-6)
ta6.add_slope(begin=4700, end=5000, slope=-3)
ta7.add_slope(begin=4000, end=4300, slope=-3)
ta7.add_slope(begin=4300, end=4700, slope=-6)
ta7.add_slope(begin=4700, end=5000, slope=-3)


ta6.add_slope(begin=7000, end=7300, slope=3)
ta6.add_slope(begin=7300, end=7700, slope=6)
ta6.add_slope(begin=7700, end=8000, slope=3)
ta7.add_slope(begin=7000, end=7300, slope=3)
ta7.add_slope(begin=7300, end=7700, slope=6)
ta7.add_slope(begin=7700, end=8000, slope=3)

# Loading Gauge Limits
ta0.add_loading_gauge_limit(begin=0, end=200, category=LoadingGaugeType.GB1)
ta0.add_loading_gauge_limit(begin=200, end=1900, category=LoadingGaugeType.G1)
ta0.add_loading_gauge_limit(begin=100, end=1500, category=LoadingGaugeType.FR3_3)

# ================================
#  Around station B: South-West
# ================================

tb0.set_remaining_coords([(-0.4, 49.49), (-0.373, 49.49), (-0.37, 49.492)])

south_west = builder.add_operational_point(label="South_West_station", trigram="SWS", uic=1)
south_west.add_part(tb0, 500)

# ================================
#  Around station C: Mid - West
# ================================
# track sections
tc0 = builder.add_track_section(length=1050, label="TC0", track_name="V1bis", track_number=3, **west_to_east_road)
tc1 = builder.add_track_section(length=1000, label="TC1", **V1, **west_to_east_road)
tc2 = builder.add_track_section(length=1000, label="TC2", **V2, **west_to_east_road)
tc3 = builder.add_track_section(length=1050, label="TC3", track_name="V2bis", track_number=4, **west_to_east_road)

# I have to create them here in order to create switches
td0 = builder.add_track_section(length=25000, label="TD0", **V1, **west_to_east_road)
td1 = builder.add_track_section(length=25000, label="TD1", **V2, **west_to_east_road)

# Switches
pc0 = builder.add_point_switch(
    label="PC0",
    base=ta6.end(),
    left=tc0.begin(),
    right=tc1.begin(),
)
add_signal_on_ports(
    pc0,
    {
        "A": ("DA5", "SA5"),
        "B1": ("DC0", "SC0"),
        "B2": ("DC1", "SC1"),
    },
)

pc0.set_coords(-0.31, LAT_0)
pc1 = builder.add_point_switch(
    label="PC1",
    base=ta7.end(),
    left=tc2.begin(),
    right=tc3.begin(),
)
add_signal_on_ports(
    pc1,
    {
        "A": ("DA6", "SA6"),
        "B1": ("DC2", "SC2"),
        "B2": ("DC3", "SC3"),
    },
)

pc1.set_coords(-0.31, LAT_1)
pc2 = builder.add_point_switch(
    label="PC2",
    base=td0.begin(),
    left=tc1.end(),
    right=tc0.end(),
)
add_signal_on_ports(
    pc2,
    {
        "A": ("DD0", "SD0"),
        "B1": ("DC5", "SC5"),
        "B2": ("DC4", "SC4"),
    },
)
pc2.set_coords(-0.296, LAT_0)
pc3 = builder.add_point_switch(
    label="PC3",
    base=td1.begin(),
    left=tc3.end(),
    right=tc2.end(),
)
add_signal_on_ports(
    pc3,
    {
        "A": ("DD1", "SD1"),
        "B1": ("DC7", "SC7"),
        "B2": ("DC6", "SC6"),
    },
)
pc3.set_coords(-0.296, LAT_1)


tc0.set_remaining_coords([(-0.309, LAT_0 + LAT_LINE_SPACE), (-0.297, LAT_0 + LAT_LINE_SPACE)])
tc3.set_remaining_coords([(-0.309, LAT_1 - LAT_LINE_SPACE), (-0.297, LAT_1 - LAT_LINE_SPACE)])

# Station
mid_west = builder.add_operational_point(label="Mid_West_station", trigram="MWS", uic=3)
mid_west.add_part(tc0, 550)
mid_west.add_part(tc1, 550)
mid_west.add_part(tc2, 450)
mid_west.add_part(tc3, 450)

# ================================
#  Around station D: Mid-East
# ================================
# track sections
td2 = builder.add_track_section(length=2000, label="TD2", **V1, **west_to_east_road)
td3 = builder.add_track_section(length=3000, label="TD3", **V2, **west_to_east_road)

te0 = builder.add_track_section(length=1500, label="TE0", **V1, **north_to_south_loop)
tf0 = builder.add_track_section(length=3, label="TF0", **V1, **north_to_south_loop)
tf1 = builder.add_track_section(length=6500, label="TF1", **V1, **north_to_south_loop)

# switches
pd0 = builder.add_crossing(
    label="PD0",
    north=te0.end(),
    south=tf0.begin(),
    east=td2.begin(),
    west=td0.end(),
)
add_signal_on_ports(
    pd0,
    {
        "A1": ("DE0", "SE0"),
        "B2": ("DD4", "SD4"),
        "A2": ("DD2", "SD2"),
    },
)
pd0.set_coords(-0.172, LAT_0)
pd1 = builder.add_crossing(
    label="PD1",
    north=tf0.end(),
    south=tf1.begin(),
    east=td3.begin(),
    west=td1.end(),
)
add_signal_on_ports(
    pd1,
    {
        "B2": ("DF0", "SF0"),
        "B1": ("DD5", "SD5"),
        "A2": ("DD3", "SD3"),
    },
)
pd1.set_coords(-0.172, LAT_1)

place_regular_signals_detectors(td0, "D0", Direction.START_TO_STOP, 200, -200)
place_regular_signals_detectors(td1, "D1", Direction.STOP_TO_START, 200, -200)

# Station
mid_east = builder.add_operational_point(label="Mid_East_station", trigram="MES", uic=4)
mid_east.add_part(td0, 14000)
mid_east.add_part(td1, 14000)

# Slopes
td0.add_slope(begin=6000, end=7000, slope=3)
td0.add_slope(begin=7000, end=8000, slope=6)
td0.add_slope(begin=8000, end=9000, slope=3)
td1.add_slope(begin=6000, end=7000, slope=3)
td1.add_slope(begin=7000, end=8000, slope=6)
td1.add_slope(begin=8000, end=9000, slope=3)

td0.add_slope(begin=14000, end=15000, slope=-3)
td0.add_slope(begin=15000, end=16000, slope=-6)
td0.add_slope(begin=16000, end=17000, slope=-3)
td1.add_slope(begin=14000, end=15000, slope=-3)
td1.add_slope(begin=15000, end=16000, slope=-6)
td1.add_slope(begin=16000, end=17000, slope=-3)

# ================================
#  Around station E: North
# ================================
# track sections
te1 = builder.add_track_section(length=2000, label="TE1", track_name="V1bis", track_number=2, **north_to_south_loop)
te2 = builder.add_track_section(length=2050, label="TE2", **V1, **north_to_south_loop)
te3 = builder.add_track_section(length=2000, label="TE3", **V1, **north_to_south_loop)

tg0 = builder.add_track_section(length=1000, label="TG0", **V1, **west_to_east_road)

# switches
pe0 = builder.add_point_switch(
    label="PE0",
    base=te0.begin(),
    left=te1.end(),
    right=te2.end(),
)
add_signal_on_ports(
    pe0,
    {
        "A": ("DE1", "SE1"),
        "B1": ("DE2", "SE2"),
        "B2": ("DE3", "SE3"),
    },
)
pe0.set_coords(-0.165, LAT_3)
pe1 = builder.add_point_switch(
    label="PE1",
    base=te3.end(),
    left=te2.begin(),
    right=te1.begin(),
)
add_signal_on_ports(
    pe1,
    {
        "A": ("DE6", "SE6"),
        "B1": ("DE5", "SE5"),
        "B2": ("DE4", "SE4"),
    },
)
pe1.set_coords(-0.15, LAT_3)
pe2 = builder.add_point_switch(
    label="PE2",
    base=td2.end(),
    left=te3.begin(),
    right=tg0.begin(),
)
add_signal_on_ports(
    pe2,
    {
        "A": ("DD6", "SD6"),
        "B1": ("DE7", "SE7"),
        "B2": ("DD7", "SD7"),
    },
)
pe2.set_coords(-0.15, LAT_0)

te0.set_remaining_coords([(-0.172, LAT_3 - 0.002)])
te1.set_remaining_coords(
    [
        (-0.151, LAT_3 + LAT_LINE_SPACE),
        (-0.164, LAT_3 + LAT_LINE_SPACE),
    ]
)
te3.set_remaining_coords([(-0.145, LAT_0 + 0.002), (-0.145, LAT_3 - 0.002)])

# Station
north = builder.add_operational_point(label="North_station", trigram="NS", uic=5)
north.add_part(te1, 1000)
north.add_part(te2, 1025)

# Curves
te3.add_curve(begin=0, end=300, curve=5000)
te3.add_curve(begin=650, end=850, curve=9000)
te3.add_curve(begin=te3.length - 850, end=te3.length - 650, curve=8000)
te3.add_curve(begin=te3.length - 300, end=te3.length, curve=7000)

te1.add_curve(begin=0, end=300, curve=5000)
te1.add_curve(begin=te1.length - 300, end=te1.length, curve=6000)

te0.add_curve(begin=0, end=300, curve=6000)
te0.add_curve(begin=500, end=1000, curve=8000)

# ================================
#  Around station F: South
# ================================

tf1.set_remaining_coords([(-0.172, 49.47), (-0.167, 49.466), (-0.135, 49.466)])

south = builder.add_operational_point(label="South_station", trigram="SS", uic=6)
south.add_part(tf1, 4300)

place_regular_signals_detectors(tf1, "F1", min_offset=200, max_offset=4300)

# Curves
tf1.add_curve(begin=3100, end=4400, curve=9500)

# ================================
#  Around station G: North-East
# ================================
# track sections
tg1 = builder.add_track_section(length=4000, label="TG1", **V1, **north_east_road)
tg2 = builder.add_track_section(length=3000, label="TG2", **V2, **north_east_road)
tg3 = builder.add_track_section(length=50, label="TG3", track_name="J4", track_number=3, **north_east_parking)
tg4 = builder.add_track_section(length=2000, label="TG4", **V1, **north_east_parking)
tg5 = builder.add_track_section(length=2000, label="TG5", **V2, **north_east_parking)

pg0 = builder.add_point_switch(
    label="PG0",
    base=tg1.end(),
    left=tg4.begin(),
    right=tg3.begin(),
)
add_signal_on_ports(pg0, {"A": ("DG3", "SG3"), "B1": ("DG5", "SG5")})
pg0.set_coords(-0.1082, LAT_4)
pg1 = builder.add_point_switch(
    label="PG1",
    base=tg5.begin(),
    left=tg2.end(),
    right=tg3.end(),
)
add_signal_on_ports(pg1, {"A": ("DG6", "SG6"), "B1": ("DG4", "SG4")})
pg1.set_coords(-0.108, LAT_4 - LAT_LINE_SPACE)

tg4.set_remaining_coords([(-0.09, LAT_4)])
tg5.set_remaining_coords([(-0.09, LAT_4 - LAT_LINE_SPACE)])

dg6 = tg3.add_detector(label="DG7", position=tg3.length / 2)

north_east = builder.add_operational_point(label="North_East_station", trigram="NES", uic=7)
north_east.add_part(tg4, 1550)
north_east.add_part(tg5, 1500)

place_regular_signals_detectors(tg1, "G1", min_offset=200, max_offset=-200)

# ================================
#  Around station H: South-East
# ================================
# track sections
th0 = builder.add_track_section(length=1000, label="TH0", **V2, **west_to_east_road)
th1 = builder.add_track_section(length=5000, label="TH1", **V1, **south_east_parking)

place_regular_signals_detectors(th1, "H1", min_offset=200)

# switches
ph0 = builder.add_double_slip_switch(
    label="PH0",
    north_1=tg1.begin(),
    north_2=th0.begin(),
    south_1=tg0.end(),
    south_2=td3.end(),
)
add_signal_on_ports(
    ph0,
    {
        "A1": ("DG1", "SG1"),
        "A2": ("DH1", "SH1"),
        "B1": ("DG0", "SG0"),
        "B2": ("DH0", "SH0"),
    },
)
ph0.set_coords(-0.135, LAT_0 - LAT_LINE_SPACE / 2)
ph1 = builder.add_point_switch(
    label="PH1",
    base=th0.end(),
    left=tg2.begin(),
    right=th1.begin(),
)
add_signal_on_ports(
    ph1,
    {
        "A": ("DH2", "SH2"),
        "B1": ("DG2", "SG2"),
        "B2": ("DH3", "SH3"),
    },
)
ph1.set_coords(-0.12, LAT_1)

td3.set_remaining_coords([(-0.1354, LAT_1)])
tg0.set_remaining_coords([(-0.1354, LAT_0)])
tg1.set_remaining_coords(
    [
        (-0.1346, LAT_0),
        (-0.12, LAT_0),
        (-0.115, 49.503),
        (-0.115, 49.51),
        (-0.11, LAT_4),
    ]
)
tg2.set_remaining_coords(
    [
        (-0.1199, LAT_1),
        (-0.1149, 49.50296),
        (-0.1149, 49.50997),
        (-0.1099, LAT_4 - LAT_LINE_SPACE),
    ]
)
th0.set_remaining_coords([(-0.1346, LAT_1)])
th1.set_remaining_coords([(-0.115, 49.497), (-0.115, 49.487), (-0.11, 49.484), (-0.09, 49.484)])

# Station
south_east = builder.add_operational_point(label="South_East_station", trigram="SES", uic=8)
south_east.add_part(th1, 4400)

# ================================
#  Speed sections
# ================================
speed_0 = builder.add_speed_section(300 / 3.6, speed_limit_by_tag={"HLP": 250 / 3.6})
for track_section in builder.infra.track_sections:
    speed_0.add_track_range(track_section, 0, track_section.length, ApplicableDirection.BOTH)


speed_1 = builder.add_speed_section(142 / 3.6, speed_limit_by_tag={"E32C": 100 / 3.6})
speed_1.add_track_range(th0, 500, 1000, ApplicableDirection.BOTH)
speed_1.add_track_range(th1, 0, 4000, ApplicableDirection.BOTH)

speed_2 = builder.add_speed_section(112 / 3.6, speed_limit_by_tag={"MA100": 80 / 3.6})
speed_2.add_track_range(th1, 3500, 4400, ApplicableDirection.BOTH)

# ================================
#  Electrifications
# ================================
electrified_tracks_25000 = [t for t in builder.infra.track_sections if t not in {td1, ta0}]
builder.infra.electrifications.append(Electrification("electrification_25k", "25000V", electrified_tracks_25000))
builder.infra.electrifications.append(Electrification("electrification_1.5k", "1500V", [ta0]))

# ================================
#  Neutral sections
# ================================
lower_pantograph_section_1 = builder.add_neutral_section(lower_pantograph=True)
lower_pantograph_section_1.add_announcement_track_range(tg1, 3500, tg1.length, Direction.START_TO_STOP)
lower_pantograph_section_1.add_track_range(tg4, 0, 500, Direction.START_TO_STOP)
lower_pantograph_section_1.add_track_range(ta6, 0, 10, Direction.START_TO_STOP)

lower_pantograph_section_2 = builder.add_neutral_section(lower_pantograph=True)
lower_pantograph_section_2.add_announcement_track_range(ta0, 1850, 1960, Direction.START_TO_STOP)
lower_pantograph_section_2.add_track_range(ta0, 1960, 2000, Direction.START_TO_STOP)

keep_pantograph_section_3 = builder.add_neutral_section(lower_pantograph=False)
keep_pantograph_section_3.add_track_range(ta6, 8500, 8600, Direction.START_TO_STOP)

keep_pantograph_section_4 = builder.add_neutral_section(lower_pantograph=False)
keep_pantograph_section_4.add_announcement_track_range(ta0, 1990, 2000, Direction.STOP_TO_START)
keep_pantograph_section_4.add_track_range(ta0, 1850, 1990, Direction.STOP_TO_START)


# ================================
# Produce the railjson
# ================================

# Build infra
infra = builder.build(progressive_release=False)

# Save railjson
infra.save(OUTPUT_DIR / "infra.json")


# ================================
# Electrical profiles
# ================================

external_inputs = ExternalGeneratedInputs()

ep_boundaries = {
    "1": [(0, 10)],
    "2": [(0, 4), (4, 6), (6, 10)],
    "3": [(0, 3), (3, 7), (7, 10)],
    "4": [(0, 2), (2, 4), (4, 6), (6, 8), (8, 10)],
    "5": [(0, 1), (1, 3), (3, 7), (7, 9), (9, 10)],
}
EP_VALUES = ["25000V", "22500V", "20000V"]

for power_class, boundaries in ep_boundaries.items():
    for i, (start, end) in enumerate(boundaries):
        ep = external_inputs.add_electrical_profile(
            value=EP_VALUES[min(i, len(boundaries) - i - 1)], power_class=power_class
        )
        ep.add_track_range(ta6, start * 1000, end * 1000)

ep_o = external_inputs.add_electrical_profile(value="O", power_class="5")
ep_o.add_track_range(ta0, 0, ta0.length)
# We voluntarily leave ta0 empty for other power classes

other_eps = [external_inputs.add_electrical_profile(value="25000V", power_class=str(i)) for i in range(1, 6)]
for track_section in electrified_tracks_25000:
    if track_section is ta6:
        continue
    for ep in other_eps:
        ep.add_track_range(track_section, 0, track_section.length)


external_inputs.save(OUTPUT_DIR / "external_generated_inputs.json")
