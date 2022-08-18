from enum import Enum
from typing import List, Literal, Mapping, Optional

from geojson_pydantic import LineString
from pydantic import BaseModel, Field, constr, root_validator

ALL_OBJECT_TYPES = []
RAILJSON_INFRA_VERSION = "2.3.1"

# Traits
# Used as an input model in the definition of the following classes.


class ObjectReference(BaseModel):
    id: constr(max_length=255) = Field(description="Identifier of the referenced object")
    type: str = Field(description="Type of the attribute of the referenced object")


class TrackLocationTrait(BaseModel):
    """
    This class is used to define objects that associated as point on the infrastructure.
    """

    track: ObjectReference = Field(description="Reference to the track section on which the object is located")
    position: float = Field(description="Offset of the point in meters to the beginning of the track section", ge=0)


class BaseObjectTrait(BaseModel):
    """
    This class is used to define and identify objects that associated on the infrastructure.
    """

    id: constr(max_length=255) = Field(description="Unique identifier of the object")

    def ref(self):
        return ObjectReference(id=self.id, type=type(self).__name__)


class GeometryLineTrait(BaseModel):
    """
    This trait defines a geometric object of continuous line type.
    There are two representations, geographic and schematic.
    """

    geo: LineString = Field(description="Geographic coordinates of the corresponding object")
    sch: LineString = Field(description="Schematic coordinates of the corresponding object")


# Objects and utils used to generate an infra json.


class Direction(str, Enum):
    """
    This is the description of the direction (increasing or decreasing profile).
    """

    START_TO_STOP = "START_TO_STOP"
    STOP_TO_START = "STOP_TO_START"


class ApplicableDirections(str, Enum):
    """
    This is used to know the direction of application of certain objects
    """

    START_TO_STOP = "START_TO_STOP"
    STOP_TO_START = "STOP_TO_START"
    BOTH = "BOTH"


class Endpoint(str, Enum):
    BEGIN = "BEGIN"
    END = "END"


class Side(str, Enum):
    """
    This class describes the side of the track where the signal is located.
    """

    LEFT = "LEFT"
    RIGHT = "RIGHT"
    CENTER = "CENTER"


class ApplicableTrainType(str, Enum):
    """This class allows to know if the train is carrying passengers or freight."""

    FREIGHT = "FREIGHT"
    PASSENGER = "PASSENGER"


class LoadingGaugeType(str, Enum):
    """
    This class allows to know the category of the loading gauge.
    """

    G1 = "G1"
    G2 = "G2"
    GA = "GA"
    GB = "GB"
    GB1 = "GB1"
    GC = "GC"
    FR3_3 = "FR3.3"
    FR3_3_GB_G2 = "FR3.3/GB/G2"
    GLOTT = "GLOTT"


class DirectionalTrackRange(BaseModel):
    """
    This class is used to define the path of the route used by the train.
    """

    track: ObjectReference = Field(description="Identifier of the track")
    begin: float = Field(
        description="Begin offset of the path in meters, its reading and understanding depend on the direction", ge=0
    )
    end: float = Field(
        description="End offset of the path in meters, its reading and understanding depend also on the direction", ge=0
    )
    direction: Direction = Field(description="Description of the direction")

    @root_validator
    def check_range(cls, v):
        assert v.get("begin") <= v.get("end"), "expected: begin <= end"
        return v

    def make(track, begin, end) -> "DirectionalTrackRange":
        """
        This function return the directional track range.
        It allows to generate the meaning according to the begin and end attributes.
        """
        return DirectionalTrackRange(
            track=track,
            begin=min(begin, end),
            end=max(begin, end),
            direction=Direction.START_TO_STOP if begin < end else Direction.STOP_TO_START,
        )

    def get_begin(self) -> float:
        """
        This function return the begin offset of the track range taking into account the direction.
        The returned value can be greatest than get_end().
        """
        return self.begin if self.direction == Direction.START_TO_STOP else self.end

    def get_end(self) -> float:
        """
        This function return the end offset of the track range taking into account the direction.
        The returned value can be smaller than get_begin().
        """
        return self.end if self.direction == Direction.START_TO_STOP else self.begin

    def length(self) -> float:
        return abs(self.begin - self.end)


class ApplicableDirectionsTrackRange(BaseModel):
    """
    This class is used to define track ranges that are associated with certain classes in the infrastructure.
    """

    track: ObjectReference = Field(description="Identifier and type of the track")
    begin: float = Field(description="Begin offset in meters of the corresponding track section", ge=0)
    end: float = Field(description="End offset in meters of the corresponding track section", ge=0)
    applicable_directions: ApplicableDirections = Field(
        description="Direction where the corresponding object is applied"
    )

    @root_validator
    def check_range(cls, v):
        assert v.get("begin") < v.get("end"), "expected: begin < end"
        return v


class OperationalPointPart(TrackLocationTrait):
    """
    This class allows to define the track section and the position on which the operational point is located.
    """

    pass


