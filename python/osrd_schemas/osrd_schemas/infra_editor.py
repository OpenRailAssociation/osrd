from enum import Enum
from typing import List, Literal, Union

from pydantic import BaseModel, Field, RootModel

from . import infra


class SignalingSystem(str, Enum):
    bal = "BAL"
    bapr = "BAPR"
    tmv = "TVM"


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

    signaling_system: Literal["BAL"] = Field(default="BAL")
    settings: Settings = Field(description="BAL signal settings")


class BaprSystem(BaseLogicalSignal):
    class Settings(BaseModel):
        Nf: FlagSignalParameter = Field(description="Is the signal non-passable")
        distant: FlagSignalParameter = Field(description="Is it a distant signal")

    signaling_system: Literal["BAPR"] = Field(default="BAPR")
    settings: Settings = Field(description="BAPR signal settings")


class TvmSystem(BaseLogicalSignal):
    class Settings(BaseModel):
        is_430: FlagSignalParameter = Field(description="Is it TVM-430")

    signaling_system: Literal["TVM"] = Field(default="TVM")
    settings: Settings = Field(description="TVM signal settings")


class LimitedLogicalSignal(RootModel):
    """Limited list of logical signals. Used to generate a usable schema for the front editor"""

    root: Union[BalSystem, BaprSystem, TvmSystem] = Field(..., discriminator="signaling_system")


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
