import schemas
from dataclasses import dataclass, field
from typing import List

from railjson_generator.schema.infra.waypoint import BufferStop, Detector


def _tvd_section_id():
    res = f"tvd_section.{TVDSection._INDEX}"
    TVDSection._INDEX += 1
    return res


@dataclass
class TVDSection:
    label: str = field(default_factory=_tvd_section_id)
    is_berthing_track: bool = field(default=True)
    buffer_stops: List[BufferStop] = field(default_factory=list)
    detectors: List[Detector] = field(default_factory=list)

    _INDEX = 0

    def add_waypoints(self, *waypoints):
        for waypoint in waypoints:
            if waypoint.waypoint_type == "detector":
                self.detectors.append(waypoint)
            else:
                self.buffer_stops.append(waypoint)

    def to_rjs(self):
        return schemas.TVDSection(
            id=self.label,
            detectors=[schemas.ObjectReference(type="detector", id=detector.label) for detector in self.detectors],
            buffer_stops=[schemas.ObjectReference(type="buffer_stop", id=bs.label) for bs in self.buffer_stops],
        )

    def make_rjs_ref(self):
        return schemas.ObjectReference(
            id=self.label,
            type="tvd_section"
        )
