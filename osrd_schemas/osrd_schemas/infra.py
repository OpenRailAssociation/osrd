from enum import Enum
from typing import Annotated, List, Literal, Mapping, NewType, Optional, Union

from geojson_pydantic import LineString
from pydantic import (
    BaseConfig,
    BaseModel,
    Field,
    conlist,
    constr,
    create_model,
    root_validator,
)
from pydantic.fields import ModelField

ALL_OBJECT_TYPES = []
RAILJSON_INFRA_VERSION = "3.1.0"


# Traits
# Used as an input model in the definition of the following classes.

Identifier = NewType("Identifier", constr(min_length=1, max_length=255))
NonBlankStr = NewType("NonBlankStr", constr(min_length=1))


class DetectorReference(BaseModel):
    type: Literal["Detector"]
    id: Identifier = Field(description="Identifier of the detector")


class BufferStopReference(BaseModel):
    type: Literal["BufferStop"]
    id: Identifier = Field(description="Identifier of the buffer stop")


Waypoint = Annotated[Union[DetectorReference, BufferStopReference], Field(discriminator="type")]


class TrackLocationTrait(BaseModel):
    """
    This class is used to define objects that associated as point on the infrastructure.
    """

    track: Identifier = Field(description="Reference to the track section on which the object is located")
    position: float = Field(description="Offset of the point in meters to the beginning of the track section", ge=0)


class BaseObjectTrait(BaseModel):
    """
    This class is used to define and identify objects that associated on the infrastructure.
    """

    id: Identifier = Field(description="Unique identifier of the object")


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


class TrackRange(BaseModel):
    """
    This class is used to define track ranges that are associated with certain classes in the infrastructure.
    """

    track: Identifier = Field(description="Identifier of the track section")
    begin: float = Field(description="Begin offset in meters of the corresponding track section", ge=0)
    end: float = Field(description="End offset in meters of the corresponding track section", ge=0)

    @root_validator(skip_on_failure=True)
    def check_range(cls, v):
        assert v.get("begin") <= v.get("end"), "expected: begin <= end"
        return v

    def length(self) -> float:
        return abs(self.begin - self.end)


class DirectionalTrackRange(TrackRange):
    """
    A directional track range is a track range with an associated direction.
    """

    direction: Direction = Field(description="Description of the direction")

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


class ApplicableDirectionsTrackRange(TrackRange):
    """
    An applicable directions track range is a track range with associated directions.
    """

    applicable_directions: ApplicableDirections = Field(
        description="Direction where the corresponding object is applied"
    )

    @root_validator(skip_on_failure=True)
    def check_range(cls, v):
        assert v.get("begin") < v.get("end"), "expected: begin < end"
        return v


class OperationalPointPart(TrackLocationTrait):
    """
    Operational point part is a single point on the infrastructure. It's linked to an operational point.
    """

    pass


class OperationalPoint(BaseObjectTrait):
    """
    This class describes the operational points of the corresponding infra.
    """

    parts: List[OperationalPointPart]


class TrackEndpoint(BaseModel):
    """
    This class is used to define the endpoint (begin or end) of the considered track on the infrastructure.
    """

    endpoint: Endpoint = Field(description="Relative position of the considered end point")
    track: Identifier = Field(description="Identifier and type of the track")


class Route(BaseObjectTrait):
    """
    This class is used to describe routes on the infrastructure.
    """

    entry_point: Waypoint
    entry_point_direction: Direction = Field(description="Direction of the route at the entry point")
    exit_point: Waypoint
    release_detectors: List[Identifier] = Field(
        description="Detector allowing the release of resources reserved from the beginning of the route until this one"
    )
    switches_directions: Mapping[Identifier, Identifier] = Field(description="Switches position part of the route")


class SwitchPortConnection(BaseModel):
    """
    This class allows to know the connection between each port in switch type.
    The connection is always bidirectional.
    """

    src: Identifier = Field(description="Port name that is source of the connection")
    dst: Identifier = Field(description="Port name that is destination of the connection")


class SwitchType(BaseObjectTrait):
    """
    Switch types are used to define what kind of switch is used in the infrastructure.
    A switch type is defined by a list of ports and groups which are the possible configurations of the switch.
    """

    ports: conlist(Identifier, min_items=1) = Field(
        description="List of ports. A port correspond at the ends of the switches"
    )
    groups: Mapping[Identifier, List[SwitchPortConnection]] = Field(
        description="Connection between and according ports"
    )


