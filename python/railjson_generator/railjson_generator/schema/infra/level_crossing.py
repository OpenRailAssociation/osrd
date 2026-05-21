from dataclasses import dataclass
from typing import List

from osrd_schemas_auto import models


@dataclass
class LevelCrossingPart:
    pedal_upstream: int
    pedal_downstream: int
    position: float
    track: str

    def to_rjs(self):
        return models.LevelCrossingPart(
            track=self.track,
            position=self.position,
            pedal_upstream=self.pedal_upstream,
            pedal_downstream=self.pedal_downstream,
        )


@dataclass
class LevelCrossing:
    id: str
    name: str
    short_zone_length: int
    parts: List[LevelCrossingPart]

    def add_part(
        self, track: str, position: float, pedal_upstream: int, pedal_downstream: int
    ):
        part = LevelCrossingPart(
            track=track,
            position=position,
            pedal_upstream=pedal_upstream,
            pedal_downstream=pedal_downstream,
        )
        self.parts.append(part)

    def to_rjs(self):
        return models.LevelCrossing(
            id=self.id,
            name=self.name,
            short_zone_length=self.short_zone_length,
            parts=[part.to_rjs() for part in self.parts],
        )
