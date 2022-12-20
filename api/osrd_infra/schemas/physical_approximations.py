from enum import Enum
from typing import List

from pydantic import BaseModel, Field

from .infra import TrackRange


class ElectricProfileValue(str, Enum):
    """The different values of electric profiles.
    The electric profile system is specific to SNCF and so are those values.
    The values correspond to categories of power loss along the track.
    """

    L_O = "O"
    L_A = "A"
    L_A1 = "A1"
    L_B = "B"
    L_B1 = "B1"
    L_C = "C"
    L_D = "D"
    L_E = "E"
    L_F = "F"
    L_G = "G"
    L_H = "H"
    L_I = "I"
    V_0 = "00"
    V_20k = "20000"
    V_22k5 = "22500"
    V_25k = "25000"


class PowerClass(int, Enum):
    """The different power classes defined by the SNCF model.
    The classes correspond to categories of rolling stock power usage."""

    PRECL1 = 1
    PRECL2 = 2
    PRECL3 = 3
    PRECL4 = 4
    PRECL5 = 5


class ElectricProfile(BaseModel):
    """This class is used to define the electric profile of a track section.
    There should be one value per power class, on every electrified track."""

    value: ElectricProfileValue = Field(description="Category of power loss along the range")
    power_class: PowerClass = Field(description="Category of rolling this profile applies to")
    track_ranges: List[TrackRange] = Field(description="List of locations where this profile is applied")


class ElectricProfilesList(BaseModel):
    """This class is used for storage schema validation."""
    __root__: List[ElectricProfile]


if __name__ == "__main__":
    print(ElectricProfile.schema_json(indent=4))
