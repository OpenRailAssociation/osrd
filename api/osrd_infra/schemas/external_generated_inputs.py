from typing import List

from pydantic import BaseModel, Field

from .infra import TrackRange


class ElectricalProfile(BaseModel):
    """This class is used to define the electrical profile of a track section.
    There should be one value per power class, on every electrified track."""

    value: str = Field(description="Category of power loss along the range")
    power_class: str = Field(description="Category of rolling stock power usage this profile applies to")
    track_ranges: List[TrackRange] = Field(description="List of locations where this profile is applied")


class ElectricalProfilesList(BaseModel):
    """This class is used for storage schema validation."""

    __root__: List[ElectricalProfile]


if __name__ == "__main__":
    print(ElectricalProfile.schema_json(indent=4))
