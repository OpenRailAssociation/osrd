from dataclasses import dataclass, field
from typing import List, Optional, Tuple

from railjson_generator.schema.infra.direction import ApplicableDirection, Direction
from railjson_generator.schema.infra.endpoint import Endpoint, TrackEndpoint
from railjson_generator.schema.infra.link import Link
from railjson_generator.schema.infra.make_geo_data import make_geo_lines
from railjson_generator.schema.infra.operational_point import OperationalPointPart
from railjson_generator.schema.infra.range_elements import Curve, Slope
from railjson_generator.schema.infra.signal import Signal
from railjson_generator.schema.infra.waypoint import BufferStop, Detector, Waypoint

import infra


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
    begin_coordinates: Tuple[float, float] = field(default=(0, 0))
    end_coordinates: Tuple[float, float] = field(default=(0, 0))
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

    @staticmethod
    def register_link(link: Link):
        if link.navigability != ApplicableDirection.STOP_TO_START:
            link.begin.get_neighbors().append(link.end)
        if link.navigability != ApplicableDirection.START_TO_STOP:
            link.end.get_neighbors().append(link.begin)

    def neighbors(self, direction: Direction):
        if direction == Direction.START_TO_STOP:
            return self.end_links
        return self.begining_links

    def to_rjs(self):
        if self.begin_coordinates is None or self.end_coordinates is None:
            geo_data = make_geo_lines((0, 0), (0, 0))
        else:
            geo_data = make_geo_lines(self.begin_coordinates, self.end_coordinates)
        return infra.TrackSection(
            id=self.label,
            length=self.length,
            line_code=0,
            track_number=0,
            line_name="placeholder_line",
            track_name="placeholder_track",
            navigability=infra.ApplicableDirections[ApplicableDirection.BOTH.name],
            slopes=[slope.to_rjs() for slope in self.slopes],
            curves=[curve.to_rjs() for curve in self.curves],
            **geo_data,
        )

    def make_rjs_ref(self):
        return infra.ObjectReference(id=self.label, type=type(self).__name__)
