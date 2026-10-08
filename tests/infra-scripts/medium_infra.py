#!/usr/bin/env python3
"""Generate an infra similar to small_infra, introducing a new North_West axis
that uses different CH codes for the same Operational Point.

The North_West branch joins West station's V1 at the PI1 switch, 250m before PA2:
small_infra's TA0 is split into TA0 and TI3.
"""

import sys
from collections.abc import Mapping
from pathlib import Path
from typing import ClassVar

from osrd_schemas.infra import LoadingGaugeType
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
    TA0_LENGTH = 1750
    # DA2 and SA2 protect the end of TA0, now handled by PI1
    PA2_SIGNALS: ClassVar[Mapping[str, tuple[str, str]]] = {"A": ("DA3", "SA3")}
    LOCAL_TRACK_NAMING = LocalTrackNaming.TRACK_NAME
    STATION_WEIGHTS: ClassVar[Mapping[str, int]] = {"MWS": 4, "MES": 10, "NS": 3}

    def _west_v1_tracks(self) -> list[TrackSection]:
        return [self.tracks["TA0"], self.tracks["TI3"]]

    def _add_west_tracks(self) -> None:
        ti0 = self._add_track("TI0", 750, NORTH_WEST_PARKING, TrackId("A", 2))
        ti1 = self._add_track("TI1", 650, NORTH_WEST_PARKING, TrackId("B", 1))
        ti2 = self._add_track("TI2", 2350, NORTH_WEST_PARKING, TrackId("A-B", 1))
        ti3 = self._add_track("TI3", 250, WEST_PARKING, V1)
        super()._add_west_tracks()

        ti0.set_remaining_coords(
            [
                (-0.399905989, 49.511371919),
                (-0.392118223, 49.511488984),
                (-0.390308341, 49.510052239),
            ]
        )
        ti1.set_remaining_coords(
            [(-0.399908223, 49.509952495), (-0.390308459, 49.510052494)]
        )
        ti2.set_remaining_coords(
            [
                (-0.390308459, 49.510052494),
                (-0.374246119, 49.510219813),
                (-0.370160915, 49.507828941),
                (-0.370004037, 49.500000033),
            ]
        )
        ti3.set_remaining_coords([(-0.370002375, 49.5), (-0.365, 49.5)])

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
        self._add_switch_signals(pi1, {"A": ("DI2", "SI2"), "B2": ("DA2", "SA2")})
        pi1.set_coords(-0.37, LAT_0)
        super()._add_west_switches()

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
        # Same ranges as small_infra (split around PI1), with the GA/GB gauges
        # used by the e2e rolling stocks
        ta0, ti3 = self.tracks["TA0"], self.tracks["TI3"]
        ta0.add_loading_gauge_limit(begin=0, end=200, category=LoadingGaugeType.GB)
        ta0.add_loading_gauge_limit(begin=200, end=1750, category=LoadingGaugeType.GA)
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