class OperationalPoint(BaseObjectTrait):
    """
    This class describes the operational points of the corresponding infra.
    """

    parts: List[OperationalPointPart]
    name: constr(max_length=255) = Field(description="Name of the operational point")
    uic: int
    ci: int = Field(description="Infra code from THOR of the corresponding operational point")
    ch: constr(max_length=2) = Field(description="Side code from THOR of the operational point")
    ch_short_label: Optional[constr(max_length=255)]
    ch_long_label: Optional[constr(max_length=255)]
    trigram: constr(max_length=3)


class TrackEndpoint(BaseModel):
    """
    This class is used to define the end point of the considered object on the infrastructure.
    """

    endpoint: Endpoint = Field(description="Relative position of the considered end point")
    track: ObjectReference = Field(description="Identifier and type of the track")


class Route(BaseObjectTrait):
    """
    This class is used to describe routes on the infrastructure.
    """

    entry_point: ObjectReference = Field(description="Identifier and type used to define an entry point for the route")
    exit_point: ObjectReference = Field(description="Identifier and type used to define an exit point for the route")
    release_detectors: List[ObjectReference] = Field(
        description="Detector allowing the release of resources reserved from the beginning of the route until this one"
    )
    path: List[DirectionalTrackRange] = Field(description="List of the path corresponding to the routes")


class SwitchPortConnection(BaseModel):
    """
    This class allows to know the connection between each port in switch type.
    """

    src: str = Field(description="Port name that is source of the connection")
    dst: str = Field(description="Port name that is destination of the connection")
    bidirectional: bool = Field(description="Is the connection bidirectional")


class SwitchType(BaseObjectTrait):
    """
    This class is used to define switch types.
    We always have three switch types characterized by their identifier: point, cross and double cross.
    """

    ports: List[str] = Field(description="List of ports. A port correspond at the ends of the switches")
    groups: Mapping[str, List[SwitchPortConnection]] = Field(description="Connection between and according ports")


class Switch(BaseObjectTrait):
    """This class is used to define switches.
    Switches are devices used for track changes."""

    switch_type: ObjectReference = Field(description="Identifier and type of the switch type")
    group_change_delay: float = Field(
        description="Time it takes to change which group of the switch is activated", ge=0
    )
    ports: Mapping[str, TrackEndpoint] = Field(description="Location of differents ports according to track sections")
    label: str = Field(description="Identifier of the switch")


class TrackSectionLink(BaseObjectTrait):
    """This class is used to define the track section links object.
    Track section links is used to connect and link two track sections.
    A track section link is characterized by its identifier.
    """

    src: TrackEndpoint = Field(
        description="Starting track section, relative position in track section is defined by its end point"
    )
    dst: TrackEndpoint = Field(
        description="Finish track section, relative position in track section is defined by its end point"
    )
    navigability: ApplicableDirections = Field(description="Direction of application of track section links")


class SpeedSection(BaseObjectTrait):
    """This class is used to define speed sections.
    Speed sections is recognized by its identifier and are in meters per second."""

    speed_limit: Optional[float] = Field(
        description="Speed limit (m/s) applied by default to trains that aren't in any specified category", gt=0
    )
    speed_limit_by_tag: Mapping[str, float] = Field(description="Speed limit (m/s) applied to trains with a given tag")
    track_ranges: List[ApplicableDirectionsTrackRange] = Field(
        description="List of locations where speed section is applied"
    )


class Catenary(BaseObjectTrait):
    """This class is used to define catenary.
    A catenary correspond at a set of cables designed
    to power electric trains by capturing the current through
    the use of a pantograph.
    Catenary is identified by its identifier.
    """

    voltage: float = Field(description="Type of power supply (in Volts) used for electrification", gt=0)
    track_ranges: List[ApplicableDirectionsTrackRange] = Field(
        description="List of locations where the voltage is applied"
    )


class Curve(BaseModel):
    """This class is used to define the curve object.
    A curve correspond at radius of curvature in the part of corresponding track section."""

    radius: float = Field(description="Corresponding radius of curvature measured in meters")
    begin: float = Field(
        description="Offset in meters corresponding at the beginning of the corresponding radius in a track section ",
        ge=0,
    )
    end: float = Field(
        description="Offset in meters corresponding at the end of the corresponding radius in a track section", ge=0
    )

    @root_validator
    def check_range(cls, v):
        assert v.get("begin") < v.get("end"), "expected: begin < end"
        return v


class Slope(BaseModel):
    """
    This class is used to define the slope object.
    A slope correspond at the gradient in the part of corresponding track section.
    The gradient can be positive (case of ramp) or negative (slope case)
    """

    gradient: float = Field(description="Corresponding gradient, measured in meters per kilometers")
    begin: float = Field(
        description="Offset in meters corresponding at the beginning of the corresponding gradient in a track section",
        ge=0,
    )
    end: float = Field(
        description="Offset in meters corresponding at the end of the corresponding gradient in a track section", ge=0
    )

    @root_validator
    def check_range(cls, v):
        assert v.get("begin") < v.get("end"), "expected: begin < end"
        return v


