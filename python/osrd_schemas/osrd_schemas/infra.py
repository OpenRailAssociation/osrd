from enum import Enum
from itertools import product
from typing import Annotated, List, Literal, Mapping, Optional, Type, Union, get_args

from geojson_pydantic import LineString
from pydantic import BaseModel, Field, StringConstraints, create_model, model_validator
from pydantic.fields import FieldInfo

ALL_OBJECT_TYPES = []

RAILJSON_INFRA_VERSION_TYPE = Literal["3.4.12"]
RAILJSON_INFRA_VERSION = get_args(RAILJSON_INFRA_VERSION_TYPE)[0]

# Traits
# Used as an input model in the definition of the following classes.

Identifier = Annotated[str, StringConstraints(min_length=1, max_length=255)]
NonBlankStr = Annotated[str, StringConstraints(min_length=1)]


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
    """

    geo: LineString = Field(description="Geographic coordinates of the corresponding object")


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

    @model_validator(mode="after")
    def check_range(self):
        assert self.begin <= self.end, "expected: begin <= end"
        return self

    def length(self) -> float:
        return abs(self.begin - self.end)

    def overlaps(self, other: "TrackRange") -> bool:
        """
        Returns true if the two track ranges overlap.
        """
        return self.track == other.track and self.begin < other.end and other.begin < self.end


class DirectionalTrackRange(TrackRange):
    """
    A directional track range is a track range with an associated direction.
    """

    direction: Direction = Field(description="Description of the direction")

    @staticmethod
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

    @model_validator(mode="after")
    def check_range(self):
        assert self.begin < self.end, "expected: begin < end"
        return self


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

    @classmethod
    def from_strs(cls, src: str, dst: str):
        return cls(src=src, dst=dst)


class SwitchType(BaseObjectTrait):
    """
    Switch types are used to define what kind of switch is used in the infrastructure.
    A switch type is defined by a list of ports and groups which are the possible configurations of the switch.
    """

    ports: List[Identifier] = Field(min_length=1, description="List of ports. Ports map to the ends of switches")
    groups: Mapping[Identifier, List[SwitchPortConnection]] = Field(
        description="Connection between and according ports"
    )

    @classmethod
    def new(cls, id: Identifier, ports: List[Identifier], groups: Mapping[Identifier, List[SwitchPortConnection]]):
        return cls(id=id, ports=ports, groups=groups)

    @classmethod
    def from_strs(cls, id: str, ports: List[str], groups: Mapping[str, List[SwitchPortConnection]]):
        return cls(
            id=id,
            ports=[e for e in ports],
            groups={k: v for k, v in groups.items()},
        )

    def to_dict(self):
        groups_dict = {}
        for group_id, group_connections in self.groups.items():
            connections_list = []
            for connection in group_connections:
                connections_list.append({"src": connection.src, "dst": connection.dst})
            groups_dict[group_id] = connections_list

        return {self.id: {"ports": self.ports, "groups": groups_dict}}


class Switch(BaseObjectTrait):
    """
    Switches are devices used for track changes.
    """

    switch_type: Identifier = Field(description="Identifier and type of the switch type")
    group_change_delay: float = Field(
        description="Time it takes to change which group of the switch is activated", ge=0
    )
    ports: Mapping[Identifier, TrackEndpoint] = Field(
        description="Location of different ports according to track sections"
    )


class SpeedSection(BaseObjectTrait):
    """
    Speed sections are recognized by their identifiers and are in meters per second.
    """

    speed_limit: Optional[float] = Field(
        description="Speed limit (m/s) applied by default to trains that aren't in any specified category",
        gt=0,
        default=None,
    )
    speed_limit_by_tag: Mapping[NonBlankStr, float] = Field(
        description="Speed limit (m/s) applied to trains with a given tag"
    )
    track_ranges: List[ApplicableDirectionsTrackRange] = Field(
        description="List of locations where speed section is applied"
    )
    on_routes: Optional[List[Identifier]] = Field(
        description="""A list of routes the speed limit is enforced on.
