from typing import Literal, Tuple, Union

from pydantic import BaseModel, Field

from osrd_infra.schemas import infra


# TRAITS
class InfraErrorTrait(BaseModel):
    is_warning: Literal[False] = Field(default=False)
    field: str


class InfraWarningTrait(BaseModel):
    is_warning: Literal[True] = Field(default=True)
    field: str


# Errors
class InvalidReference(InfraErrorTrait):
    error_type: Literal["invalid_reference"] = Field(default="invalid_reference")
    reference: infra.ObjectReference


class OutOfRange(InfraErrorTrait):
    error_type: Literal["out_of_range"] = Field(default="out_of_range")
    position: float
    expected_range: Tuple[float, float]


class ObjectOutsideOfPath(InfraErrorTrait):
    error_type: Literal["object_outside_of_path"] = Field(default="object_outside_of_path")
    position: float
    track: str


class EmptyPath(InfraErrorTrait):
    error_type: Literal["empty_path"] = Field(default="empty_path")


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


# Generic error
class InfraError(BaseModel):
    __root__: Union[
        InvalidReference,
        OutOfRange,
        ObjectOutsideOfPath,
        EmptyPath,
        PathDoesNotMatchEndpoints,
        UnknownPortName,
        InvalidSwitchPorts,
        EmptyObject,
        MissingRoute,
        UnusedPort,
        DuplicatedGroup,
        NoBufferStop,
    ] = Field(discriminator="error_type")
