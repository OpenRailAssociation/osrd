from typing import Mapping

from geojson_pydantic.types import LineStringCoords
from osrd_schemas_auto import models


def make_geo_line(points: LineStringCoords) -> models.GeoJsonLineString:
    return models.GeoJsonLineString(
        models.LineStringGeometry(
            coordinates=[list(point) for point in points], type="LineString"
        )
    )


def make_geo_lines(points: LineStringCoords) -> Mapping[str, models.GeoJsonLineString]:
    return {"geo": make_geo_line(points)}
