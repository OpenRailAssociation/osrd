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


# Warnings
class EmptyObject(InfraWarningTrait):
    error_type: Literal["empty_object"] = Field(default="empty_object")


# Generic error
class InfraError(BaseModel):
    __root__: Union[InvalidReference, OutOfRange, EmptyObject] = Field(discriminator="error_type")
