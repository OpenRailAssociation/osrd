from enum import Enum
from typing import Any, List, Literal, Union

from pydantic import BaseModel, Field, RootModel

from . import infra
from .infra import Identifier


class SignalingSystem(str, Enum):
    bal = "BAL"
    bapr = "BAPR"
    tvm300 = "TVM300"
    tvm430 = "TVM430"
    etcsLevel2 = "ETCS_LEVEL2"


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
        jaune_cli: FlagSignalParameter = Field(
            description="Is the signal yellow blinking"
        )

    class ConditionalParameters(BaseModel):
        on_route: Identifier = Field(
            description="Route for which those parameters are active"
        )
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
        on_route: Identifier = Field(
            description="Route for which those parameters are active"
        )
        parameters: "BaprSystem.Parameters" = Field(
            description="BAPR signal parameters"
        )

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
        on_route: Identifier = Field(
            description="Route for which those parameters are active"
        )
        parameters: "Tvm300System.Parameters" = Field(
            description="TVM300 signal parameters"
        )

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
        on_route: Identifier = Field(
            description="Route for which those parameters are active"
        )
        parameters: "Tvm430System.Parameters" = Field(
            description="TVM430 signal parameters"
        )

    signaling_system: Literal["TVM430"] = Field(default="TVM430")
    settings: Settings = Field(description="TVM signal settings")
    default_parameters: Parameters = Field(description="TVM signal parameters")
    conditional_parameters: List[ConditionalParameters] = Field(
        description="TVM signal parameters for specific routes", default_factory=list
    )


class EtcsLevel2System(BaseLogicalSignal):
    class Settings(BaseModel):
        Nf: FlagSignalParameter = Field(description="Is the signal non-passable")

    class Parameters(BaseModel):
        pass

    class ConditionalParameters(BaseModel):
        on_route: Identifier = Field(
            description="Route for which those parameters are active"
        )
        parameters: "EtcsLevel2System.Parameters" = Field(
            description="ETCS_LEVEL2 signal parameters"
        )

    signaling_system: Literal["ETCS_LEVEL2"] = Field(default="ETCS_LEVEL2")
    settings: Settings = Field(description="ETCS_LEVEL2 signal settings")
    default_parameters: Parameters = Field(description="ETCS_LEVEL2 signal parameters")
    conditional_parameters: List[ConditionalParameters] = Field(
        description="ETCS_LEVEL2 signal parameters for specific routes",
        default_factory=list,
    )


class LimitedLogicalSignal(RootModel):
    """Limited list of logical signals. Used to generate a usable schema for the front editor"""

    root: Union[BalSystem, BaprSystem, Tvm300System, Tvm430System, EtcsLevel2System] = (
        Field(..., discriminator="signaling_system")
    )


class _TmpSignal(BaseModel):
    logical_signals: List[LimitedLogicalSignal] = Field(
        description="Logical signals bundled into this physical signal",
        default_factory=list,
    )


def make_extensions_non_nullable(schema: dict):
    """This is required in order not to make the front weird."""
    for name, definition in schema["$defs"].items():
        if not name.endswith("Extensions"):
            continue

        new_properties = {}
        for prop_name, prop_def in definition["properties"].items():
            new_properties[prop_name] = {
                "default": None,
                "$ref": prop_def["anyOf"][0]["$ref"],
            }

        definition["properties"] = new_properties


if __name__ == "__main__":
    import argparse
    import re
    from json import dumps

    parser = argparse.ArgumentParser(
        description="Generate the infra editor railjson schema."
    )
    parser.add_argument(
        "--translation",
        action="store_true",
        help="Generate the infra editor English translation json instead.",
    )
    args = parser.parse_args()

    railjson_schema = infra.RailJsonInfra.model_json_schema()
    tmp_signal_schema = _TmpSignal.model_json_schema()
    railjson_schema["$defs"].update(tmp_signal_schema["$defs"])
    railjson_schema["$defs"]["Signal"]["properties"].update(
        tmp_signal_schema["properties"]
    )

    make_extensions_non_nullable(railjson_schema)

    if not args.translation:
        # sort keys in order to diff correctly in the CI
        print(dumps(railjson_schema, indent=4, sort_keys=True))

    else:

        def normalize_title_case(title: str):
            """
            Convert PascalCase, camelCase or Multi Capital Case to Displayable single capital case.
            Keep acronyms as is.
            """
            words = re.sub(
                r"(?:(?<=[a-z])(?=[A-Z])|(?<=[^\s])(?=[A-Z][a-z]))", " ", title
            ).split()
            return " ".join(
                [words[0]]
                + [
                    word[0].lower() + word[1:]
                    if len(word) > 1 and word[1].islower()
                    else word
                    for word in words[1:]
                ]
            )

        def to_translation_schema(json_node: dict[str, Any]):
            """
            Recursively walk, filter and format railjson to adapt it to translations.

            Only title and description fields need translation.
            All other fields, as well as all arrays and empty objects, can be dropped.
            """
            new_node = {}
            for key, value in json_node.items():
                if key == "description" and isinstance(value, str):
                    new_node[key] = value
                elif key == "title" and isinstance(value, str):
                    new_node[key] = normalize_title_case(value)
                elif isinstance(value, dict) and len(value) > 0:
                    processed_value = to_translation_schema(value)
                    if processed_value:
                        new_node[key] = processed_value
            return new_node if new_node else None

        # Keep the properties field and merge $defs subfields into the top level to match expected structure,
        # discard all other top level fields
        translation_json = {"properties": railjson_schema.get("properties", {})}
        translation_json.update(railjson_schema.get("$defs", {}))

        print(dumps(to_translation_schema(translation_json), indent=2, sort_keys=True))
