import schemas
from dataclasses import dataclass


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
        return schemas.Slope(
            gradient=self.gradient,
            begin=self.begin,
            end=self.end
        )


class Curve(RangeElement):
    radius: float

    def __init__(self, begin, end, radius):
        super().__init__(begin, end)
        self.radius = radius

    def to_rjs(self):
        return schemas.Curve(
            radius=self.radius,
            begin=self.begin,
            end=self.end
        )


class SpeedSection(RangeElement):
    max_speed: float

    def __init__(self, begin, end, max_speed):
        super().__init__(begin, end)
        self.max_speed = max_speed

    def to_rjs(self):
        return schemas.SpeedSection(
            speed=self.max_speed,
            begin=self.begin,
            end=self.end,
            applicable_directions=schemas.ApplicableDirections.BOTH
        )