class LoadingGaugeLimit(BaseModel):
    """This class is used to define loading gauge limit.
    It represents a restriction on the trains according to their categories of loading gauge
    and the type of the corresponding rolling stock.
    """

    category: LoadingGaugeType = Field(description="Category of loading gauge for the corresponding rolling stock")
    begin: float = Field(
        description="Offset in meters corresponding at the beginning of the corresponding loading gauge limit", ge=0
    )
    end: float = Field(
        description="Offset in meters corresponding at the end of the corresponding loading gauge limit", ge=0
    )
    applicable_train_type: ApplicableTrainType = Field(
        description="Type of transport of the corresponding rolling stock"
    )


class TrackSection(BaseObjectTrait, GeometryLineTrait):
    """
    A track section is a piece of track and is the tracking system used in OSRD to locate a point.
    A track section is identified by his unique id and its coordinates (geographic or schematic).
    """

    length: float = Field(description="Value of the length of the track section in meters", gt=0)
    line_code: int = Field(description="Code of the line used by the corresponding track section")
    line_name: constr(max_length=255) = Field(description="Name of the line used by the corresponding track section")
    track_number: int = Field(description="Number corresponding to the track used", ge=0)
    track_name: constr(max_length=255) = Field(description="Name corresponding to the track used")
    navigability: ApplicableDirections = Field(description="Direction in which the train can run on the track section")
    slopes: List[Slope] = Field(description="List of slopes of corresponding track section")
    curves: List[Curve] = Field(description="List of curves of corresponding track section")
    loading_gauge_limits: List[LoadingGaugeLimit] = Field(
        default_factory=list, description="List of loading gauge limits of corresponding track section"
    )


class Signal(BaseObjectTrait, TrackLocationTrait):
    """This class is used to describe the signal.
    A signal is characterized by its id and its corresponding track.
    By default, the signal is located at the center of the track.
    """

    direction: Direction = Field(description="Direction of use of the signal")
    sight_distance: float = Field(description="Visibility distance of the signal in meters", gt=0)
    linked_detector: Optional[ObjectReference]
    aspects: Optional[List[str]]
    angle_sch: float = Field(0, description="Schematic angle in degrees")
    angle_geo: float = Field(0, description="Geographic angle in degrees")
    type_code: Optional[str]
    support_type: Optional[str]
    is_in_service: Optional[bool] = Field(description="Is the signal is in service")
    is_lightable: Optional[bool] = Field(description="Is the signal is lightable")
    is_operational: Optional[bool] = Field(description="Is the signal is operational")
    comment: Optional[str]
    physical_organization_group: Optional[str]
    responsible_group: Optional[str]
    label: Optional[str]
    installation_type: Optional[str]
    value: Optional[str]
    side: Side = Field(Side.CENTER, description="Side of the signal on the track")
    default_aspect: Optional[str] = Field(description="Aspect displayed when no train is around")


class BufferStop(BaseObjectTrait, TrackLocationTrait):
    """This class defines the buffer stop object.
    A buffer stop is a device placed at the end of a dead-end road
    to stop any drifting trains from continuing off the road.
    A buffer stop is characterized by its id and its corresponding track.
    """

    applicable_directions: ApplicableDirections = Field(description="Direction of the application of the buffer stop")


class Detector(BaseObjectTrait, TrackLocationTrait):
    """This class defines detector object.
    A detector is characterized by its id and its corresponding track.
    A detector is used to locate a train
    in order to consider the section as occupied when there is a train.
    """

    applicable_directions: ApplicableDirections = Field(description="Direction of the application of the dectector")


class RailJsonInfra(BaseModel):
    """This class is used to build an infra."""

    version: Literal[RAILJSON_INFRA_VERSION]
    operational_points: List[OperationalPoint] = Field(
        description="List of operational points of the corresponding infra"
    )
    routes: List[Route] = Field(description="List of routes of the corresponding infra")
    switch_types: List[SwitchType] = Field(description="List of switch types of the corresponding infra")
    switches: List[Switch] = Field(description="List of switches of the corresponding infra")
    track_section_links: List[TrackSectionLink] = Field(
        description="List of track section links of the corresponding infra"
    )
    track_sections: List[TrackSection] = Field(description="List of track sections of the corresponding infra")
    catenaries: List[Catenary] = Field(description="List of catenaries of the corresponding infra")
    signals: List[Signal] = Field(description="List of signals of the corresponding infra")
    buffer_stops: List[BufferStop] = Field(description="List of buffer stops of the corresponding infra")
    detectors: List[Detector] = Field(description="List of detectors of the corresponding infra")
    default_aspect: Optional[str] = Field(description="Aspect displayed when no train is around")


for t in BaseObjectTrait.__subclasses__():
    ALL_OBJECT_TYPES.append(t)

if __name__ == "__main__":
    print(RailJsonInfra.schema_json(indent=2))