class Switch(BaseObjectTrait):
    """
    Switches are devices used for track changes.
    """

    switch_type: Identifier = Field(description="Identifier and type of the switch type")
    group_change_delay: float = Field(
        description="Time it takes to change which group of the switch is activated", ge=0
    )
    ports: Mapping[Identifier, TrackEndpoint] = Field(
        description="Location of differents ports according to track sections"
    )


class TrackSectionLink(BaseObjectTrait):
    """
    Track section links is used to connect and link two track sections.
    A track section link is characterized by its identifier.
    """

    src: TrackEndpoint = Field(
        description="Starting track section, relative position in track section is defined by its end point"
    )
    dst: TrackEndpoint = Field(
        description="Finish track section, relative position in track section is defined by its end point"
    )


class SpeedSection(BaseObjectTrait):
    """
    Speed sections are recognized by their identifiers and are in meters per second.
    """

    speed_limit: Optional[float] = Field(
        description="Speed limit (m/s) applied by default to trains that aren't in any specified category", gt=0
    )
    speed_limit_by_tag: Mapping[NonBlankStr, float] = Field(
        description="Speed limit (m/s) applied to trains with a given tag"
    )
    track_ranges: List[ApplicableDirectionsTrackRange] = Field(
        description="List of locations where speed section is applied"
    )


class Catenary(BaseObjectTrait):
    """
    A catenary corresponds to a set of cables designed to power electric trains by capturing the current through the use
    of a pantograph. Catenary is identified by its identifier.
    """

    voltage: NonBlankStr = Field(description="Type of power supply (in Volts) used for electrification")
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

    @root_validator(skip_on_failure=True)
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

    @root_validator(skip_on_failure=True)
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


class TrackSection(BaseObjectTrait, GeometryLineTrait):
    """
    A track section is a piece of track and is the tracking system used in OSRD to locate a point.
    A track section is identified by his unique id and its coordinates (geographic or schematic).
    """

    length: float = Field(description="Value of the length of the track section in meters", gt=0)
    slopes: List[Slope] = Field(description="List of slopes of corresponding track section")
    curves: List[Curve] = Field(description="List of curves of corresponding track section")
    loading_gauge_limits: List[LoadingGaugeLimit] = Field(
        default_factory=list, description="List of loading gauge limits of corresponding track section"
    )


class LogicalSignal(BaseModel):
    """A logical signal is what displays something, whereas a physical signal is a group of logical signals"""

    signaling_system: str = Field(description="The signal's output signaling system")
    next_signaling_systems: List[str] = Field(description="The list of allowed input signaling systems")
    settings: Mapping[NonBlankStr, NonBlankStr] = Field(
        description="A list of key value parameters, which are defined per signaling system"
    )


class Signal(BaseObjectTrait, TrackLocationTrait):
    """This class is used to describe the signal.
    A signal is characterized by its id and its corresponding track.
    By default, the signal is located at the center of the track.
    """

    direction: Direction = Field(description="Direction of use of the signal")
    sight_distance: float = Field(description="Visibility distance of the signal in meters", gt=0)
    linked_detector: Optional[Identifier] = Field(description="Identifier of the detector linked to the signal")
    logical_signals: Optional[List[LogicalSignal]] = Field(
        description="Logical signals bundled into this physical signal"
    )


class BufferStop(BaseObjectTrait, TrackLocationTrait):
    """This class defines the buffer stop object.
    A buffer stop is a device placed at the end of a dead-end road
    to stop any drifting trains from continuing off the road.
    A buffer stop is characterized by its id and its corresponding track.
    """

    applicable_directions: ApplicableDirections = Field(description="Direction of the application of the buffer stop")

    def ref(self):
        return BufferStopReference(type="BufferStop", id=self.id)


class Detector(BaseObjectTrait, TrackLocationTrait):
    """This class defines detector object.
    A detector is characterized by its id and its corresponding track.
    A detector is used to locate a train
    in order to consider the section as occupied when there is a train.
    """

    applicable_directions: ApplicableDirections = Field(description="Direction of the application of the dectector")

    def ref(self):
        return DetectorReference(type="Detector", id=self.id)


class Panel(TrackLocationTrait):
    """This class is used to define panels.
    This is a physical, ponctual, cosmetic object.
    """

    angle_geo: float = Field(0, description="Geographic angle in degrees")
    angle_sch: float = Field(0, description="Schematic angle in degrees")
    side: Side = Field(Side.CENTER, description="Side of the panel on the track")
    type: NonBlankStr = Field(description="Precise the type of the panel")
    value: Optional[NonBlankStr] = Field(description="If the panel is an announcement, precise the value(s)")


