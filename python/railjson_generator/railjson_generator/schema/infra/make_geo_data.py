from typing import Mapping

from geojson_pydantic import LineString


def make_geo_line(*points) -> LineString:
    return LineString(coordinates=points, type="LineString")


def make_geo_lines(*points) -> Mapping[str, LineString]:
    return {"geo": make_geo_line(*points)}
