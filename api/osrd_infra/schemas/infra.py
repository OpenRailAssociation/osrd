from enum import Enum
from typing import List, Literal, Mapping, Optional

from geojson_pydantic import LineString
from pydantic import BaseModel, Field, constr, root_validator

ALL_OBJECT_TYPES = []
RAILJSON_VERSION = "2.2.3"

# Traits


class ObjectReference(BaseModel):
    id: constr(max_length=255)
    type: str


class TrackLocationTrait(BaseModel):
    track: ObjectReference
    position: float


class BaseObjectTrait(BaseModel):
    id: constr(max_length=255)

    def ref(self):
        return ObjectReference(id=self.id, type=type(self).__name__)


class GeometryLineTrait(BaseModel):
    geo: LineString
    sch: LineString


# Objects and utils


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


class Side(str, Enum):
    LEFT = "LEFT"
    RIGHT = "RIGHT"
    CENTER = "CENTER"


class ApplicableTrainType(str, Enum):
    FREIGHT = "FREIGHT"
    PASSENGER = "PASSENGER"


class LoadingGaugeType(str, Enum):
    G1 = "G1"
    G2 = "G2"
    GA = "GA"
    GB = "GB"
    GB1 = "GB1"
    GC = "GC"
    FR3_3 = "FR3.3"


class DirectionalTrackRange(BaseModel):
    track: ObjectReference
    begin: float
    end: float
    direction: Direction

    def make(track, begin, end) -> "DirectionalTrackRange":
        return DirectionalTrackRange(
            track=track,
            begin=begin,
            end=end,
            direction=Direction.START_TO_STOP if begin < end else Direction.STOP_TO_START,
        )

    def length(self):
        return abs(self.begin - self.end)


class ApplicableDirectionsTrackRange(BaseModel):
    track: ObjectReference
    begin: float
    end: float
    applicable_directions: ApplicableDirections

    @root_validator
    def check_range(cls, v):
        assert v.get("begin") < v.get("end"), "expected: begin < end"
        return v


class OperationalPointPart(TrackLocationTrait):
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


class Route(BaseObjectTrait):
    entry_point: ObjectReference
    exit_point: ObjectReference
    release_detectors: List[ObjectReference]
    path: List[DirectionalTrackRange]


class SwitchPortConnection(BaseModel):
    src: str
    dst: str
    bidirectional: bool


class SwitchType(BaseObjectTrait):
    ports: List[str]
    groups: Mapping[str, List[SwitchPortConnection]]


class Switch(BaseObjectTrait):
    switch_type: ObjectReference
    group_change_delay: float
    ports: Mapping[str, TrackEndpoint]
    label: str


class TrackSectionLink(BaseObjectTrait):
    src: TrackEndpoint
    dst: TrackEndpoint
    navigability: ApplicableDirections


class SpeedSection(BaseObjectTrait):
    speed: float
    track_ranges: List[ApplicableDirectionsTrackRange]


class Catenary(BaseObjectTrait):
    voltage: float
    track_ranges: List[ApplicableDirectionsTrackRange]


class Curve(BaseModel):
    radius: float
    begin: float
    end: float


class Slope(BaseModel):
    gradient: float
    begin: float
    end: float


class LoadingGaugeLimit(BaseModel):
    category: LoadingGaugeType
    begin: float
    end: float
    applicable_train_type: ApplicableTrainType


class TrackSection(BaseObjectTrait, GeometryLineTrait):
    length: float
    line_code: int
    line_name: constr(max_length=255)
    track_number: int
    track_name: constr(max_length=255)
    navigability: ApplicableDirections
    slopes: List[Slope]
    curves: List[Curve]
    loading_gauge_limits: List[LoadingGaugeLimit] = Field(default_factory=list)


class Signal(BaseObjectTrait, TrackLocationTrait):
    direction: Direction
    sight_distance: float
    linked_detector: Optional[ObjectReference]
    aspects: Optional[List[str]]
    angle_sch: float = Field(0, description="Schematic angle in degrees")
    angle_geo: float = Field(0, description="Geographic angle in degrees")
    type_code: Optional[str]
    support_type: Optional[str]
    is_in_service: Optional[bool]
    is_lightable: Optional[bool]
    is_operational: Optional[bool]
    comment: Optional[str]
    physical_organization_group: Optional[str]
    responsible_group: Optional[str]
    label: Optional[str]
    installation_type: Optional[str]
    value: Optional[str]
    side: Side = Field(Side.CENTER, description="Side of the signal on the track")


class BufferStop(BaseObjectTrait, TrackLocationTrait):
    applicable_directions: ApplicableDirections


class Detector(BaseObjectTrait, TrackLocationTrait):
    applicable_directions: ApplicableDirections


class RailJsonInfra(BaseModel):
    version: Literal[RAILJSON_VERSION]
    operational_points: List[OperationalPoint]
    routes: List[Route]
    switch_types: List[SwitchType]
    switches: List[Switch]
    track_section_links: List[TrackSectionLink]
    track_sections: List[TrackSection]
    speed_sections: List[SpeedSection]
    catenaries: List[Catenary]
    signals: List[Signal]
    buffer_stops: List[BufferStop]
    detectors: List[Detector]


for t in BaseObjectTrait.__subclasses__():
    ALL_OBJECT_TYPES.append(t)

if __name__ == "__main__":
    print(RailJsonInfra.schema_json(indent=2))
