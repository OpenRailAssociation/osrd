from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from osrd_schemas import infra

from .direction import ApplicableDirection, Direction

if TYPE_CHECKING:
    from .track_section import TrackSection


@dataclass
class RangeElement:
    begin: float
    end: float

    def __init__(self, begin, end):
        self.begin = begin
        self.end = end

    def __post_init__(self):
        if self.end < self.begin:
            self.begin, self.end = self.end, self.begin


class Slope(RangeElement):
    gradient: float

    def __init__(self, begin, end, gradient):
        super().__init__(begin, end)
        self.gradient = gradient

    def to_rjs(self):
        return infra.Slope(gradient=self.gradient, begin=self.begin, end=self.end)


class Curve(RangeElement):
    radius: float

    def __init__(self, begin, end, radius):
        super().__init__(begin, end)
        self.radius = radius

    def to_rjs(self):
        return infra.Curve(radius=self.radius, begin=self.begin, end=self.end)


@dataclass
class TrackRange(RangeElement):
    track: "TrackSection"

    def to_rjs(self):
        return infra.TrackRange(track=self.track.id, begin=self.begin, end=self.end)


@dataclass
class DirectionalTrackRange(TrackRange):
    direction: Direction

    def to_rjs(self):
        return infra.DirectionalTrackRange(
            track=self.track.id,
            direction=infra.Direction[self.direction.name],
            begin=self.begin,
            end=self.end,
        )


@dataclass
class ApplicableDirectionsTrackRange(TrackRange):
    applicable_directions: ApplicableDirection

    def to_rjs(self):
        return infra.ApplicableDirectionsTrackRange(
            track=self.track.id,
            applicable_directions=infra.ApplicableDirections[self.applicable_directions.name],
            begin=self.begin,
            end=self.end,
        )
