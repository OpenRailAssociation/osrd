from dataclasses import dataclass

from railjson_generator.schema.infra.direction import ApplicableDirection

import infra


@dataclass
class RangeElement:
    begin: float
    end: float

    def __init__(self, begin, end):
        self.begin = begin
        self.end = end


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
class ApplicableDirectionsTrackRange(RangeElement):
    track: "TrackSection"
    applicable_directions: ApplicableDirection

    def to_rjs(self):
        return infra.ApplicableDirectionsTrackRange(
            track=self.track.make_rjs_ref(),
            applicable_directions=infra.ApplicableDirections[self.applicable_directions.name],
            begin=self.begin,
            end=self.end,
        )
