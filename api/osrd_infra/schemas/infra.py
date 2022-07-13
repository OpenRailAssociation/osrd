from enum import Enum
from typing import List, Literal, Mapping, Optional

from geojson_pydantic import LineString
from pydantic import BaseModel, Field, constr, root_validator

ALL_OBJECT_TYPES = []
RAILJSON_VERSION = "2.2.3"

#Used as an input model in the definition of the following classes.

class ObjectReference(BaseModel):
    id: constr(max_length=255) = Field(description="Identifier used to identify all classes: Operational points,routes,swicthes,tracks_sections,signals... ")
    type: str =Field(description="Type of the class reference")


class TrackLocationTrait(BaseModel):
    track: ObjectReference =Field(description="Identifier and type of the track section for classes like Signals or Buffer Stops..")
    position: float = Field(description="Position corresponding to the class specially studied ",ge=0)


class BaseObjectTrait(BaseModel):
    id: constr(max_length=255) = Field(description="Identifier used to identify all classes used: Operational points,routes,swicthes,tracks_sections,signals... ")

    def ref(self):
        return ObjectReference(id=self.id, type=type(self).__name__)


class GeometryLineTrait(BaseModel):
    geo: LineString = Field(description="Type allowing to identify a point with its geometric coordinates")
    sch: LineString =Field(description="Type allowing to identify a point with its schematic coordinates")


# Objects and utils used to generate a json file.


class Direction(str, Enum):
    """
    This is the description of the sense (increasing or decreasing profile).
    """
    START_TO_STOP = "START_TO_STOP"
    STOP_TO_START = "STOP_TO_START"


class ApplicableDirections(str, Enum):
    START_TO_STOP = "START_TO_STOP"
    STOP_TO_START = "STOP_TO_START"
    BOTH = "BOTH"


class Endpoint(str, Enum):
    """
    This class is used to describe the position used in track section links 
    :know if you are located at the beginning or at the end of the track section in question.
    """
    BEGIN = "BEGIN"
    END = "END"


class Side(str, Enum):
    """This class is used only for the object signal. He describes the side of the track where the signal is located. 
    By default, the signal is located at the center of the track.
    """
    LEFT = "LEFT"
    RIGHT = "RIGHT"
    CENTER = "CENTER"


class ApplicableTrainType(str, Enum):
    """This class is used like an attribute only to describe the class loading Gauge Limite.
    It allows to know if the train is carrying passengers or freight.
    """
    FREIGHT = "FREIGHT"
    PASSENGER = "PASSENGER"


class LoadingGaugeType(str, Enum):
    """
    This class is also used like an attribute only to describe the class loading Gauge Limit.
    It allows to know the category of the loading gauge. By default, this value is GA.
    """
    G1 = "G1"
    G2 = "G2"
    GA = "GA" 
    GB = "GB" 
    GB1 = "GB1" 
    GC = "GC" 
    FR3_3 = "FR3.3"


class DirectionalTrackRange(BaseModel):
    """This class is used to define the path of the route used by the train in the object route.
    """
    track: ObjectReference = Field(description="Identifier and type of the track section for class like Signals or Buffer Stops..")
    begin: float=Field(description="Begin of the path, its reading and understanding depend on the direction",ge=0)
    end: float=Field(description="End of the path, its reading and understanding depend also on the direction",ge=0)
    direction: Direction=Field(description="Description of the sense")

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
    """
    This class is used to characterize speed sections and catenaries classes.
    """
    track: ObjectReference = Field(description="Identifier and type of the track section for classes like Signals or Buffer Stops..")
    begin: float =Field(description="Beginning of the corresponding track section used to define the speed section",ge=0)
    end: float = Field(description="End of the corresponding track section used to define the speed section",ge=0)
    applicable_directions: ApplicableDirections =Field(description="Sense where the speed section is applied")

    @root_validator
    def check_range(cls, v):
        assert v.get("begin") < v.get("end"), "expected: begin < end"
        return v


class OperationalPointPart(TrackLocationTrait):
    """
    Localisation of several punctual points ponctuels including in an operational point
    """
    pass


class OperationalPoint(BaseObjectTrait):
    """
    This class describes the operational points of the corresponding infra.
    """
    parts: List[OperationalPointPart]
    ci: int = Field(description="Code infra du point remarquable")
    ch: constr(max_length=2) = Field(description="Code chantier du point remarquable, savoir s'il se situe par exemple dans une gare etc")
    ch_short_label: Optional[constr(max_length=255)] 
    ch_long_label: Optional[constr(max_length=255)] 
    name: constr(max_length=255) = Field(None,description="Name of the operational point")


class TrackEndpoint(BaseModel):
    """
    This class is used like an attribute in switch and track sections link classes.
    """
    endpoint: Endpoint = Field(Endpoint.BEGIN,description="Describe the position used in track section links")
    track: ObjectReference = Field(None,description="Identifier and type of the track section for classes like Signals or Buffer Stops..")


class Route(BaseObjectTrait):
    """
    This class is used to describe routes.
    """
    entry_point: ObjectReference = Field(description="Identifier and type(most of the time a detector) used to recognize an entry point for the corresponding route")
    exit_point: ObjectReference = Field(description="Identifier and type(most of the time a detector) used to recognize an exit point for the corresponding route")
    release_detectors: List[ObjectReference] 
    path: List[DirectionalTrackRange]


class SwitchPortConnection(BaseModel):
    """
    This class is used to define groups in class Switch Type
    src==source et dst==destination
    """
    src: str
    dst: str
    bidirectional: bool =Field(description="Know that the switch has connection in bidirectional")


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
    speed: float = Field(description="Speed corresponding at speed limit of the track section")
    track_ranges: List[ApplicableDirectionsTrackRange]


class Catenary(BaseObjectTrait):
    voltage: float
    track_ranges: List[ApplicableDirectionsTrackRange]


class Curve(BaseModel):
    radius: float
    begin: float
    end: float


class Slope(BaseModel):
    """
    Spécifier les unités utilisées sur les différents objets comme gradient,radius,length,etc
    """
    gradient: float = Field()
    begin: float
    end: float


class LoadingGaugeLimit(BaseModel):
    category: LoadingGaugeType = Field(description="Category of loading gauge for the corresponding rolling stock")
    begin: float
    end: float
    applicable_train_type: ApplicableTrainType =Field(description="The type of the corresponding rolling stock")


class TrackSection(BaseObjectTrait, GeometryLineTrait):
    """
     A track section is a piece of track and is the tracking system used in OSRD to locate a point.
     A track section is identified by his unique id.
    """ 
    length: float = Field(description="Value of the length of the track section",gt=0)
    line_code: int = Field(description="Code of the line used by the corresponding track section")
    line_name: constr(max_length=255) = Field(description="Name of the line used by the corresponding track section")
    track_number: int = Field(description="Number corresponding")
    track_name: constr(max_length=255)
    navigability: ApplicableDirections
    slopes: List[Slope] 
    curves: List[Curve]
    loading_gauge_limits: List[LoadingGaugeLimit] 


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
