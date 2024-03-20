from dataclasses import dataclass, field
from typing import List, Optional, Tuple

from osrd_schemas import infra
from pydantic import ValidationError

from railjson_generator.schema.infra.direction import ApplicableDirection, Direction
from railjson_generator.schema.infra.endpoint import Endpoint, TrackEndpoint
from railjson_generator.schema.infra.make_geo_data import make_geo_lines
from railjson_generator.schema.infra.operational_point import OperationalPointPart
from railjson_generator.schema.infra.range_elements import (
    ApplicableDirectionsTrackRange,
    Curve,
    LoadingGaugeLimit,
    Slope,
)
from railjson_generator.schema.infra.signal import Signal
from railjson_generator.schema.infra.switch import SwitchGroup
from railjson_generator.schema.infra.waypoint import BufferStop, Detector, Waypoint


def _track_id():
    # pytype: disable=name-error
    res = f"track.{TrackSection._INDEX}"
    TrackSection._INDEX += 1
    # pytype: enable=name-error
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
    coordinates: List[Tuple[Optional[float], Optional[float]]] = field(
        default_factory=lambda: [(None, None), (None, None)]
    )
    begining_links: List[Tuple[TrackEndpoint, Optional[SwitchGroup]]] = field(default_factory=list, repr=False)
    end_links: List[Tuple[TrackEndpoint, Optional[SwitchGroup]]] = field(default_factory=list, repr=False)
    slopes: List[Slope] = field(default_factory=list)
    curves: List[Curve] = field(default_factory=list)
    loading_gauge_limits: List[LoadingGaugeLimit] = field(default_factory=list)

    def begin(self):
        return TrackEndpoint(self, Endpoint.BEGIN)

    def end(self):
        return TrackEndpoint(self, Endpoint.END)

    def forwards(self, begin: Optional[float] = None, end: Optional[float] = None) -> ApplicableDirectionsTrackRange:
        return ApplicableDirectionsTrackRange(
            begin=begin or 0.0,
            end=end or self.length,
            track=self,
            applicable_directions=ApplicableDirection.START_TO_STOP,
        )

    def backwards(self, begin: Optional[float] = None, end: Optional[float] = None) -> ApplicableDirectionsTrackRange:
        return ApplicableDirectionsTrackRange(
            begin=begin or 0.0,
            end=end or self.length,
            track=self,
            applicable_directions=ApplicableDirection.STOP_TO_START,
        )

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

    def add_loading_gauge_limit(self, begin, end, category):
        self.loading_gauge_limits.append(LoadingGaugeLimit(begin, end, category))

    def sort_waypoints(self):
        self.waypoints.sort(key=lambda w: w.position)

    def sort_signals(self):
        self.signals.sort(key=lambda s: s.position)

    def contains_buffer_stop(self) -> bool:
        for waypoint in self.waypoints:
            if isinstance(waypoint, BufferStop):
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
            loading_gauge_limits=[loading_gauge_limit.to_rjs() for loading_gauge_limit in self.loading_gauge_limits],
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
