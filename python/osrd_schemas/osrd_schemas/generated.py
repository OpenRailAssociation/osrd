from typing import Annotated, Literal, Tuple, Union

from pydantic import BaseModel, Field

from .infra import Identifier


class ObjectReference(BaseModel):
    id: Identifier = Field(description="Identifier of the referenced object")
    type: str = Field(description="Type of the attribute of the referenced object")


# TRAITS
class InfraErrorTrait(BaseModel):
    is_warning: Literal[False] = Field(default=False)
    obj_id: str = Field(
        description="Identifier of the object that caused the error", max_length=255
    )
    obj_type: str = Field(
        description="Type of the object that caused the error", max_length=32
    )
    field: str = Field(
        description="Field of the object that caused the error", max_length=255
    )


class InfraWarningTrait(BaseModel):
    is_warning: Literal[True] = Field(default=True)
    obj_id: str = Field(
        description="Identifier of the object that caused the warning", max_length=255
    )
    obj_type: str = Field(
        description="Type of the object that caused the warning", max_length=32
    )
    field: str = Field(
        description="Field of the object that caused the warning", max_length=255
    )


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
    error_type: Literal["object_outside_of_path"] = Field(
        default="object_outside_of_path"
    )
    reference: ObjectReference


class InvalidRoute(InfraErrorTrait):
    error_type: Literal["invalid_route"] = Field(default="invalid_route")


class NodeEndpointsNotUnique(InfraErrorTrait):
    error_type: Literal["node_endpoints_not_unique"] = Field(
        default="node_endpoints_not_unique"
    )


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


class MissingBufferStop(InfraWarningTrait):
    error_type: Literal["missing_buffer_stop"] = Field(default="missing_buffer_stop")


class OddBufferStopLocation(InfraWarningTrait):
    error_type: Literal["odd_buffer_stop_location"] = Field(
        default="odd_buffer_stop_location"
    )


class OverlappingSpeedSections(InfraWarningTrait):
    error_type: Literal["overlapping_speed_sections"] = Field(
        default="overlapping_speed_sections"
    )
    reference: ObjectReference


class OverlappingElectrifications(InfraWarningTrait):
    error_type: Literal["overlapping_electrifications"] = Field(
        default="overlapping_electrifications"
    )
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
        MissingBufferStop,
        NodeEndpointsNotUnique,
        ObjectOutOfPath,
        OddBufferStopLocation,
        OutOfRange,
        OverlappingElectrifications,
        OverlappingSpeedSections,
        OverlappingSwitches,
        UnknownPortName,
        UnusedPort,
    ],
    Field(discriminator="error_type"),
]
