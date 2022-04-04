from typing import Mapping

from geojson_pydantic import LineString


def make_geo_line(*points) -> LineString:
    return LineString(coordinates=points)


def make_geo_lines(*points) -> Mapping[str, LineString]:
    return {"geo": make_geo_line(*points), "sch": make_geo_line(*points)}
