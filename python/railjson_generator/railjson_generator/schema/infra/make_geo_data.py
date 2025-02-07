from typing import Mapping

from geojson_pydantic import LineString
from geojson_pydantic.types import LineStringCoords


def make_geo_line(points: LineStringCoords) -> LineString:
    return LineString(coordinates=points, type="LineString")


def make_geo_lines(points: LineStringCoords) -> Mapping[str, LineString]:
    return {"geo": make_geo_line(points)}
