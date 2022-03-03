from typing import Mapping

from geojson_pydantic import Point, LineString, MultiLineString


def make_geo_point(x: float, y: float) -> Point:
    return Point(coordinates=(x, y))


def make_geo_line(*points) -> LineString:
    return LineString(coordinates=points)


def make_geo_multilines(lines) -> Mapping[str, MultiLineString]:
    return {"geo": MultiLineString(coordinates=lines), "sch": MultiLineString(coordinates=lines)}


def make_geo_points(x: float, y: float) -> Mapping[str, Point]:
    return {"geo": make_geo_point(x, y), "sch": make_geo_point(x, y)}


def make_geo_lines(*points) -> Mapping[str, LineString]:
    return {"geo": make_geo_line(*points), "sch": make_geo_line(*points)}
