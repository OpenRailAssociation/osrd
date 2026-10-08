#!/usr/bin/env python3

"""
This script generates an infrastructure of reasonable size containing all objects defined by the RailJSON schema.
For more information, and a diagram of this infrastructure, see:
https://osrd.fr/en/docs/explanation/models/data-models-full-example/

The layout is built by `SmallInfraCreator`, which can be subclassed to derive
variants of this infrastructure (see `medium_infra.py`).

Object identifiers (tracks, neutral sections, …) are attributed in creation order:
overriding methods must keep that order to produce stable infrastructures.
"""

from collections.abc import Iterable, Mapping
from enum import Enum
from typing import ClassVar, NamedTuple

from osrd_schemas.infra import LoadingGaugeType
from railjson_generator import (
    ApplicableDirection,
    ExternalGeneratedInputs,
    InfraBuilder,
)
from railjson_generator.schema.infra.direction import Direction
from railjson_generator.schema.infra.electrification import Electrification
from railjson_generator.schema.infra.infra import Infra
from railjson_generator.schema.infra.operational_point import OperationalPoint
from railjson_generator.schema.infra.switch import Switch
from railjson_generator.schema.infra.track_section import TrackSection


def place_regular_signals_detectors(
    track_section: TrackSection,
    label_suffix: str,
    signaling_system: str,
    prefered_direction: Direction | None = None,
    min_offset: float = 0,
    max_offset: float | None = None,
    period: float = 1500,
):
    """Place signals and detectors regularly on the track section.
    In the prefered direction, every <period> meters,
    in the opposite direction, every 3 *<period> meters."""
    if max_offset is None:
        max_offset = float(track_section.length)
    elif max_offset < 0:
        max_offset = float(track_section.length) + max_offset
    assert isinstance(max_offset, float)

    if prefered_direction is None:
        is_prefered = [True, True]
        is_reverse = [False, True]
    else:
        is_prefered = [
            prefered_direction == Direction.START_TO_STOP,
            prefered_direction == Direction.STOP_TO_START,
        ]
        is_reverse = [not pref for pref in is_prefered]

    n_detectors = int((max_offset - min_offset) // period) - 1
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
            signal.add_logical_signal(signaling_system, settings={"Nf": "false"})


def add_signal_on_ports(
    switch: Switch, ports: Mapping[str, tuple[str, str]], signaling_system: str
):
    """Add signals and detectors to given ports.
    Args:
        ports: A dictionary of port names to (detector_label, signal_label) pairs.
    """
    # Reference distances, in meters
    SIGNAL_TO_SWITCH = 200
    DETECTOR_TO_SWITCH = 180

    for port, (det_label, sig_label) in ports.items():
        switch.add_detector_on_port(port, DETECTOR_TO_SWITCH, label=det_label)
        signal = switch.add_signal_on_port(
            port, SIGNAL_TO_SWITCH, label=sig_label, is_route_delimiter=True
        )
        signal.add_logical_signal(
            signaling_system=signaling_system, settings={"Nf": "true"}
        )


class ScenarioData(NamedTuple):
    infra: Infra
    external_inputs: ExternalGeneratedInputs = ExternalGeneratedInputs()


class Line(NamedTuple):
    name: str
    code: int


class TrackId(NamedTuple):
    """Name and number of a track within its line."""

    name: str
    number: int


class LocalTrackNaming(Enum):
    """How operational point parts name the track they lie on."""

    SEQUENTIAL = "sequential"
    """V1, V2, … in the order the parts are given."""
    TRACK_NAME = "track_name"
    """The name of the track section the part lies on."""


# Reference latitudes
LAT_LINE_SPACE = 0.0001
# The three lines of the west station
LAT_0 = 49.5
LAT_1 = LAT_0 - LAT_LINE_SPACE
LAT_2 = LAT_1 - LAT_LINE_SPACE
# The line of the north station
LAT_3 = 49.51
# The lines of the north-east station
LAT_4 = 49.513

# Tracks and lines
V1 = TrackId("V1", 1)
V2 = TrackId("V2", 2)
SOUTH_WEST_PARKING = Line("South_West_Parking", 414141)
WEST_PARKING = Line("West_parking", 424242)
WEST_TO_EAST_ROAD = Line("West_to_East_road", 434343)
NORTH_TO_SOUTH_LOOP = Line("North_to_South_loop", 444444)
NORTH_EAST_ROAD = Line("North_East_road", 454545)
NORTH_EAST_PARKING = Line("North_East_parking", 464646)
SOUTH_EAST_PARKING = Line("South_East_parking", 474647)


class SmallInfraCreator:
    """Builds small_infra.

    Each station area is built by its own method, in a fixed order.
    Subclasses derive variants by tuning the class attributes below and by
    extending the build steps (calling `super()` to keep the creation order).
    An instance builds a single infrastructure.
    """

    TA0_LENGTH: ClassVar[float] = 2000
    """Length of West station's V1, from its buffer stop to the next switch."""
    PA2_SIGNALS: ClassVar[Mapping[str, tuple[str, str]]] = {
        "A": ("DA3", "SA3"),
        "B2": ("DA2", "SA2"),
    }
    LOCAL_TRACK_NAMING: ClassVar[LocalTrackNaming] = LocalTrackNaming.SEQUENTIAL
    STATION_WEIGHTS: ClassVar[Mapping[str, int]] = {}
    """Operational point weights, by main code."""

    def __init__(self, signaling_system: str) -> None:
        self.signaling_system = signaling_system
        self.builder = InfraBuilder()
        self.tracks: dict[str, TrackSection] = {}

    def create(self) -> ScenarioData:
        self._build_west_area()
        self._build_south_west_area()
        self._build_mid_west_area()
        self._build_mid_east_area()
        self._build_north_area()
        self._build_south_area()
        self._build_north_east_area()
        self._build_south_east_area()
        self._add_speed_sections()
        self._add_electrifications()
        self._add_neutral_sections()
        self._add_level_crossings()
        infra = self.builder.build(progressive_release=False)
        return ScenarioData(
            infra=infra, external_inputs=self._create_electrical_profiles()
        )

    # ================================
    #  Helpers
    # ================================

    def _add_track(
        self, label: str, length: float, line: Line, track: TrackId
    ) -> TrackSection:
        track_section = self.builder.add_track_section(
            label=label,
            length=length,
            track_name=track.name,
            track_number=track.number,
            line_name=line.name,
            line_code=line.code,
        )
        self.tracks[label] = track_section
        return track_section

    def _add_switch_signals(
        self, switch: Switch, ports: Mapping[str, tuple[str, str]]
    ) -> None:
        add_signal_on_ports(switch, ports, self.signaling_system)

    def _place_regular_signals(
        self,
        track_section: TrackSection,
        label_suffix: str,
        prefered_direction: Direction | None = None,
        min_offset: float = 0,
        max_offset: float | None = None,
    ) -> None:
        place_regular_signals_detectors(
            track_section,
            label_suffix,
            self.signaling_system,
            prefered_direction,
            min_offset,
            max_offset,
        )

    def _add_station(
        self,
        label: str,
        main_code: str,
        parts: Iterable[tuple[TrackSection, float]],
        **kwargs,
    ) -> OperationalPoint:
        """Add an operational point with one part per (track, offset) pair."""
        operational_point = self.builder.add_operational_point(
            label=label,
            main_code=main_code,
            weight=self.STATION_WEIGHTS.get(main_code),
            **kwargs,
        )
        for index, (track_section, offset) in enumerate(parts, start=1):
            operational_point.add_part(
                track_section, offset, self._local_track_name(track_section, index)
            )
        return operational_point

    def _local_track_name(self, track_section: TrackSection, index: int) -> str:
        match self.LOCAL_TRACK_NAMING:
            case LocalTrackNaming.SEQUENTIAL:
                return f"V{index}"
            case LocalTrackNaming.TRACK_NAME:
                return track_section.track_name

    def _west_v1_tracks(self) -> list[TrackSection]:
        """Tracks of West station's V1, from its buffer stop to the PA2 switch."""
        return [self.tracks["TA0"]]

    # ================================
    #  Around station A: West
    # ================================

    def _build_west_area(self) -> None:
        self._add_west_tracks()
        self._add_west_switches()
        ta0, ta1, ta2 = (self.tracks[label] for label in ("TA0", "TA1", "TA2"))
        ta0.set_remaining_coords([(-0.4, LAT_0)])
        ta1.set_remaining_coords([(-0.4, LAT_1)])
        ta2.set_remaining_coords([(-0.4, LAT_2)])
        self._add_west_detectors()
        self._place_regular_signals(
            self.tracks["TA6"], "A6", Direction.START_TO_STOP, 200.0, -200.0
        )
        self._place_regular_signals(
            self.tracks["TA7"], "A7", Direction.STOP_TO_START, 200.0, -200.0
        )
        self._add_west_stations()
        for label in ("TA6", "TA7"):
            track_section = self.tracks[label]
            track_section.add_slope(begin=4000, end=4300, slope=-3)
            track_section.add_slope(begin=4300, end=4700, slope=-6)
            track_section.add_slope(begin=4700, end=5000, slope=-3)
        for label in ("TA6", "TA7"):
            track_section = self.tracks[label]
            track_section.add_slope(begin=7000, end=7300, slope=3)
            track_section.add_slope(begin=7300, end=7700, slope=6)
            track_section.add_slope(begin=7700, end=8000, slope=3)
        self._add_west_loading_gauge_limits()

    def _add_west_tracks(self) -> None:
        self._add_track("TA0", self.TA0_LENGTH, WEST_PARKING, V1)
        self._add_track("TA1", 1950, WEST_PARKING, V2)
        self._add_track("TA2", 1950, WEST_PARKING, TrackId("A", 3))
        self._add_track("TA3", 50, WEST_PARKING, TrackId("J1", 4))
        self._add_track("TA4", 50, WEST_PARKING, V2)
        self._add_track("TA5", 50, WEST_PARKING, TrackId("J2", 3))
        self._add_track("TA6", 10000, WEST_TO_EAST_ROAD, V1)
        self._add_track("TA7", 10000, WEST_TO_EAST_ROAD, V2)
        # Created here so that west switches can connect to it
        self._add_track("TB0", 3000, SOUTH_WEST_PARKING, TrackId("A", 1))

    def _add_west_switches(self) -> None:
        t = self.tracks
        pa0 = self.builder.add_point_switch(
            label="PA0",
            base=t["TA1"].end(),
            left=t["TA3"].begin(),
            right=t["TA4"].begin(),
        )
        self._add_switch_signals(pa0, {"A": ("DA0", "SA0")})
        pa0.set_coords(-0.37, LAT_1)
        pa1 = self.builder.add_point_switch(
            label="PA1",
            base=t["TA5"].begin(),
            left=t["TB0"].end(),
            right=t["TA2"].end(),
        )
        self._add_switch_signals(pa1, {"B1": ("DB0", "SB0"), "B2": ("DA1", "SA1")})
        pa1.set_coords(-0.37, LAT_1 - LAT_LINE_SPACE)
        pa2 = self.builder.add_point_switch(
            label="PA2",
            base=t["TA6"].begin(),
            left=t["TA3"].end(),
            right=self._west_v1_tracks()[-1].end(),
        )
        self._add_switch_signals(pa2, self.PA2_SIGNALS)
        pa2.set_coords(-0.365, LAT_0)
        pa3 = self.builder.add_point_switch(
            label="PA3",
            base=t["TA7"].begin(),
            left=t["TA5"].end(),
            right=t["TA4"].end(),
        )
        self._add_switch_signals(pa3, {"A": ("DA4", "SA4")})
        pa3.set_coords(-0.365, LAT_1)

    def _add_west_detectors(self) -> None:
        """Add detectors which are not associated to signals."""
        for detector_label, track_label in (
            ("DA7", "TA3"),
            ("DA8", "TA4"),
            ("DA9", "TA5"),
        ):
            track_section = self.tracks[track_label]
            track_section.add_detector(
                label=detector_label, position=track_section.length / 2
            )

    def _add_west_stations(self) -> None:
        t = self.tracks
        self._add_station(
            "West_station",
            "WS",
            # 699.99959 is to be rounded to 700
            [(t["TA0"], 699.99959), (t["TA1"], 500), (t["TA2"], 500)],
            uic=8722,
        )

    def _add_west_loading_gauge_limits(self) -> None:
        ta0 = self.tracks["TA0"]
        ta0.add_loading_gauge_limit(begin=0, end=200, category=LoadingGaugeType.GB1)
        ta0.add_loading_gauge_limit(begin=200, end=1900, category=LoadingGaugeType.G1)
        ta0.add_loading_gauge_limit(
            begin=100, end=1500, category=LoadingGaugeType.FR3_3
        )

    # ================================
    #  Around station B: South-West
    # ================================

    def _build_south_west_area(self) -> None:
        tb0 = self.tracks["TB0"]
        tb0.set_remaining_coords([(-0.4, 49.49), (-0.373, 49.49), (-0.37, 49.492)])
        self._add_station("South_West_station", "SWS", [(tb0, 500)], uic=8711)

    # ================================
    #  Around station C: Mid - West
    # ================================

    def _build_mid_west_area(self) -> None:
        t = self.tracks
        tc0 = self._add_track("TC0", 1050, WEST_TO_EAST_ROAD, TrackId("V1bis", 3))
        tc1 = self._add_track("TC1", 1000, WEST_TO_EAST_ROAD, V1)
        tc2 = self._add_track("TC2", 1000, WEST_TO_EAST_ROAD, V2)
        tc3 = self._add_track("TC3", 1050, WEST_TO_EAST_ROAD, TrackId("V2bis", 4))
        # Created here so that mid-west switches can connect to them
        td0 = self._add_track("TD0", 25000, WEST_TO_EAST_ROAD, V1)
        td1 = self._add_track("TD1", 25000, WEST_TO_EAST_ROAD, V2)
        # Switches
        pc0 = self.builder.add_point_switch(
            label="PC0", base=t["TA6"].end(), left=tc0.begin(), right=tc1.begin()
        )
        self._add_switch_signals(
            pc0, {"A": ("DA5", "SA5"), "B1": ("DC0", "SC0"), "B2": ("DC1", "SC1")}
        )
        pc0.set_coords(-0.31, LAT_0)
        pc1 = self.builder.add_point_switch(
            label="PC1", base=t["TA7"].end(), left=tc2.begin(), right=tc3.begin()
        )
        self._add_switch_signals(
            pc1, {"A": ("DA6", "SA6"), "B1": ("DC2", "SC2"), "B2": ("DC3", "SC3")}
        )
        pc1.set_coords(-0.31, LAT_1)
        pc2 = self.builder.add_point_switch(
            label="PC2", base=td0.begin(), left=tc1.end(), right=tc0.end()
        )
        self._add_switch_signals(
            pc2, {"A": ("DD0", "SD0"), "B1": ("DC5", "SC5"), "B2": ("DC4", "SC4")}
        )
        pc2.set_coords(-0.296, LAT_0)
        pc3 = self.builder.add_point_switch(
            label="PC3", base=td1.begin(), left=tc3.end(), right=tc2.end()
        )
        self._add_switch_signals(
            pc3, {"A": ("DD1", "SD1"), "B1": ("DC7", "SC7"), "B2": ("DC6", "SC6")}
        )
        pc3.set_coords(-0.296, LAT_1)
        tc0.set_remaining_coords(
            [(-0.309, LAT_0 + LAT_LINE_SPACE), (-0.297, LAT_0 + LAT_LINE_SPACE)]
        )
        tc3.set_remaining_coords(
            [(-0.309, LAT_1 - LAT_LINE_SPACE), (-0.297, LAT_1 - LAT_LINE_SPACE)]
        )
        self._add_mid_west_stations()

    def _mid_west_station_parts(self) -> list[tuple[TrackSection, float]]:
        t = self.tracks
        return [(t["TC0"], 550), (t["TC1"], 550), (t["TC2"], 450), (t["TC3"], 450)]

    def _add_mid_west_stations(self) -> None:
        parts = self._mid_west_station_parts()
        self._add_station("Mid_West_station", "MWS", parts, uic=8733)
        # Duplicate station (to test for duplicate OPs)
        mid_west_duplicate = self.builder.add_operational_point(
            label="Mid_West_station_duplicate",
            main_code="MWS",
            uic=87332,
            secondary_code="BV2",
            secondary_name="Duplicate station",
        )
        for index, (track_section, offset) in enumerate(parts, start=1):
            mid_west_duplicate.add_part(track_section, offset, f"V{index}'")

    # ================================
    #  Around station D: Mid-East
    # ================================

    def _build_mid_east_area(self) -> None:
        t = self.tracks
        td0, td1 = t["TD0"], t["TD1"]
        td2 = self._add_track("TD2", 2000, WEST_TO_EAST_ROAD, V1)
        td3 = self._add_track("TD3", 3000, WEST_TO_EAST_ROAD, V2)
        te0 = self._add_track("TE0", 1500, NORTH_TO_SOUTH_LOOP, V1)
        tf0 = self._add_track("TF0", 3, NORTH_TO_SOUTH_LOOP, V1)
        tf1 = self._add_track("TF1", 6500, NORTH_TO_SOUTH_LOOP, V1)
        # Crossings
        pd0 = self.builder.add_crossing(
            label="PD0",
            north=te0.end(),
            south=tf0.begin(),
            east=td2.begin(),
            west=td0.end(),
        )
        self._add_switch_signals(
            pd0, {"A1": ("DE0", "SE0"), "B2": ("DD4", "SD4"), "A2": ("DD2", "SD2")}
        )
        pd0.set_coords(-0.172, LAT_0)
        pd1 = self.builder.add_crossing(
            label="PD1",
            north=tf0.end(),
            south=tf1.begin(),
            east=td3.begin(),
            west=td1.end(),
        )
        self._add_switch_signals(
            pd1, {"B2": ("DF0", "SF0"), "B1": ("DD5", "SD5"), "A2": ("DD3", "SD3")}
        )
        pd1.set_coords(-0.172, LAT_1)
        self._place_regular_signals(td0, "D0", Direction.START_TO_STOP, 200.0, -200.0)
        self._place_regular_signals(td1, "D1", Direction.STOP_TO_START, 200.0, -200.0)
        self._add_station(
            "Mid_East_station", "MES", [(td0, 14000), (td1, 14000)], uic=8744
        )
        # Slopes
        for track_section in (td0, td1):
            track_section.add_slope(begin=6000, end=7000, slope=3)
            track_section.add_slope(begin=7000, end=8000, slope=6)
            track_section.add_slope(begin=8000, end=9000, slope=3)
        for track_section in (td0, td1):
            track_section.add_slope(begin=14000, end=15000, slope=-3)
            track_section.add_slope(begin=15000, end=16000, slope=-6)
            track_section.add_slope(begin=16000, end=17000, slope=-3)

    # ================================
    #  Around station E: North
    # ================================

    def _build_north_area(self) -> None:
        t = self.tracks
        te0 = t["TE0"]
        te1 = self._add_track("TE1", 2000, NORTH_TO_SOUTH_LOOP, TrackId("V1bis", 2))
        te2 = self._add_track("TE2", 2050, NORTH_TO_SOUTH_LOOP, V1)
        te3 = self._add_track("TE3", 2000, NORTH_TO_SOUTH_LOOP, V1)
        tg0 = self._add_track("TG0", 1000, WEST_TO_EAST_ROAD, V1)
        # Switches
        pe0 = self.builder.add_point_switch(
            label="PE0", base=te0.begin(), left=te1.end(), right=te2.end()
        )
        self._add_switch_signals(
            pe0, {"A": ("DE1", "SE1"), "B1": ("DE2", "SE2"), "B2": ("DE3", "SE3")}
        )
        pe0.set_coords(-0.165, LAT_3)
        pe1 = self.builder.add_point_switch(
            label="PE1", base=te3.end(), left=te2.begin(), right=te1.begin()
        )
        self._add_switch_signals(
            pe1, {"A": ("DE6", "SE6"), "B1": ("DE5", "SE5"), "B2": ("DE4", "SE4")}
        )
        pe1.set_coords(-0.15, LAT_3)
        pe2 = self.builder.add_point_switch(
            label="PE2", base=t["TD2"].end(), left=te3.begin(), right=tg0.begin()
        )
        self._add_switch_signals(
            pe2, {"A": ("DD6", "SD6"), "B1": ("DE7", "SE7"), "B2": ("DD7", "SD7")}
        )
        pe2.set_coords(-0.15, LAT_0)
        te0.set_remaining_coords([(-0.172, LAT_3 - 0.002)])
        te1.set_remaining_coords(
            [(-0.151, LAT_3 + LAT_LINE_SPACE), (-0.164, LAT_3 + LAT_LINE_SPACE)]
        )
        te3.set_remaining_coords([(-0.145, LAT_0 + 0.002), (-0.145, LAT_3 - 0.002)])
        self._add_station("North_station", "NS", [(te1, 1000), (te2, 1025)], uic=8755)
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

    def _build_south_area(self) -> None:
        tf1 = self.tracks["TF1"]
        tf1.set_remaining_coords([(-0.172, 49.47), (-0.167, 49.466), (-0.135, 49.466)])
        self._add_station("South_station", "SS", [(tf1, 4300)], uic=8766)
        self._place_regular_signals(tf1, "F1", min_offset=200.0, max_offset=4300.0)
        tf1.add_curve(begin=3100, end=4400, curve=9500)

    # ================================
    #  Around station G: North-East
    # ================================

    def _build_north_east_area(self) -> None:
        tg1 = self._add_track("TG1", 4000, NORTH_EAST_ROAD, V1)
        tg2 = self._add_track("TG2", 3000, NORTH_EAST_ROAD, V2)
        tg3 = self._add_track("TG3", 50, NORTH_EAST_PARKING, TrackId("J4", 3))
        tg4 = self._add_track("TG4", 2000, NORTH_EAST_PARKING, V1)
        tg5 = self._add_track("TG5", 2000, NORTH_EAST_PARKING, V2)
        pg0 = self.builder.add_point_switch(
            label="PG0", base=tg1.end(), left=tg4.begin(), right=tg3.begin()
        )
        self._add_switch_signals(pg0, {"A": ("DG3", "SG3"), "B1": ("DG5", "SG5")})
        pg0.set_coords(-0.1082, LAT_4)
        pg1 = self.builder.add_point_switch(
            label="PG1", base=tg5.begin(), left=tg2.end(), right=tg3.end()
        )
        self._add_switch_signals(pg1, {"A": ("DG6", "SG6"), "B1": ("DG4", "SG4")})
        pg1.set_coords(-0.108, LAT_4 - LAT_LINE_SPACE)
        tg4.set_remaining_coords([(-0.09, LAT_4)])
        tg5.set_remaining_coords([(-0.09, LAT_4 - LAT_LINE_SPACE)])
        tg3.add_detector(label="DG7", position=tg3.length / 2)
        self._add_station(
            "North_East_station", "NES", [(tg4, 1550), (tg5, 1500)], uic=8777
        )
        self._place_regular_signals(tg1, "G1", min_offset=200.0, max_offset=-200.0)

    # ================================
    #  Around station H: South-East
    # ================================

    def _build_south_east_area(self) -> None:
        t = self.tracks
        tg0, tg1, tg2, td3 = t["TG0"], t["TG1"], t["TG2"], t["TD3"]
        th0 = self._add_track("TH0", 1000, WEST_TO_EAST_ROAD, V2)
        th1 = self._add_track("TH1", 5000, SOUTH_EAST_PARKING, V1)
        self._place_regular_signals(th1, "H1", min_offset=200.0)
        # Switches
        ph0 = self.builder.add_double_slip_switch(
            label="PH0",
            north_1=tg1.begin(),
            north_2=th0.begin(),
            south_1=tg0.end(),
            south_2=td3.end(),
        )
        self._add_switch_signals(
            ph0,
            {
                "A1": ("DG1", "SG1"),
                "A2": ("DH1", "SH1"),
                "B1": ("DG0", "SG0"),
                "B2": ("DH0", "SH0"),
            },
        )
        ph0.set_coords(-0.135, LAT_0 - LAT_LINE_SPACE / 2)
        ph1 = self.builder.add_point_switch(
            label="PH1", base=th0.end(), left=tg2.begin(), right=th1.begin()
        )
        self._add_switch_signals(
            ph1, {"A": ("DH2", "SH2"), "B1": ("DG2", "SG2"), "B2": ("DH3", "SH3")}
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
        th1.set_remaining_coords(
            [(-0.115, 49.497), (-0.115, 49.487), (-0.11, 49.484), (-0.09, 49.484)]
        )
        self._add_station("South_East_station", "SES", [(th1, 4400)], uic=8788)

    # ================================
    #  Infrastructure-wide objects
    # ================================

    def _add_speed_sections(self) -> None:
        t = self.tracks
        speed_0 = self.builder.add_speed_section(
            300 / 3.6, speed_limit_by_tag={"HLP": 250 / 3.6}
        )
        for track_section in self.builder.infra.track_sections:
            speed_0.add_track_range(
                track_section, 0, track_section.length, ApplicableDirection.BOTH
            )
        speed_1 = self.builder.add_speed_section(
            142 / 3.6, speed_limit_by_tag={"E32C": 100 / 3.6}
        )
        speed_1.add_track_range(t["TH0"], 500, 1000, ApplicableDirection.BOTH)
        speed_1.add_track_range(t["TH1"], 0, 4000, ApplicableDirection.BOTH)
        speed_2 = self.builder.add_speed_section(
            112 / 3.6, speed_limit_by_tag={"MA100": 80 / 3.6}
        )
        speed_2.add_track_range(t["TH1"], 3500, 4400, ApplicableDirection.BOTH)

    def _electrified_tracks_25000(self) -> list[TrackSection]:
        """Tracks electrified in 25000V: all but TD1 and West station's V1."""
        excluded = {self.tracks["TD1"], *self._west_v1_tracks()}
        return [t for t in self.builder.infra.track_sections if t not in excluded]

    def _add_electrifications(self) -> None:
        electrifications = self.builder.infra.electrifications
        electrifications.append(
            Electrification(
                "electrification_25k", "25000V", self._electrified_tracks_25000()
            )
        )
        electrifications.append(
            Electrification("electrification_1.5k", "1500V", self._west_v1_tracks())
        )

    def _add_neutral_sections(self) -> None:
        t = self.tracks
        # Located at the end of West station's V1, just before the PA2 switch
        west_v1_end = self._west_v1_tracks()[-1]
        west_v1_length = west_v1_end.length

        lower_pantograph_section_1 = self.builder.add_neutral_section(
            lower_pantograph=True
        )
        lower_pantograph_section_1.add_announcement_track_range(
            t["TG1"], 3500, t["TG1"].length, Direction.START_TO_STOP
        )
        lower_pantograph_section_1.add_track_range(
            t["TG4"], 0, 500, Direction.START_TO_STOP
        )
        lower_pantograph_section_1.add_track_range(
            t["TA6"], 0, 10, Direction.START_TO_STOP
        )
        lower_pantograph_section_2 = self.builder.add_neutral_section(
            lower_pantograph=True
        )
        lower_pantograph_section_2.add_announcement_track_range(
            west_v1_end,
            west_v1_length - 150,
            west_v1_length - 40,
            Direction.START_TO_STOP,
        )
        lower_pantograph_section_2.add_track_range(
            west_v1_end, west_v1_length - 40, west_v1_length, Direction.START_TO_STOP
        )
        keep_pantograph_section_3 = self.builder.add_neutral_section(
            lower_pantograph=False
        )
        keep_pantograph_section_3.add_track_range(
            t["TA6"], 8500, 8600, Direction.START_TO_STOP
        )
        keep_pantograph_section_4 = self.builder.add_neutral_section(
            lower_pantograph=False
        )
        keep_pantograph_section_4.add_announcement_track_range(
            west_v1_end, west_v1_length - 10, west_v1_length, Direction.STOP_TO_START
        )
        keep_pantograph_section_4.add_track_range(
            west_v1_end,
            west_v1_length - 150,
            west_v1_length - 10,
            Direction.STOP_TO_START,
        )

    def _add_level_crossings(self) -> None:
        t = self.tracks
        lc1 = self.builder.add_level_crossing(
            id="lc1", name="LC1", short_zone_length=2000
        )
        lc1.add_part(
            t["TB0"].label,
            t["TB0"].length / 4,
            pedal_upstream=4000,
            pedal_downstream=4000,
        )

        lc2 = self.builder.add_level_crossing(
            id="lc2", name="LC2", short_zone_length=1500
        )
        lc2.add_part(t["TC0"].label, 125, pedal_upstream=4000, pedal_downstream=6000)
        lc2.add_part(t["TC1"].label, 120, pedal_upstream=5000, pedal_downstream=5000)
        lc2.add_part(t["TC2"].label, 110, pedal_upstream=5000, pedal_downstream=5000)
        lc2.add_part(t["TC3"].label, 115, pedal_upstream=6000, pedal_downstream=6000)

    def _create_electrical_profiles(self) -> ExternalGeneratedInputs:
        ta0, ta6 = self.tracks["TA0"], self.tracks["TA6"]
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
                    value=EP_VALUES[min(i, len(boundaries) - i - 1)],
                    power_class=power_class,
                )
                ep.add_track_range(ta6, start * 1000, end * 1000)

        ep_o = external_inputs.add_electrical_profile(value="O", power_class="5")
        ep_o.add_track_range(ta0, 0, ta0.length)
        # We voluntarily leave ta0 empty for other power classes

        other_eps = [
            external_inputs.add_electrical_profile(value="25000V", power_class=str(i))
            for i in range(1, 6)
        ]
        for track_section in self._electrified_tracks_25000():
            if track_section is ta6:
                continue
            for ep in other_eps:
                ep.add_track_range(track_section, 0, track_section.length)

        return external_inputs


def create_small_infra(signaling_system: str) -> ScenarioData:
    return SmallInfraCreator(signaling_system).create()
