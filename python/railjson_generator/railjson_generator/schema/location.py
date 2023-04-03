from dataclasses import dataclass

from railjson_generator.schema.infra.track_section import TrackSection


@dataclass
class Location:
    track_section: TrackSection
    offset: float

    def format(self):
        return {
            "track_section": self.track_section.label,
            "offset": self.offset,
        }
