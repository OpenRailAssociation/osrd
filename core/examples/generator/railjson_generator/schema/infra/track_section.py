from dataclasses import dataclass, field
from typing import List, Optional, Tuple

from railjson_generator.schema.infra.direction import ApplicableDirection, Direction
from railjson_generator.schema.infra.endpoint import Endpoint, TrackEndpoint
from railjson_generator.schema.infra.link import Link
from railjson_generator.schema.infra.operational_point import OperationalPointPart
from railjson_generator.schema.infra.range_elements import Slope, Curve, SpeedSection
from railjson_generator.schema.infra.signal import Signal
from railjson_generator.schema.infra.waypoint import BufferStop, Detector, Waypoint


def _track_id():
    res = f"track.{TrackSection._INDEX}"
    TrackSection._INDEX += 1
    return res


@dataclass
class TrackSection:
    _INDEX = 0

    length: float
    label: str = field(default_factory=_track_id)
    waypoints: List[Waypoint] = field(default_factory=list)
    signals: List[Signal] = field(default_factory=list)
    operational_points: List[OperationalPointPart] = field(default_factory=list)
    index: int = field(default=-1, repr=False)
    begin_coordinates: Optional[Tuple[float, float]] = field(default=None)
    end_coordinates: Optional[Tuple[float, float]] = field(default=None)
    begining_links: List[TrackEndpoint] = field(default_factory=list, repr=False)
    end_links: List[TrackEndpoint] = field(default_factory=list, repr=False)
    slopes: List[Slope] = field(default_factory=list)
    curves: List[Curve] = field(default_factory=list)
    speed_limits: List[SpeedSection] = field(default_factory=list)

    def begin(self):
        return TrackEndpoint(self, Endpoint.BEGIN)

    def end(self):
        return TrackEndpoint(self, Endpoint.END)

    def add_buffer_stop(self, *args, **wargs):
        bs = BufferStop(*args, **wargs)
        self.waypoints.append(bs)
        return bs

    def add_detector(self, *args, **wargs):
        detector = Detector(*args, **wargs)
        self.waypoints.append(detector)
        return detector

    def add_signal(self, *args, **wargs):
        signal = Signal(*args, **wargs)
        self.signals.append(signal)
        return signal

    def add_slope(self, begin, end, slope):
        self.slopes.append(Slope(begin, end, slope))

    def add_curve(self, begin, end, curve):
        self.curves.append(Curve(begin, end, curve))

    def add_speed_limit(self, begin, end, speed):
        self.speed_limits.append(SpeedSection(begin, end, speed))

    def sort_waypoints(self):
        self.waypoints.sort(key=lambda w: w.position)

    def sort_signals(self):
        self.signals.sort(key=lambda s: s.position)

    def contains_buffer_stop(self) -> bool:
        for waypoint in self.waypoints:
            if waypoint.waypoint_type == "buffer_stop":
                return True
        return False

    @staticmethod
    def register_link(link: Link):
        if link.navigability != ApplicableDirection.REVERSE:
            link.begin.get_neighbors().append(link.end)
        if link.navigability != ApplicableDirection.NORMAL:
            link.end.get_neighbors().append(link.begin)

    def neighbors(self, direction: Direction):
        if direction == Direction.START_TO_STOP:
            return self.end_links
        return self.begining_links

    def format(self):
        if (self.begin_coordinates is None) != (
            self.end_coordinates is None
        ):
            raise RuntimeError(
                f"Track section: '{self.label}', has only one endpoint coordinates specified"
            )
        endpoints_coords = None
        if self.begin_coordinates is not None:
            endpoints_coords = [list(self.begin_coordinates), list(self.end_coordinates)]
        return {
            "id": self.label,
            "route_waypoints": [waypoint.format() for waypoint in self.waypoints],
            "signals": [signal.format() for signal in self.signals],
            "operational_points": [op.format() for op in self.operational_points],
            "length": self.length,
            "endpoints_coords": endpoints_coords,
            "slopes": [slope.format() for slope in self.slopes],
            "curves": [curve.format() for curve in self.curves],
            "speed_sections": [speed_section.format() for speed_section in self.speed_limits],
        }
