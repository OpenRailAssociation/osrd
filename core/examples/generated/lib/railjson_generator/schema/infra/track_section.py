from dataclasses import dataclass, field
from typing import List, Tuple

from pydantic.error_wrappers import ValidationError
from railjson_generator.schema.infra.direction import ApplicableDirection, Direction
from railjson_generator.schema.infra.endpoint import Endpoint, TrackEndpoint
from railjson_generator.schema.infra.link import Link
from railjson_generator.schema.infra.make_geo_data import make_geo_lines
from railjson_generator.schema.infra.operational_point import OperationalPointPart
from railjson_generator.schema.infra.range_elements import Curve, Slope
from railjson_generator.schema.infra.signal import Signal
from railjson_generator.schema.infra.waypoint import BufferStop, Detector, Waypoint

from osrd_schemas import infra


def _track_id():
    res = f"track.{TrackSection._INDEX}"
    TrackSection._INDEX += 1
    return res


@dataclass
class TrackSection:
    _INDEX = 0

    length: float
    label: str = field(default_factory=_track_id)
    track_name: str = "placeholder_track"
    track_number: int = 0
    line_code: int = 0
    line_name: str = "placeholder_line"
    waypoints: List[Waypoint] = field(default_factory=list)
    signals: List[Signal] = field(default_factory=list)
    operational_points: List[OperationalPointPart] = field(default_factory=list)
    index: int = field(default=-1, repr=False)
    coordinates: List[Tuple[float, float]] = field(default_factory=lambda: [(None, None), (None, None)])
    begining_links: List[TrackEndpoint] = field(default_factory=list, repr=False)
    end_links: List[TrackEndpoint] = field(default_factory=list, repr=False)
    slopes: List[Slope] = field(default_factory=list)
    curves: List[Curve] = field(default_factory=list)

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

    def sort_waypoints(self):
        self.waypoints.sort(key=lambda w: w.position)

    def sort_signals(self):
        self.signals.sort(key=lambda s: s.position)

    def contains_buffer_stop(self) -> bool:
        for waypoint in self.waypoints:
            if waypoint.waypoint_type == "buffer_stop":
                return True
        return False

    def set_remaining_coords(self, coordinates: List[Tuple[float, float]]):
        """Sets values for extremities if none was already set, else only set values between extremities."""
        begin, end = 0, len(self.coordinates)
        if self.coordinates[0] != (None, None):
            begin += 1
        if self.coordinates[-1] != (None, None):
            end -= 1
        self.coordinates[begin:end] = coordinates

    @staticmethod
    def register_link(link: Link):
        """Add each linked trackEndPoint to its neighbor's neighbors list."""
        if link.navigability != ApplicableDirection.STOP_TO_START:
            link.begin.get_neighbors().append(link.end)
        if link.navigability != ApplicableDirection.START_TO_STOP:
            link.end.get_neighbors().append(link.begin)

    def neighbors(self, direction: Direction):
        if direction == Direction.START_TO_STOP:
            return self.end_links
        return self.begining_links

    def to_rjs(self):
        if self.coordinates == [(None, None), (None, None)]:
            self.coordinates = [(0, 0), (0, 0)]
        try:
            geo_data = make_geo_lines(*self.coordinates)
        except ValidationError:
            print(f"Track section {self.label} has invalid coordinates:")
            print(self.coordinates)
            raise
        return infra.TrackSection(
            id=self.label,
            length=self.length,
            slopes=[slope.to_rjs() for slope in self.slopes],
            curves=[curve.to_rjs() for curve in self.curves],
            **geo_data,
            extensions={
                "sncf": {
                    "line_code": self.line_code,
                    "line_name": self.line_name,
                    "track_number": self.track_number,
                    "track_name": self.track_name,
                }
            },
        )

    @property
    def id(self):
        return self.label

    def __hash__(self) -> int:
        return hash(self.id)
