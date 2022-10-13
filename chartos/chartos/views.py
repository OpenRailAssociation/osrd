import json
from collections import defaultdict
from typing import Any, Dict, List, Mapping, NewType, Tuple

from asyncpg import Connection
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, validator

from .config import Config, Layer, View, get_config
from .layer_cache import (
    AffectedTile,
    count_tiles,
    find_tiles,
    get_cache_tile_key,
    get_view_cache_prefix,
    invalidate_cache,
    invalidate_full_layer_cache,
)
from .psql import PSQLPool
from .redis import RedisPool
from .settings import Settings, get_settings

router = APIRouter()


@router.get("/health/")
async def health(
    psql: Connection = Depends(PSQLPool.get),
    redis: RedisPool = Depends(RedisPool.get),
):
    await psql.execute("select 1;")
    await redis.ping()
    return ""


@router.get("/info/")
async def info(config: Config = Depends(get_config)):
    return config.todict()


def get_or_404(elements, key, array_name):
    if key not in elements:
        raise HTTPException(
            status_code=404, detail=f"{array_name} {key} not found. Expected one of [{', '.join(elements.keys())}]"
        )
    return elements[key]


@router.get("/layer/{layer_slug}/mvt/{view_slug}/")
async def mvt_view_metadata(
    layer_slug: str,
    view_slug: str,
    infra: int = Query(...),
    config: Config = Depends(get_config),
    settings: Settings = Depends(get_settings),
):
    layer: Layer = get_or_404(config.layers, layer_slug, "Layer")
    # Check view exists
    get_or_404(layer.views, view_slug, "Layer view")
    tiles_url_pattern = f"{settings.root_url}/tile/{layer_slug}/{view_slug}/" "{z}/{x}/{y}" f"/?infra={infra}"
    return {
        "type": "vector",
        "name": layer.name,
        "promoteId": {layer.name: layer.id_field},
        "scheme": "xyz",
        "tiles": [tiles_url_pattern],
        "attribution": layer.attribution or "",
        "minzoom": 0,
        "maxzoom": settings.max_zoom,
    }


class ProtobufResponse(Response):
    media_type = "application/x-protobuf"


@router.get("/tile/{layer_slug}/{view_slug}/{z}/{x}/{y}/", response_class=ProtobufResponse)
async def mvt_view_tile(
    layer_slug: str,
    view_slug: str,
    z: int,
    x: int,
    y: int,
    infra: int = Query(...),
    config: Config = Depends(get_config),
    psql: Connection = Depends(PSQLPool.get),
    redis=Depends(RedisPool.get),
):
    layer: Layer = get_or_404(config.layers, layer_slug, "Layer")
    view = get_or_404(layer.views, view_slug, "Layer view")

    # try to fetch the tile from the cache
    view_cache_prefix = get_view_cache_prefix(layer, infra, view)
    cache_key = get_cache_tile_key(view_cache_prefix, AffectedTile(x, y, z))
    tile_data = await redis.get(cache_key)
    if tile_data is not None:
        return ProtobufResponse(tile_data)

    # if the key isn't found, build the tile
    tile_data = await mvt_query(psql, layer, infra, view, z, x, y)

    # store the tile in the cache
    await redis.set(cache_key, tile_data, ex=view.cache_duration)
    return ProtobufResponse(tile_data)


def _flatten_data_rec(data, separator, result, prefix):
    for key, value in data.items():
        if isinstance(value, dict):
            _flatten_data_rec(value, separator, result, f"{prefix}{key}{separator}")
        else:
            result[prefix + key] = value
    return result


def flatten_data(data, separator="_"):
    """
    Flatten a dictionnary and prefix keys with the parent key separated by `separator`.
    """
    return _flatten_data_rec(data, separator, {}, "")


async def mvt_query(psql, layer, infra, view: View, z: int, x: int, y: int) -> bytes:
    exclude_fields = ["- " + f"'{key}'" for key in view.exclude_fields]
    query_get_objects = (
        # prepare the bbox of the tile for use in the tile content subquery
        "WITH bbox AS (SELECT TileBBox($1, $2, $3, 3857) AS geom) "
        # {{{ beginning of the tile content subquery
        "SELECT "
        # the geometry the view is based on, converted to MVT. this field must
        # come first for ST_AsMVT to index the tile on the correct geometry
        f"ST_AsMVTGeom({view.on_field}, bbox.geom, 4096, 64) AS geom, "
        # retrieve the data field the user requested
        f"{view.data_expr} {' '.join(exclude_fields)} AS data "
        # read from the table corresponding to the layer, as well as the bbox
        # the bbox table is built by the WITH clause of the top-level query
        f"FROM {layer.table_name} layer "
        "CROSS JOIN bbox "
        # add user defined joins
        f"{' '.join(view.joins)} "
        # filter by infra
        f"WHERE layer.infra_id = $4 "
        # we only want objects which are inside the tile BBox
        f"AND {view.on_field} && bbox.geom "
        # exclude geometry collections
        f"AND ST_GeometryType({view.on_field}) != 'ST_GeometryCollection' "
    )

    async with psql.transaction(isolation="repeatable_read", readonly=True):
        records = await psql.fetch(query_get_objects, z, x, y, int(infra))

    # No data found in the tile
    if len(records) == 0:
        return b""

    # Prepare tile content
    tile_content_dict: Dict[str, List[Any]] = defaultdict(list)
    types_mapping: Mapping[str, str] = {"geom": "geometry"}
    for i, record in enumerate(records):
        # Flatten nested data
        flat_data = flatten_data(json.loads(record["data"]))
        # Serialize to json lists
        flat_data = {k: json.dumps(v) if isinstance(v, list) else v for k, v in flat_data.items()}
        flat_data["geom"] = record["geom"]

        for key in flat_data.keys():
            if key in tile_content_dict:
                continue
            tile_content_dict[key] = [None] * i

        for key in flat_data.keys():
            if key in types_mapping or flat_data[key] is None:
                continue
            if isinstance(flat_data[key], str):
                types_mapping[key] = "text"
            elif isinstance(flat_data[key], int):
                types_mapping[key] = "int"
            elif isinstance(flat_data[key], float):
                types_mapping[key] = "float"
            else:
                raise Exception(f"Unknown type for key '{key}': {type(flat_data[key])}")

        for key in tile_content_dict:
            tile_content_dict[key].append(flat_data.get(key, None))

    # Prepare query
    tile_content_query = []
    tile_content = []
    for i, key in enumerate(tile_content_dict.keys()):
        tile_content_query.append(f"unnest(${i + 1}::{types_mapping.get(key, 'text')}[]) AS \"{key}\"")
        tile_content.append(tile_content_dict[key])

    # Build query to create the tile
    query_create_tile = (
        # prepare tile content
        "WITH tile_content AS ( "
        # Unest all tile content to create a row for each key/value pair
        f"SELECT {', '.join(tile_content_query)}"
        ") "
        # package those inside an MVT tile
        f"SELECT ST_AsMVT(tile_content, '{layer.name}') AS tile FROM tile_content"
    )

    async with psql.transaction(isolation="repeatable_read", readonly=True):
        (record,) = await psql.fetch(query_create_tile, *tile_content)

    return record.get("tile")


