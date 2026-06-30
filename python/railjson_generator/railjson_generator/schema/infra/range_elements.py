from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from osrd_schemas import models

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
        return models.Slope(gradient=self.gradient, begin=self.begin, end=self.end)


class Curve(RangeElement):
    radius: float

    def __init__(self, begin, end, radius):
        super().__init__(begin, end)
        self.radius = radius

    def to_rjs(self):
        return models.Curve(radius=self.radius, begin=self.begin, end=self.end)


class LoadingGaugeLimit(RangeElement):
    category: models.LoadingGaugeType

    def __init__(self, begin, end, category):
        super().__init__(begin, end)
        self.category = category

    def to_rjs(self):
        return models.LoadingGaugeLimit(
            category=self.category, begin=self.begin, end=self.end
        )


@dataclass
class TrackRange(RangeElement):
    track: "TrackSection"

    def to_rjs(self):
        return models.TrackRange(track=self.track.id, begin=self.begin, end=self.end)


@dataclass
class DirectionalTrackRange(TrackRange):
    direction: Direction

    # In osrd_schemas's generated models, DirectionalTrackRange no longer subclasses
    # TrackRange (it's a standalone model), so this override returns a type unrelated to the
    # base to_rjs (infra.TrackRange). The incompatible override is intentional.
    def to_rjs(self):  # pyright: ignore[reportIncompatibleMethodOverride]
        return models.DirectionalTrackRange(
            track=self.track.id,
            direction=models.Direction[self.direction.name],
            begin=self.begin,
            end=self.end,
        )


@dataclass
class ApplicableDirectionsTrackRange(TrackRange):
    applicable_directions: ApplicableDirection

    # Same as DirectionalTrackRange: the generated ApplicableDirectionsTrackRange is a
    # standalone model and no longer subclasses TrackRange, so this override intentionally
    # returns a type unrelated to the base to_rjs (infra.TrackRange).
    def to_rjs(self):  # pyright: ignore[reportIncompatibleMethodOverride]
        return models.ApplicableDirectionsTrackRange(
            track=self.track.id,
            applicable_directions=models.ApplicableDirections[
                self.applicable_directions.name
            ],
            begin=self.begin,
            end=self.end,
        )
