from dataclasses import dataclass
from math import asinh, atan, degrees, floor, pi, radians, sinh, tan
from typing import Dict, List, Optional, Set, Tuple

from .config import Layer, View


def get_layer_cache_prefix(layer, infra):
    return f"chartis.layer.{layer.name}.infra_{infra}"


def get_view_cache_prefix(layer, infra, view):
    layer_prefix = get_layer_cache_prefix(layer, infra)
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


def find_tiles(max_zoom, bbox) -> List[AffectedTile]:
    """Compute from bbox the list of tiles to invalidate"""
    affected_tiles = []
    for zoom in range(max_zoom + 1):
        nw_x, nw_y = get_xy(bbox[0][1], bbox[0][0], zoom)
        se_x, se_y = get_xy(bbox[1][1], bbox[1][0], zoom)
        assert nw_x <= se_x
        assert se_y <= nw_y
        for x in range(nw_x, se_x + 1):
            for y in range(se_y, nw_y + 1):
                affected_tiles.append(AffectedTile(x, y, zoom))
    return affected_tiles


def count_tiles(max_zoom, bbox) -> int:
    """Count the number of tiles in a bbox"""
    count = 0
    for zoom in range(max_zoom + 1):
        nw_x, nw_y = get_xy(bbox[0][1], bbox[0][0], zoom)
        se_x, se_y = get_xy(bbox[1][1], bbox[1][0], zoom)
        assert nw_x <= se_x
        assert se_y <= nw_y
        count += (se_x - nw_x) * (nw_y - se_y)
    return count


async def invalidate_cache(redis, layer: Layer, infra: str, affected_tiles: Dict[View, Set[AffectedTile]]):
    evicted_keys = []
    for view, view_affected_tiles in affected_tiles.items():
        cache_location = get_view_cache_prefix(layer, infra, view)
        for tile in view_affected_tiles:
            evicted_keys.append(get_cache_tile_key(cache_location, tile))

    if evicted_keys:
        await redis.delete(*evicted_keys)


async def invalidate_full_layer_cache(redis, layer: Layer, infra: str, view: Optional[View] = None):
    """
    Invalidate cache for a whole layer

    Args:
        layer: The layer for which the cache has to be invalidated.
        view: The view for which the cache has to be invalidated. If None, all view are invalidated.
    """
    if view is None:
        prefix = get_layer_cache_prefix(layer, infra)
    else:
        prefix = get_view_cache_prefix(layer, infra, view)

    key_pattern = f"{prefix}.*"

    delete_args = await redis.keys(key_pattern)
    if delete_args:
        await redis.delete(*delete_args)