When empty or None, the speed limit is enforced regardless of the route.""",
        default=None,
    )


class Electrification(BaseObjectTrait):
    """
    An electrification corresponds to a set of cables designed to power
    electric trains by capturing the current through the use
    of a pantograph. Electrification is identified by its identifier.
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

    @model_validator(mode="after")
    def check_range(self):
        assert self.begin < self.end, "expected: begin < end"
        return self


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

    @model_validator(mode="after")
    def check_range(self):
        assert self.begin < self.end, "expected: begin < end"
        return self


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
    A track section is identified by his unique id and its coordinates (geographic).
    """

    length: float = Field(description="Value of the length of the track section in meters", gt=0)
    slopes: List[Slope] = Field(description="List of slopes of corresponding track section")
    curves: List[Curve] = Field(description="List of curves of corresponding track section")
    loading_gauge_limits: List[LoadingGaugeLimit] = Field(
        default_factory=list, description="List of loading gauge limits of corresponding track section"
    )


class ConditionalParameter(BaseModel):
    on_route: Identifier = Field(description="Route on which the parameters are applied")
    parameters: Mapping[NonBlankStr, NonBlankStr] = Field(
        description="List of key value parameters, which are defined per signaling system"
    )


class LogicalSignal(BaseModel):
    """A logical signal is what displays something, whereas a physical signal is a group of logical signals"""

    signaling_system: str = Field(description="The signal's output signaling system")
    next_signaling_systems: List[str] = Field(description="The list of allowed input signaling systems")
    settings: Mapping[NonBlankStr, NonBlankStr] = Field(
        description="A list of key value parameters, which are defined per signaling system"
    )
    default_parameters: Mapping[NonBlankStr, NonBlankStr] = Field(
        description="A list of default parameters (in regards to routes), which are defined per signaling system"
    )
    conditional_parameters: List[ConditionalParameter] = Field(
        description="A list of conditional parameters, which are defined per signaling system"
    )


class Signal(BaseObjectTrait, TrackLocationTrait):
    """This class is used to describe the signal.
    A signal is characterized by its id and its corresponding track.
    By default, the signal is located at the center of the track.
    """

    direction: Direction = Field(description="Direction of use of the signal")
    sight_distance: float = Field(description="Visibility distance of the signal in meters", ge=0)
    logical_signals: List[LogicalSignal] = Field(
        description="Logical signals bundled into this physical signal", default_factory=list
    )


class BufferStop(BaseObjectTrait, TrackLocationTrait):
    """This class defines the buffer stop object.
    A buffer stop is a device placed at the end of a dead-end road
    to stop any drifting trains from continuing off the road.
    A buffer stop is characterized by its id and its corresponding track.
    """

    def ref(self):
        return BufferStopReference(type="BufferStop", id=self.id)


class Detector(BaseObjectTrait, TrackLocationTrait):
    """This class defines detector object.
    A detector is characterized by its id and its corresponding track.
    A detector is used to locate a train
    in order to consider the section as occupied when there is a train.
    """

    def ref(self):
        return DetectorReference(type="Detector", id=self.id)


class Sign(TrackLocationTrait):
    """This class is used to define signs.
    This is a physical, punctual, cosmetic object.
    """

    side: Side = Field(Side.CENTER, description="Side of the sign on the track")
    direction: Direction = Field(Direction.START_TO_STOP, description="Direction of the sign on the track")
    type: NonBlankStr = Field(description="Precise the type of the sign")
    value: str = Field(description="If the sign is an announcement, precise the value(s)", default="")
    kp: str = Field(description="Kilometric point of the sign", default="")


class NeutralSection(BaseObjectTrait):
    """
    Neutral sections are portions of track where trains aren't allowed to pull power from electrifications.
    They have to rely on inertia to cross such sections.

    In practice, neutral sections are delimited by signs. In OSRD, neutral sections are directional
    to allow accounting for different sign placement depending on the direction.

    For more details see [the documentation](https://osrd.fr/en/docs/explanation/neutral_sections/).
    """

    announcement_track_ranges: List[DirectionalTrackRange] = Field(
        description="List of locations where the upcoming neutral section is announced but not yet crossed",
        default_factory=list,
    )
    track_ranges: List[DirectionalTrackRange] = Field(
        description="List of locations where the train cannot pull power from electrifications",
        min_length=1,
    )
    lower_pantograph: bool = Field(description="Whether or not trains need to lower their pantograph in the section")

    @model_validator(mode="after")
    def check_no_overlap(self):
        for tr, atr in product(self.track_ranges, self.announcement_track_ranges):
            assert not tr.overlaps(atr), "track_ranges and announcement_track_ranges should not overlap"
        return self


class RailJsonInfra(BaseModel):
    """This class is used to build an infra."""

    version: RAILJSON_INFRA_VERSION_TYPE = Field(default=RAILJSON_INFRA_VERSION, description="Version of the schema")
    operational_points: List[OperationalPoint] = Field(
        description="List of operational points of the corresponding infra"
    )
    routes: List[Route] = Field(description="Routes of the infra")
    extended_switch_types: List[SwitchType] = Field(
        default=[], description="Switch types of the infra that can be added by the user"
    )
    switches: List[Switch] = Field(description="Switches of the infra")
    track_sections: List[TrackSection] = Field(description="Track sections of the infra")
    speed_sections: List[SpeedSection] = Field(description="Speed sections of the infra")
    electrifications: List[Electrification] = Field(description="Electrifications of the infra")
    signals: List[Signal] = Field(description="Signals of the infra")
    buffer_stops: List[BufferStop] = Field(description="Buffer stops of the infra")
    detectors: List[Detector] = Field(description="Detectors of the infra")
    neutral_sections: List[NeutralSection] = Field(description="Neutral sections of the infra")


for t in BaseObjectTrait.__subclasses__():
    ALL_OBJECT_TYPES.append(t)

# Extensions


def register_extension(object: Type[BaseModel], name):
    """
    This decorator is used to easily add an extension to an existing object.
    Example:

    ```
    @register_extension(TrackSection, "my_extension")
    class TrackSectionMyExtension(BaseModel):
        ...
    ```

    This will add the optional dictionary field `extensions` to the `TrackSection` class.
    This dictionary can contain the field `my_extension` of type `TrackSectionMyExtension`.
    """

    if "extensions" not in object.model_fields:
        extensions_type = create_model(object.__name__ + "Extensions")
        extensions_type.__pydantic_parent_namespace__ = object.__pydantic_parent_namespace__
        object.model_fields["extensions"] = FieldInfo(
            annotation=extensions_type,
            default=None,
        )

    def register_extension(extension):
        extensions_field = object.model_fields["extensions"]
        assert extensions_field.annotation is not None and issubclass(extensions_field.annotation, BaseModel)
        if name in extensions_field.annotation.model_fields:
            raise RuntimeError(f"Extension '{name}' already registered for {object.__name__}")

        extensions_field.annotation.model_fields[name] = FieldInfo(
            annotation=extension,
            default=None,
        )
        return extension

    return register_extension


@register_extension(object=TrackSection, name="sncf")
class TrackSectionSncfExtension(BaseModel):
    line_code: int = Field(description="Code of the line used by the corresponding track section")
    line_name: NonBlankStr = Field(description="Name of the line used by the corresponding track section")
    track_number: int = Field(description="Number corresponding to the track used", ge=0)
    track_name: NonBlankStr = Field(description="Name corresponding to the track used")


@register_extension(object=TrackSection, name="source")
class TrackSectionSourceExtension(BaseModel):
    name: str = Field(description="Name of the source")
    id: str = Field(description="ID used for the line in the source")


@register_extension(object=OperationalPoint, name="sncf")
class OperationalPointSncfExtension(BaseModel):
    ci: int = Field(description="THOR immutable code of the operational point")
    ch: str = Field(description="THOR site code of the operational point", min_length=1, max_length=2)
    ch_short_label: NonBlankStr = Field(description="THOR site code short label of the operational point")
    ch_long_label: NonBlankStr = Field(description="THOR site code long label of the operational point")
    trigram: str = Field(description="Unique SNCF trigram of the operational point", min_length=1, max_length=3)


@register_extension(object=OperationalPointPart, name="sncf")
class OperationalPointPartSncfExtension(BaseModel):
    kp: str = Field(description="Kilometric point of the operational point part")


@register_extension(object=OperationalPoint, name="identifier")
class OperationalPointIdentifierExtension(BaseModel):
    name: NonBlankStr = Field(description="Name of the operational point")
    uic: int = Field(description="International Union of Railways code of the operational point")


@register_extension(object=Switch, name="sncf")
class SwitchSncfExtension(BaseModel):
    label: NonBlankStr = Field(description="Identifier of the switch")


@register_extension(object=Signal, name="sncf")
class SignalSncfExtension(BaseModel):
    label: str
    side: Side = Field(Side.CENTER, description="Side of the signal on the track")
    kp: str = Field(description="Kilometric point of the signal")


@register_extension(object=SpeedSection, name="psl_sncf")
class SpeedSectionPslSncfExtension(BaseModel):
    announcement: List[Sign] = Field(description="Precise the value(s) of the speed")
    z: Sign = Field(description="Beginning of the psl speed section")
    r: List[Sign] = Field(description="End of the psl speed section")


@register_extension(object=NeutralSection, name="neutral_sncf")
class NeutralSectionNeutralSncfExtension(BaseModel):
    announcement: List[Sign] = Field(description="Precise that there is bp/cc neutral section")
    exe: Sign = Field(description="Beginning of the bp/cc neutral section")
    end: List[Sign] = Field(description="End of the bp/cc neutral section")
    rev: List[Sign] = Field(description="REV of the bp/cc neutral section")


@register_extension(object=BufferStop, name="sncf")
class BufferStopSncfExtension(BaseModel):
    kp: str = Field(description="Kilometric point of the buffer stop")


@register_extension(object=Detector, name="sncf")
class DetectorSncfExtension(BaseModel):
    kp: str = Field(description="Kilometric point of the detector")


def recursively_rebuild(model: Type[BaseModel]):
    for field in model.model_fields.values():
        if field.annotation is None:
            continue
        try:
            child_model = get_args(field.annotation)[0]
        except (TypeError, IndexError):
            child_model = field.annotation
        if isinstance(child_model, type) and issubclass(child_model, BaseModel):
            recursively_rebuild(child_model)
    model.model_rebuild(force=True)


# Needed since we dynamically created classes
recursively_rebuild(RailJsonInfra)


if __name__ == "__main__":
    from json import dumps

    # sort keys in order to diff correctly in the CI
    print(dumps(RailJsonInfra.model_json_schema(), indent=4, sort_keys=True))
