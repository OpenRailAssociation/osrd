from dataclasses import dataclass, field
from typing import List

from railjson_generator.schema.infra.range_elements import TrackRange

from osrd_schemas import external_generated_inputs


@dataclass
class ElectricalProfile:
    value: str
    power_class: str
    track_ranges: List[TrackRange] = field(default_factory=list)

    def add_track_range(self, track, begin, end):
        self.track_ranges.append(TrackRange(track=track, begin=begin, end=end))

    def to_rjs(self):
        return external_generated_inputs.ElectricalProfile(
            value=self.value,
            power_class=self.power_class,
            track_ranges=[track_range.to_rjs() for track_range in self.track_ranges],
        )


@dataclass
class ExternalGeneratedInputs:
    electrical_profiles: List[ElectricalProfile] = field(default_factory=list)

    def add_electrical_profile(self, *args, **kwargs) -> ElectricalProfile:
        self.electrical_profiles.append(ElectricalProfile(*args, **kwargs))
        return self.electrical_profiles[-1]

    def save(self, path):
        with open(path, "w") as f:
            f.write(self.to_rjs().json(indent=2))

    def to_rjs(self):
        return external_generated_inputs.ElectricalProfileSet(
            levels=[profile.to_rjs() for profile in self.electrical_profiles],
            level_order={
                "25000": ["25000", "22500", "20000"],
            },
        )
