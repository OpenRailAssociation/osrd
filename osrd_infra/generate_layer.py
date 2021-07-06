from typing import Dict, List

from django.conf import settings
from django.contrib.gis.geos import GEOSGeometry
from requests import post

from osrd_infra.serializers import serialize_components

from osrd_infra.models import (
    Infra,
    ALL_ENTITY_TYPES,
    fetch_entities,
)


def geom_to_geosjon_dict(geom: GEOSGeometry) -> Dict:
    return {"type": geom.__class__.__name__, "coordinates": geom.coords}


def push_layer(layer_slug: str, version: int, payload: List[Dict]):
    response = post(
        f"{settings.CHARTIS_URL}push/{layer_slug}/insert/?version={version}",
        json=payload,
        headers={"Authorization": "Bearer " + settings.CHARTIS_TOKEN},
    )
    print(response.status_code, response.text)
    assert response.status_code == 201


def generate_layers(infra: Infra):
    generate_entities_layer(infra)


def generate_entities_layer(infra: Infra):
    layer = []
    for entity_type_name, entity_type in ALL_ENTITY_TYPES.items():
        for entity in fetch_entities(entity_type, infra.namespace):
            layer.append(
                {
                    "entity_id": entity.entity_id,
                    "entity_type": entity_type_name,
                    "components": serialize_components(entity),
                }
            )

    push_layer("osrd_track_section", infra.id, layer)
