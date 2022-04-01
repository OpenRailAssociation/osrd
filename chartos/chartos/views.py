from typing import Dict, List
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, Query
from dataclasses import asdict as dataclass_as_dict
from .config import Config, get_config
from .settings import Settings, get_settings
from .psql import PSQLPool
from .redis import RedisPool
from fastapi.responses import Response
from .layer_cache import get_view_cache_prefix, get_cache_tile_key, AffectedTile
from urllib.parse import quote as url_quote


router = APIRouter()


@router.get("/health")
async def health(
        psql=Depends(PSQLPool.get),
        redis=Depends(RedisPool.get),
):
    await psql.execute("select 1;")
    await redis.ping()
    return ""


@router.get("/info")
async def info(config: Config = Depends(get_config)):
    return config.todict()


@router.get("/layer/{layer_slug}/mvt/{view_slug}/")
async def mvt_view_metadata(
        layer_slug: str,
        view_slug: str,
        infra: str = Query(...),
        config: Config = Depends(get_config),
        settings: Settings = Depends(get_settings),
):
    layer = config.layers[layer_slug]
    view = layer.views[view_slug]
    tiles_url_pattern = (
        f"{settings.root_url}"
        f"/tile/{layer_slug}/{view_slug}"
        "/{z}/{x}/{y}/"
        f"?infra={url_quote(infra)}"
    )
    return {
        'type': 'vector',
        'name': layer.name,
        'promoteId': {layer.name: layer.id_field},
        'scheme': 'xyz',
        'tiles': [tiles_url_pattern],
        'attribution': layer.attribution or "",
        'minzoom': 0,
        'maxzoom': settings.max_zoom,
    }


class ProtobufResponse(Response):
    media_type = "application/x-protobuf"


@router.get(
    "/tile/{layer_slug}/{view_slug}/{z}/{x}/{y}/",
    response_class=ProtobufResponse
)
async def mvt_view_tile(
        layer_slug: str,
        view_slug: str,
        infra: str,
        z: int, x: int, y: int,
        config: Config = Depends(get_config),
        psql=Depends(PSQLPool.get),
        redis=Depends(RedisPool.get),
):
    layer = config.layers[layer_slug]
    view = layer.views[view_slug]

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


async def mvt_query(psql, layer, infra, view, z, x, y) -> bytes:
    query = (
        # prepare the bbox of the tile for use in the tile content subquery
        "WITH bbox AS (SELECT TileBBox($1, $2, $3, 3857) AS geom), "
        # find all objects in the tile
        "tile_content AS ( "
        # {{{ beginning of the tile content subquery
        "SELECT "
        # the geometry the view is based on, converted to MVT. this field must
        # come first for ST_AsMVT to index the tile on the correct geometry
        f"ST_AsMVTGeom({view.on_field}, bbox.geom, 4096, 64), "
        # select all the fields the user requested
        f"{', '.join(view.fields)} "
        # read from the table corresponding to the layer, as well as the bbox
        # the bbox table is built by the WITH clause of the top-level query
        f"FROM {layer.table_name} layer "
        "CROSS JOIN bbox "
        # add user defined joins
        f"{' '.join(view.joins)} "
        # filter by version
        f"WHERE layer.infra_id = $4 "
        # we only want objects which are inside the tile BBox
        f"AND {view.on_field} && bbox.geom "
        # exclude geometry collections
        f"AND ST_GeometryType({view.on_field}) != 'ST_GeometryCollection' "
        # }}} end of the tile content subquery
        ") "
        # package those inside an MVT tile
        f"SELECT ST_AsMVT(tile_content, '{layer.name}') AS tile FROM tile_content"
    )

    async with psql.transaction(isolation="repeatable_read", readonly=True):
        (record,) = await psql.fetch(query, z, x, y, int(infra))

    return record.get("tile")
