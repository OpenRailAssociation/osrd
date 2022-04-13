from dataclasses import dataclass
from math import asinh, atan, degrees, floor, pi, radians, sinh, tan
from typing import Collection, Dict, Iterable, Iterator, Optional, Set, Tuple

from fastapi.responses import JSONResponse
from shapely.geometry import Polygon
from shapely.prepared import prep

from .config import Layer, View


def get_layer_cache_prefix(layer, version):
    return f"chartis.layer.{layer.name}.version_{version}"


def get_view_cache_prefix(layer, version, view):
    layer_prefix = get_layer_cache_prefix(layer, version)
    return f"{layer_prefix}.{view.name}"


@dataclass(eq=True, frozen=True)
class AffectedTile:
    x: int
    y: int
    z: int

    def to_json(self):
        return {"x": self.x, "y": self.y, "z": self.z}


def get_cache_tile_key(view_prefix: str, tile: AffectedTile):
    return f"{view_prefix}.tile/{tile.z}/{tile.x}/{tile.y}"


def get_xy(lat: float, lon: float, zoom: int) -> Tuple[int, int]:
    n = 2.0**zoom
    x = floor((lon + 180.0) / 360.0 * n)
    y = floor((1.0 - asinh(tan(radians(lat))) / pi) / 2.0 * n)
    return x, y


def get_nw_deg(z: int, x: int, y: int):
    n = 2.0**z
    lon_deg = x / n * 360.0 - 180.0
    lat_rad = atan(sinh(pi * (1 - 2 * y / n)))
    return degrees(lat_rad), lon_deg


def find_prepared_affected_tiles(max_zoom, prep_geom, z: int, x: int, y: int) -> Iterator[AffectedTile]:
    if z > max_zoom:
        return

    lat_max, long_min = get_nw_deg(z, x, y)
    lat_min, long_max = get_nw_deg(z, x + 1, y + 1)
    bbox = Polygon.from_bounds(long_min, lat_min, long_max, lat_max)
    if not prep_geom.intersects(bbox):
        return

    yield AffectedTile(x, y, z)

    for sub_x in range(x * 2, x * 2 + 2):
        for sub_y in range(y * 2, y * 2 + 2):
            yield from find_prepared_affected_tiles(max_zoom, prep_geom, z + 1, sub_x, sub_y)


def find_affected_tiles(max_zoom, geom) -> Iterator[AffectedTile]:
    """geom must be a 4326 (GPS) geometry"""
    prepared_geom = prep(geom)
    return find_prepared_affected_tiles(max_zoom, prepared_geom, 0, 0, 0)


async def invalidate_cache(redis, layer: Layer, version: str, affected_tiles: Dict[View, Set[AffectedTile]]):
    impacted_tiles_meta = {}

    def build_evicted_keys() -> Iterable[str]:
        for view in layer.views.values():
            view_affected_tiles = affected_tiles.get(view)
            if view_affected_tiles is None:
                continue
            impacted_tiles_meta[view.name] = [tile.to_json() for tile in view_affected_tiles]
            cache_location = get_view_cache_prefix(layer, version, view)
            for tile in view_affected_tiles:
                yield get_cache_tile_key(cache_location, tile)

    evicted_keys = list(build_evicted_keys())
    if evicted_keys:
        await redis.delete(*evicted_keys)
    return JSONResponse(
        {"impacted_tiles": impacted_tiles_meta},
        status_code=201,
    )


async def invalidate_full_layer_cache(redis, layer: Layer, version: str):
    """
    Invalidate cache for a whole layer

    Args:
        layer_slug (str): The layer for which the cache has to be invalidated.
    """
    layer_prefix = get_layer_cache_prefix(layer, version)
    key_pattern = f"{layer_prefix}.*"

    delete_args = await redis.keys(key_pattern)
    if delete_args:
        await redis.delete(*delete_args)
