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

    def format(self):
        return {
            "begin": self.begin,
            "end": self.end,
            "gradient": self.gradient
        }


class Curve(RangeElement):
    radius: float

    def __init__(self, begin, end, radius):
        super().__init__(begin, end)
        self.radius = radius

    def format(self):
        return {
            "begin": self.begin,
            "end": self.end,
            "radius": self.radius
        }


class SpeedSection(RangeElement):
    max_speed: float

    def __init__(self, begin, end, max_speed):
        super().__init__(begin, end)
        self.max_speed = max_speed

    def format(self):
        return {
            "begin": self.begin,
            "end": self.end,
            "ref": str(self.max_speed),
            "applicable_direction": "BOTH"
        }
