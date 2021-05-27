from osrd_infra.serializers import serialize_entity
from osrd_infra.models import entities_prefetch_components
from rest_framework.response import Response
from collections import defaultdict

import json


from osrd_infra.models import (
    # ecs
    Entity,
    get_component_meta,
    get_entity_meta,
    GeoPointLocationComponent,
    GeoLineLocationComponent,
    GeoAreaLocationComponent,
)


GEO_COMPONENT_TYPES = (
    GeoLineLocationComponent,
    GeoPointLocationComponent,
    GeoAreaLocationComponent,
)


def serialize_entity_as_feature(mode, entity):
    assert mode in ("geographic", "schematic")
    meta = get_entity_meta(entity.get_concrete_type())
    for component_type in meta.components:
        if component_type in GEO_COMPONENT_TYPES:
            geo_component_type = component_type
            break
    else:
        raise RuntimeError("entity type has no geo component")

    geo_component_meta = get_component_meta(geo_component_type)
    geo_component = getattr(entity, geo_component_meta.related_name)

    geometry = getattr(geo_component, mode)

    return {
        "type": "Feature",
        "geometry": json.loads(geometry.json),
        "properties": serialize_entity(entity),
    }


def geojson_query_infra(infra, query):
    namespace = infra.namespace
    entities_by_type = defaultdict(set)

    # find all entities in the area, and group by entity type
    for geo_component_type in GEO_COMPONENT_TYPES:
        for component in geo_component_type.objects.filter(
                geographic__intersects=query
        ).select_related("entity__entity_type"):
            entity_type = component.entity.get_concrete_type()
            entities_by_type[entity_type].add(component.entity_id)

    features = []
    for entity_type, entity_ids in entities_by_type.items():
        qs = Entity.objects.filter(namespace=namespace, entity_id__in=entity_ids)
        for entity in entities_prefetch_components(entity_type, qs):
            features.append(serialize_entity_as_feature("geographic", entity))

    return Response(
        {
            "type": "FeatureCollection",
            "features": features,
        }
    )