class RailJsonInfra(BaseModel):
    """This class is used to build an infra."""

    version: Literal[RAILJSON_INFRA_VERSION] = Field(
        default=RAILJSON_INFRA_VERSION, description="Version of the schema"
    )
    operational_points: List[OperationalPoint] = Field(
        description="List of operational points of the corresponding infra"
    )
    routes: List[Route] = Field(description="Routes of the infra")
    switch_types: List[SwitchType] = Field(description="Switch types of the infra")
    switches: List[Switch] = Field(description="Switches of the infra")
    track_section_links: List[TrackSectionLink] = Field(description="Track section links of the infra")
    track_sections: List[TrackSection] = Field(description="Track sections of the infra")
    speed_sections: List[SpeedSection] = Field(description="Speed sections of the infra")
    catenaries: List[Catenary] = Field(description="Catenaries of the infra")
    signals: List[Signal] = Field(description="Signals of the infra")
    buffer_stops: List[BufferStop] = Field(description="Buffer stops of the infra")
    detectors: List[Detector] = Field(description="Detectors of the infra")


for t in BaseObjectTrait.__subclasses__():
    ALL_OBJECT_TYPES.append(t)

# Extensions


def register_extension(object, name):
    """
    This decorator is used to esily add an extension to an existing object.
    Example:

    ```
    @register_extension(TrackSection, "my_extension")
    class TrackSectionMyExtension(BaseModel):
        ...
    ```

    This will add the optional dictionary field `extensions` to the `TrackSection` class.
    This dictionary can contain the field `my_extension` of type `TrackSectionMyExtension`.
    """

    if "extensions" not in object.__fields__:
        extensions_type = create_model(object.__name__ + "Extensions")
        object.__fields__["extensions"] = ModelField(
            name="extensions",
            type_=extensions_type,
            class_validators={},
            model_config=BaseConfig,
            required=False,
            default_factory=dict,
        )

    def register_extension(extension):
        extensions_field = object.__fields__["extensions"]
        if name in extensions_field.type_.__fields__:
            raise RuntimeError(f"Extension '{name}' already registered for {object.__name__}")

        extensions_field.type_.__fields__[name] = ModelField(
            name=name,
            type_=extension,
            class_validators={},
            model_config=BaseConfig,
            required=False,
        )
        return extension

    return register_extension


@register_extension(object=TrackSection, name="sncf")
class TrackSectionSncfExtension(BaseModel):
    line_code: int = Field(description="Code of the line used by the corresponding track section")
    line_name: NonBlankStr = Field(description="Name of the line used by the corresponding track section")
    track_number: int = Field(description="Number corresponding to the track used", ge=0)
    track_name: NonBlankStr = Field(description="Name corresponding to the track used")


@register_extension(object=OperationalPoint, name="sncf")
class OperationalPointSncfExtension(BaseModel):
    ci: int = Field(description="THOR immutable code of the operational point")
    ch: constr(min_length=1, max_length=2) = Field(description="THOR site code of the operational point")
    ch_short_label: NonBlankStr = Field(description="THOR site code short label of the operational point")
    ch_long_label: NonBlankStr = Field(description="THOR site code long label of the operational point")
    trigram: constr(min_length=1, max_length=3) = Field(description="Unique SNCF trigram of the operational point")


@register_extension(object=OperationalPoint, name="identifier")
class OperationalPointIdentifierExtension(BaseModel):
    name: NonBlankStr = Field(description="Name of the operational point")
    uic: int = Field(description="International Union of Railways code of the operational point")


@register_extension(object=Switch, name="sncf")
class SwitchSncfExtension(BaseModel):
    label: NonBlankStr = Field(description="Identifier of the switch")


@register_extension(object=Signal, name="sncf")
class SignalSncfExtension(BaseModel):
    angle_geo: float = Field(0, description="Geographic angle in degrees")
    angle_sch: float = Field(0, description="Schematic angle in degrees")
    aspects: List[str]
    comment: str
    default_aspect: str = Field(description="Aspect displayed when no train is around")
    installation_type: str
    is_in_service: bool = Field(description="Precise if the signal is in service")
    is_lightable: bool = Field(description="Precise if the signal is lightable")
    is_operational: bool = Field(description="Precise if the signal is operational")
    label: str
    side: Side = Field(Side.CENTER, description="Side of the signal on the track")
    support_type: str
    type_code: str
    value: str


@register_extension(object=SpeedSection, name="lpv_sncf")
class SpeedSectionLpvSncfExtension(BaseModel):
    announcement: List[Panel] = Field(description="Precise the value(s) of the speed")
    z: Panel = Field(description="Beginning of the lpv speedsection")
    r: List[Panel] = Field(description="End of the lpv speedsection")
