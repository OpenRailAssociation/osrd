from dataclasses import dataclass, field
from os import PathLike
from typing import List

from osrd_schemas import external_generated_inputs

from railjson_generator.schema.infra.range_elements import TrackRange
from railjson_generator.schema.infra.track_section import TrackSection


@dataclass
class ElectricalProfile:
    value: str
    power_class: str
    track_ranges: List[TrackRange] = field(default_factory=list)

    def add_track_range(self, track: TrackSection, begin: float, end: float):
        """Build a track range and add it to the profile."""
        self.track_ranges.append(TrackRange(track=track, begin=begin, end=end))

    def to_rjs(self):
        """Return the corresponding railjson object."""
        return external_generated_inputs.ElectricalProfile(
            value=self.value,
            power_class=self.power_class,
            track_ranges=[track_range.to_rjs() for track_range in self.track_ranges],
        )


@dataclass
class ExternalGeneratedInputs:
    electrical_profiles: List[ElectricalProfile] = field(default_factory=list)

    def add_electrical_profile(self, *args, **kwargs) -> ElectricalProfile:
        """Build an electrical profile, add it to the inputs, and return it."""
        self.electrical_profiles.append(ElectricalProfile(*args, **kwargs))
        return self.electrical_profiles[-1]

    def save(self, path: PathLike):
        """Write to the path as railjson."""
        with open(path, "w") as f:
            f.write(self.to_rjs().model_dump_json(indent=2))

    def to_rjs(self):
        """Return the corresponding railjson `ElectricalProfileSet`."""
        return external_generated_inputs.ElectricalProfileSet(
            levels=[profile.to_rjs() for profile in self.electrical_profiles],
            level_order={
                "25000V": ["25000V", "22500V", "20000V"],
            },
        )
