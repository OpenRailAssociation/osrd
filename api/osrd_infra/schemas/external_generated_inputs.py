from typing import Dict, List

from pydantic import BaseModel, Field

from .infra import TrackRange


class ElectricalProfile(BaseModel):
    """This class is used to model the power loss along a catenary (thus along ranges of track sections).
    There should be one value per power class, on every electrified track."""

    value: str = Field(description="Category of power loss along the range")
    power_class: str = Field(description="Category of rolling stock power usage this profile applies to")
    track_ranges: List[TrackRange] = Field(description="List of locations where this profile is applied")


class ElectricalProfileSet(BaseModel):
    """This class is used to represent a set of electrical profiles, to use in simulation along an infrastructure."""

    levels: List[ElectricalProfile] = Field(description="The list of electrical profiles")
    level_order: Dict[str, List[str]] = Field(
        description="A mapping from catenary modes to the electrical profile levels in decreasing order of magnitude"
    )


if __name__ == "__main__":
    print(ElectricalProfileSet.schema_json(indent=4))
