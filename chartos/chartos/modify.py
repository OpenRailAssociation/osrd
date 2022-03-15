from enum import Enum
from collections import defaultdict
from typing import Set, List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Body, Query
from fastapi.responses import Response
from .config import Config, get_config, Layer, Field, View
from .settings import Settings, get_settings
from .psql import PSQLPool
from .redis import RedisPool
from .layer_cache import (
    invalidate_cache,
    invalidate_full_layer_cache,
    find_affected_tiles,
    AffectedTile,
)


router = APIRouter()


def validate_payload(
        layer: Layer,
        payload: List[Dict[str, Any]],
        mandatory_fields: Optional[Set[Field]] = None
):
    if mandatory_fields is None:
        mandatory_fields = set()
    mandatory_fields.add(layer.id_field)

    valid_fields = layer.fields.keys()

    # check each entry
    for row in payload:
        for field_name in row.keys():
            if field_name not in valid_fields:
                raise HTTPException(status_code=400, detail={
                    "details": f"Unknown field name `{field_name}`",
                    "choices": list(valid_fields)
                })

        for mandatory_field in mandatory_fields:
            if mandatory_field.name not in row.keys():
                raise HTTPException(status_code=400, detail={
                    "details": f"Field `{mandatory_field}` is mandatory.",
                    "choices": list(row.keys())
                })


@router.post('/push/{layer_slug}/insert/')
async def insert(
        layer_slug: str,
        version: str = Query(...),
        payload: List[Dict[str, Any]] = Body(...),
        config: Config = Depends(get_config),
        settings: Settings = Depends(get_settings),
        psql=Depends(PSQLPool.get),
        redis=Depends(RedisPool.get),
):
    layer = config.layers[layer_slug]
    validate_payload(layer, payload, {view.on_field for view in layer.views.values()})

    # get which fields are indexed by views
    viewed_fields: Dict[Field, View] = layer.get_viewed_fields()
    affected_tiles: Dict[Field, Set[AffectedTile]] = defaultdict(set)

    def build_pg_record(json_record):
        """Takes user provided json and converts it to a record"""
        yield version
        for layer_field in layer.fields.values():
            # get the field from the user provided data
            json_field = json_record.get(layer_field.name)
            if json_field is None:
                yield None
                continue
            # convert it for insertion in the database
            field_data = layer_field.from_json(json_field)
            # if this field has an impact on views, find affected tiles
            if layer_field in viewed_fields:
                affected_tiles[layer_field].update(
                    find_affected_tiles(settings.max_zoom, field_data))
            yield field_data

    records = [tuple(build_pg_record(data)) for data in payload]
    field_names = list(layer.pg_field_names())
    field_placeholder = ", ".join(f"${i + 1}" for i in range(len(field_names)))
    query = (
        f"insert into {layer.pg_table_name()} ({', '.join(field_names)}) "
        f"values ({field_placeholder})"
    )
    await psql.executemany(query, records)
    return await invalidate_cache(redis, layer, version, affected_tiles)
