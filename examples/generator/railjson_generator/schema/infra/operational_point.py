from dataclasses import dataclass


@dataclass
class OperationalPoint:
    label: str

    def set_position(self, track, offset):
        op_part = OperationalPointPart(self, offset)
        track.operational_points.append(op_part)

    def format(self):
        return {"id": self.label}


@dataclass
class OperationalPointPart:
    operarational_point: OperationalPoint
    position: float

    def format(self):
        return {
            "ref": self.operarational_point.label,
            "position": self.position,
        }
