from enum import Enum
from typing import Any, List, Literal, Mapping, NewType, Optional

from geojson_pydantic import LineString, MultiLineString, Point
from pydantic import BaseModel, constr

RailScript = NewType("RailScript", Any)
Aspect = NewType("Aspect", Any)

ALL_OBJECT_TYPES = []
RAILJSON_VERSION = "2.0.0"


class Direction(str, Enum):
    START_TO_STOP = "START_TO_STOP"
    STOP_TO_START = "STOP_TO_START"


class ApplicableDirections(str, Enum):
    START_TO_STOP = "START_TO_STOP"
    STOP_TO_START = "STOP_TO_START"
    BOTH = "BOTH"


class Endpoint(str, Enum):
    BEGIN = "BEGIN"
    END = "END"


class SignalingType(str, Enum):
    BAL = "BAL"
    BAL_VB = "BAL_VB"
    BAPR_DV = "BAPR_DV"
    BAPR_VB = "BAPR_VB"
    BM_VU = "BM_VU"
    BM_VU_SE = "BM_VU_SE"
    BM_CV = "BM_CV"
    BM_U = "BM_U"
    BM_AMU = "BM_AMU"
    BM_NB = "BM_NB"
    BM_LU = "BM_LU"
    BM_LUS = "BM_LUS"
    BM_SEUS = "BM_SEUS"
    CAPI = "CAPI"
    CT_DV = "CT_DV"
    CT_VU = "CT_VU"
    TVM300 = "TVM300"
    TVM430 = "TVM430"
    ETCS_1 = "ETCS_1"
    ETCS_2 = "ETCS_2"
    ETCS_3 = "ETCS_3"
    TRMW = "TRMW"
    AUTRE = "AUTRE"


class ObjectReference(BaseModel):
    id: constr(max_length=255)
    type: str


class BaseObjectTrait(BaseModel):
    id: constr(max_length=255)

    def ref(self):
        return ObjectReference(id=self.id, type=type(self).__name__)


class TrackLocationTrait(BaseModel):
    track: ObjectReference
    position: float


class GeometryLineTrait(BaseModel):
    geo: LineString
    sch: LineString


class GeometryMultiLineTrait(BaseModel):
    geo: MultiLineString
    sch: MultiLineString


class GeometryPointTrait(BaseModel):
    geo: Point
    sch: Point


class DirectionalTrackRange(BaseModel):
    track: ObjectReference
    begin: float
    end: float
    direction: Direction

    def length(self):
        return abs(self.begin - self.end)


class OperationalPointPart(TrackLocationTrait, GeometryPointTrait):
    pass


class OperationalPoint(BaseObjectTrait):
    parts: List[OperationalPointPart]
    ci: int
    ch: constr(max_length=2)
    ch_short_label: Optional[constr(max_length=255)]
    ch_long_label: Optional[constr(max_length=255)]
    name: constr(max_length=255)


class TrackEndpoint(BaseModel):
    endpoint: Endpoint
    track: ObjectReference


class Route(BaseObjectTrait, GeometryLineTrait):
    entry_point: ObjectReference
    exit_point: ObjectReference
    release_groups: List[List[ObjectReference]]
    path: List[DirectionalTrackRange]


class SwitchPortConnection(BaseModel):
    src: str
    dst: str
    bidirectional: bool


class SwitchType(BaseObjectTrait):
    ports: List[str]
    groups: Mapping[str, List[SwitchPortConnection]]


class Switch(BaseObjectTrait, GeometryPointTrait):
    switch_type: ObjectReference
    group_change_delay: float
    ports: Mapping[str, TrackEndpoint]


class TrackSectionLink(BaseObjectTrait):
    src: TrackEndpoint
    dst: TrackEndpoint
    navigability: ApplicableDirections


class SpeedSection(BaseModel):
    speed: float
    begin: float
    end: float
    applicable_directions: ApplicableDirections


class CatenarySection(BaseModel):
    voltage: float
    begin: float
    end: float
    applicable_directions: ApplicableDirections


class SignalingSection(BaseModel):
    signaling_type: SignalingType
    begin: float
    end: float


class Curve(BaseModel):
    radius: float
    begin: float
    end: float


class Slope(BaseModel):
    gradient: float
    begin: float
    end: float


class TrackSection(BaseObjectTrait, GeometryLineTrait):
    length: float
    line_code: int
    line_name: constr(max_length=255)
    track_number: int
    track_name: constr(max_length=255)
    navigability: ApplicableDirections
    slopes: List[Slope]
    curves: List[Curve]
    speed_sections: List[SpeedSection]
    catenary_sections: List[CatenarySection]
    signaling_sections: List[SignalingSection]


class Signal(BaseObjectTrait, TrackLocationTrait, GeometryPointTrait):
    direction: Direction
    sight_distance: float
    linked_detector: Optional[ObjectReference]
    angle: float
    expr: RailScript


class BufferStop(BaseObjectTrait, TrackLocationTrait, GeometryPointTrait):
    applicable_directions: ApplicableDirections


class Detector(BaseObjectTrait, TrackLocationTrait, GeometryPointTrait):
    applicable_directions: ApplicableDirections


class TVDSection(BaseObjectTrait, GeometryMultiLineTrait):
    detectors: List[ObjectReference]
    buffer_stops: List[ObjectReference]


class RailJsonInfra(BaseModel):
    version: Literal[RAILJSON_VERSION]
    operational_points: List[OperationalPoint]
    routes: List[Route]
    switch_types: List[SwitchType]
    switches: List[Switch]
    track_section_links: List[TrackSectionLink]
    track_sections: List[TrackSection]
    signals: List[Signal]
    buffer_stops: List[BufferStop]
    detectors: List[Detector]
    tvd_sections: List[TVDSection]
    script_functions: List[RailScript]
    aspects: List[Aspect]


for t in BaseObjectTrait.__subclasses__():
    ALL_OBJECT_TYPES.append(t)

if __name__ == "__main__":
    print(RailJsonInfra.schema_json(indent=2))
