from typing import Mapping

from geojson_pydantic import Point, LineString
from geojson_pydantic.types import Position


def placeholder_position() -> Position:
    return 0, 0


def placeholder_geo_point() -> Point:
    return Point(coordinates=placeholder_position())


def placeholder_geo_line() -> LineString:
    return LineString(coordinates=[placeholder_position(), placeholder_position()])


def placeholder_geo_points() -> Mapping[str, Point]:
    return {"geo": placeholder_geo_point(), "sch": placeholder_geo_point()}


def placeholder_geo_lines() -> Mapping[str, LineString]:
    return {"geo": placeholder_geo_line(), "sch": placeholder_geo_line()}
