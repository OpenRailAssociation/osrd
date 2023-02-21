from typing import Annotated, Literal, Tuple, Union

from pydantic import BaseModel, Field, constr

from .infra import Identifier


class ObjectReference(BaseModel):
    id: Identifier = Field(description="Identifier of the referenced object")
    type: str = Field(description="Type of the attribute of the referenced object")


# TRAITS
class InfraErrorTrait(BaseModel):
    is_warning: Literal[False] = Field(default=False)
    obj_id: constr(max_length=255) = Field(description="Identifier of the object that caused the error")
    obj_type: constr(max_length=32) = Field(description="Type of the object that caused the error")
    field: constr(max_length=255) = Field(description="Field of the object that caused the error")


class InfraWarningTrait(BaseModel):
    is_warning: Literal[True] = Field(default=True)
    obj_id: constr(max_length=255) = Field(description="Identifier of the object that caused the warning")
    obj_type: constr(max_length=32) = Field(description="Type of the object that caused the warning")
    field: constr(max_length=255) = Field(description="Field of the object that caused the warning")


# Errors
class InvalidReference(InfraErrorTrait):
    error_type: Literal["invalid_reference"] = Field(default="invalid_reference")
    reference: ObjectReference


class InvalidGroup(InfraErrorTrait):
    error_type: Literal["invalid_group"] = Field(default="invalid_group")
    group: str
    switch_type: str


class OutOfRange(InfraErrorTrait):
    error_type: Literal["out_of_range"] = Field(default="out_of_range")
    position: float
    expected_range: Tuple[float, float]


class ObjectOutOfPath(InfraErrorTrait):
    error_type: Literal["object_out_of_path"] = Field(default="object_outside_of_path")
    reference: ObjectReference


class InvalidRoute(InfraErrorTrait):
    error_type: Literal["invalid_route"] = Field(default="invalid_route")


class PathDoesNotMatchEndpoints(InfraErrorTrait):
    error_type: Literal["path_does_not_match_endpoints"] = Field(default="path_does_not_match_endpoints")
    expected_track: str
    expected_position: float
    endpoint_field: Union[Literal["entry_point"], Literal["exit_point"]]


class UnknownPortName(InfraErrorTrait):
    error_type: Literal["unknown_port_name"] = Field(default="unknown_port_name")
    port_name: str


class InvalidSwitchPorts(InfraErrorTrait):
    error_type: Literal["invalid_switch_ports"] = Field(default="invalid_switch_ports")


class OverlappingSwitches(InfraErrorTrait):
    error_type: Literal["overlapping_switches"] = Field(default="overlapping_switches")
    reference: ObjectReference


# Warnings
class EmptyObject(InfraWarningTrait):
    error_type: Literal["empty_object"] = Field(default="empty_object")


class MissingRoute(InfraWarningTrait):
    error_type: Literal["missing_route"] = Field(default="missing_route")


class UnusedPort(InfraWarningTrait):
    error_type: Literal["unused_port"] = Field(default="unused_port")
    port_name: str


class DuplicatedGroup(InfraWarningTrait):
    error_type: Literal["duplicated_group"] = Field(default="duplicated_group")
    original_group_path: str


class NoBufferStop(InfraWarningTrait):
    error_type: Literal["no_buffer_stop"] = Field(default="no_buffer_stop")


class OverlappingTrackLinks(InfraWarningTrait):
    error_type: Literal["overlapping_track_links"] = Field(default="overlapping_track_links")
    reference: ObjectReference


InfraError = Annotated[
    Union[
        DuplicatedGroup,
        EmptyObject,
        InvalidGroup,
        InvalidReference,
        InvalidRoute,
        InvalidSwitchPorts,
        MissingRoute,
        NoBufferStop,
        ObjectOutOfPath,
        OutOfRange,
        OverlappingSwitches,
        OverlappingTrackLinks,
        UnknownPortName,
        UnusedPort,
    ],
    Field(discriminator="error_type"),
]
