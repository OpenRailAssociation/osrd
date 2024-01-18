from enum import Enum
from typing import List, Literal, Union

from pydantic import BaseModel, Field, RootModel

from . import infra
from .infra import Identifier


class SignalingSystem(str, Enum):
    bal = "BAL"
    bapr = "BAPR"
    tvm300 = "TVM300"
    tvm430 = "TVM430"


class FlagSignalParameter(str, Enum):
    true = "true"
    false = "false"


class BaseLogicalSignal(BaseModel):
    next_signaling_systems: List[SignalingSystem] = Field(
        description="The list of allowed input signaling systems", default_factory=list
    )


class BalSystem(BaseLogicalSignal):
    class Settings(BaseModel):
        Nf: FlagSignalParameter = Field(description="Is the signal non-passable")

    class Parameters(BaseModel):
        jaune_cli: FlagSignalParameter = Field(description="Is the signal yellow blinking")

    class ConditionalParameters(BaseModel):
        on_route: Identifier = Field(description="Route for which those parameters are active")
        parameters: "BalSystem.Parameters" = Field(description="BAL signal parameters")

    signaling_system: Literal["BAL"] = Field(default="BAL")
    settings: Settings = Field(description="BAL signal settings")
    default_parameters: Parameters = Field(description="BAL signal parameters")
    conditional_parameters: List[ConditionalParameters] = Field(
        description="BAL signal parameters for specific routes", default_factory=list
    )


class BaprSystem(BaseLogicalSignal):
    class Settings(BaseModel):
        Nf: FlagSignalParameter = Field(description="Is the signal non-passable")
        distant: FlagSignalParameter = Field(description="Is it a distant signal")

    class Parameters(BaseModel):
        pass

    class ConditionalParameters(BaseModel):
        on_route: Identifier = Field(description="Route for which those parameters are active")
        parameters: "BaprSystem.Parameters" = Field(description="BAPR signal parameters")

    signaling_system: Literal["BAPR"] = Field(default="BAPR")
    settings: Settings = Field(description="BAPR signal settings")
    parameters: Parameters = Field(description="BAPR signal parameters")
    conditional_parameters: List[ConditionalParameters] = Field(
        description="BAPR signal parameters for specific routes", default_factory=list
    )


class Tvm300System(BaseLogicalSignal):
    class Settings(BaseModel):
        Nf: FlagSignalParameter = Field(description="Is the signal non-passable")

    class Parameters(BaseModel):
        pass

    class ConditionalParameters(BaseModel):
        on_route: Identifier = Field(description="Route for which those parameters are active")
        parameters: "Tvm300System.Parameters" = Field(description="TVM300 signal parameters")

    signaling_system: Literal["TVM300"] = Field(default="TVM300")
    settings: Settings = Field(description="TVM signal settings")
    default_parameters: Parameters = Field(description="TVM signal parameters")
    conditional_parameters: List[ConditionalParameters] = Field(
        description="TVM signal parameters for specific routes", default_factory=list
    )


class Tvm430System(BaseLogicalSignal):
    class Settings(BaseModel):
        Nf: FlagSignalParameter = Field(description="Is the signal non-passable")

    class Parameters(BaseModel):
        pass

    class ConditionalParameters(BaseModel):
        on_route: Identifier = Field(description="Route for which those parameters are active")
        parameters: "Tvm430System.Parameters" = Field(description="TVM430 signal parameters")

    signaling_system: Literal["TVM430"] = Field(default="TVM430")
    settings: Settings = Field(description="TVM signal settings")
    default_parameters: Parameters = Field(description="TVM signal parameters")
    conditional_parameters: List[ConditionalParameters] = Field(
        description="TVM signal parameters for specific routes", default_factory=list
    )


class LimitedLogicalSignal(RootModel):
    """Limited list of logical signals. Used to generate a usable schema for the front editor"""

    root: Union[BalSystem, BaprSystem, Tvm300System, Tvm430System] = Field(..., discriminator="signaling_system")


class _TmpSignal(BaseModel):
    logical_signals: List[LimitedLogicalSignal] = Field(
        description="Logical signals bundled into this physical signal", default_factory=list
    )


if __name__ == "__main__":
    from json import dumps

    railjson_schema = infra.RailJsonInfra.model_json_schema()
    tmp_signal_schema = _TmpSignal.model_json_schema()
    railjson_schema["$defs"].update(tmp_signal_schema["$defs"])
    railjson_schema["$defs"]["Signal"]["properties"].update(tmp_signal_schema["properties"])

    # sort keys in order to diff correctly in the CI
    print(dumps(railjson_schema, indent=4, sort_keys=True))
