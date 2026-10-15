#!/usr/bin/env python3
"""Generate an infra similar to small_infra, introducing a new North_West axis
that uses different CH codes for the same Operational Point.

The North_West branch joins West station's V1 at the PI1 switch, TI3_LENGTH before PA2:
small_infra's TA0 is split into TA0 and TI3.
"""

import sys
from collections.abc import Mapping
from pathlib import Path
from typing import ClassVar

from osrd_schemas.infra import LoadingGaugeType
from railjson_generator.schema.infra.switch import Switch
from railjson_generator.schema.infra.track_section import TrackSection
from small_infra_creator import (
    LAT_0,
    V1,
    WEST_PARKING,
    Line,
    LocalTrackNaming,
    ScenarioData,
    SmallInfraCreator,
    TrackId,
)

NORTH_WEST_PARKING = Line("North_West_Parking", 404040)


class MediumInfraCreator(SmallInfraCreator):
    TI3_LENGTH: ClassVar[float] = 250
    """Length of West station's V1 between the PI1 and PA2 switches."""
    TA0_LENGTH = SmallInfraCreator.TA0_LENGTH - TI3_LENGTH
    LOCAL_TRACK_NAMING = LocalTrackNaming.TRACK_NAME
    STATION_WEIGHTS: ClassVar[Mapping[str, int]] = {"MWS": 4, "MES": 10, "NS": 3}
    HAS_DUPLICATE_MID_WEST_STATION = False
    HAS_LEVEL_CROSSINGS = False

    def _west_v1_tracks(self) -> list[TrackSection]:
        return [self.tracks["TA0"], self.tracks["TI3"]]

    def _west_v1_exit_switch(self) -> Switch:
        return self.switches["PI1"]

    def _add_west_tracks(self) -> None:
        self._add_track("TI0", 750, NORTH_WEST_PARKING, TrackId("A", 2))
        self._add_track("TI1", 650, NORTH_WEST_PARKING, TrackId("B", 1))
        self._add_track("TI2", 2350, NORTH_WEST_PARKING, TrackId("A-B", 1))
        self._add_track("TI3", self.TI3_LENGTH, WEST_PARKING, V1)
        super()._add_west_tracks()

    def _add_west_switches(self) -> None:
        t = self.tracks
        pi0 = self.builder.add_point_switch(
            label="PI0",
            base=t["TI2"].begin(),
            left=t["TI0"].end(),
            right=t["TI1"].end(),
        )
        self._add_switch_signals(pi0, {"B1": ("DI0", "SI0"), "B2": ("DI1", "SI1")})
        pi0.set_coords(-0.390308459, 49.510052494)
        pi1 = self.builder.add_point_switch(
            label="PI1",
            base=t["TI2"].end(),
            left=t["TI3"].begin(),
            right=t["TA0"].end(),
        )
        self.switches["PI1"] = pi1
        self._add_switch_signals(pi1, {"A": ("DI2", "SI2")})
        pi1.set_coords(-0.37, LAT_0)
        super()._add_west_switches()

    def _set_west_coords(self) -> None:
        t = self.tracks
        t["TI0"].set_remaining_coords(
            [(-0.399905989, 49.511371919), (-0.392118223, 49.511488984)]
        )
        t["TI1"].set_remaining_coords([(-0.399908223, 49.509952495)])
        t["TI2"].set_remaining_coords(
            [(-0.374246119, 49.510219813), (-0.370160915, 49.507828941)]
        )
        super()._set_west_coords()

    def _add_west_detectors(self) -> None:
        ti3 = self.tracks["TI3"]
        ti3.add_detector(label="DI3", position=ti3.length / 2)
        super()._add_west_detectors()

    def _add_west_stations(self) -> None:
        t = self.tracks
        self._add_station("North_West_station", "NWS", [(t["TI0"], 300)], uic=8799)
        self._add_station(
            "North_West_station",
            "NWS",
            [(t["TI1"], 250)],
            secondary_code="BC",
            uic=8799,
            id="North_West_station_1",
        )
        super()._add_west_stations()

    def _add_west_loading_gauge_limits(self) -> None:
        ta0, ti3 = self.tracks["TA0"], self.tracks["TI3"]
        ta0.add_loading_gauge_limit(begin=0, end=200, category=LoadingGaugeType.GB)
        ta0.add_loading_gauge_limit(
            begin=200, end=self.TA0_LENGTH, category=LoadingGaugeType.GA
        )
        ti3.add_loading_gauge_limit(begin=0, end=150, category=LoadingGaugeType.GA)
        ta0.add_loading_gauge_limit(begin=100, end=1500, category=LoadingGaugeType.GB)


def create_medium_infra(signaling_system: str) -> ScenarioData:
    return MediumInfraCreator(signaling_system).create()


scenario_data = create_medium_infra(signaling_system="BAL")

if __name__ == "__main__":
    scenario_data.infra.save(Path(sys.argv[1]) / "infra.json")
    scenario_data.external_inputs.save(
        Path(sys.argv[1]) / "external_generated_inputs.json"
    )