@router.post("/layer/{layer_slug}/invalidate/", status_code=204, response_class=Response)
async def invalidate_layer(
    layer_slug: str,
    infra: int = Query(...),
    config: Config = Depends(get_config),
    redis: RedisPool = Depends(RedisPool.get),
):
    """Invalidate cache for a whole layer"""
    layer: Layer = get_or_404(config.layers, layer_slug, "Layer")
    await invalidate_full_layer_cache(redis, layer, infra)


BoundingBox = NewType("BoundingBox", Tuple[Tuple[float, float], Tuple[float, float]])


class BoundingBoxView(BaseModel):
    view: str
    bbox: BoundingBox

    @validator("bbox")
    def validate_bbox(cls, bbox):
        if bbox[0][0] > bbox[1][0] or bbox[0][1] > bbox[1][1]:
            raise ValueError("Invalid bounding box, minx/miny must be less than maxx/maxy")
        return bbox


@router.post("/layer/{layer_slug}/invalidate_bbox/", status_code=204, response_class=Response)
async def invalidate_layer_bbox(
    layer_slug: str,
    infra: int = Query(...),
    bounding_boxes: List[BoundingBoxView] = Body(...),
    config: Config = Depends(get_config),
    redis: RedisPool = Depends(RedisPool.get),
    settings: Settings = Depends(get_settings),
):
    """Invalidate cache for a whole layer"""
    layer: Layer = get_or_404(config.layers, layer_slug, "Layer")
    affected_tiles: Dict[View, List[AffectedTile]] = defaultdict(set)
    for bbox in bounding_boxes:
        view = get_or_404(layer.views, bbox.view, "Layer view")
        # For optimization reasons, if there is too much tiles to invalidate, we invalidate the whole view.
        if count_tiles(settings.max_zoom, bbox.bbox) > settings.max_tiles:
            await invalidate_full_layer_cache(redis, layer, infra, view)
            continue
        affected_tiles[view] = find_tiles(settings.max_zoom, bbox.bbox)

    if affected_tiles:
        await invalidate_cache(redis, layer, infra, affected_tiles)


@router.get("/layer/{layer_slug}/objects/{view_slug}/{min_x}/{min_y}/{max_x}/{max_y}/")
async def get_objects_in_bbox(
    layer_slug: str,
    view_slug: str,
    min_x: float,
    min_y: float,
    max_x: float,
    max_y: float,
    infra: int = Query(...),
    psql: Connection = Depends(PSQLPool.get),
    config: Config = Depends(get_config),
    settings: Settings = Depends(get_settings),
):
    """Retrieve objects in a given bounding box"""
    layer: Layer = get_or_404(config.layers, layer_slug, "Layer")
    view = get_or_404(layer.views, view_slug, "Layer view")

    exclude_fields = ["- " + f"'{key}'" for key in view.exclude_fields]

    query = (
        # Add geometry of the object
        f"SELECT ST_AsGeoJSON(ST_Transform(layer.{view.on_field}, 4326))::jsonb as geom, "
        # Add data of the object
        f"{view.data_expr} {' '.join(exclude_fields)} as data "
        f"FROM {layer.table_name} AS layer "
        # Add joins
        f"{' '.join(view.joins)} "
        # Filter by infra
        "WHERE layer.infra_id = $1 "
        # Filter by objects inside the bounding box
        f"AND layer.{view.on_field} && ST_Transform(ST_MakeEnvelope($2, $3, $4, $5, 4326), 3857)"
    )

    async with psql.transaction(isolation="repeatable_read", readonly=True):
        records = await psql.fetch(query, infra, min_x, min_y, max_x, max_y)

    features = []
    for record in records:
        feature = {"type": "Feature"}
        feature["geometry"] = json.loads(record.get("geom"))
        feature["properties"] = json.loads(record.get("data"))
        features.append(feature)

    return {"type": "FeatureCollection", "features": features}
