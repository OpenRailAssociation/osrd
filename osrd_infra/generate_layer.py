from typing import Dict, List, Type

from django.conf import settings
from django.contrib.gis.geos import GEOSGeometry
from requests import post

from osrd_infra.serializers import serialize_components

from osrd_infra.models import (
    Infra,
    fetch_entities,
    TrackSectionEntity,
    SignalEntity,
    Entity,
    GeoLineLocationComponent,
    GeoPointLocationComponent,
    GeoAreaLocationComponent,
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
    generate_layer(infra, TrackSectionEntity)
    generate_layer(infra, SignalEntity)


def get_geo_attribute_name(entity_type: Type[Entity]):
    for geo_component in (
        GeoLineLocationComponent,
        GeoPointLocationComponent,
        GeoAreaLocationComponent,
    ):
        if geo_component in entity_type._entity_meta.components:
            return geo_component._component_meta.name
    return None


def generate_layer(infra: Infra, entity_type: Type[Entity]):
    layer = []
    geo_attr_name = get_geo_attribute_name(entity_type)

    for entity in fetch_entities(entity_type, infra.namespace):
        # Get all entity components
        components = serialize_components(entity)

        entity_payload = {
            "entity_id": entity.entity_id,
            "components": components,
        }

        if geo_attr_name:
            geo_component = getattr(entity, geo_attr_name)
            entity_payload["geom_geo"] = geom_to_geosjon_dict(geo_component.geographic)
            entity_payload["geom_sch"] = geom_to_geosjon_dict(geo_component.schematic)

            # avoid duplcate geometry data
            components[geo_attr_name].pop("geographic")
            components[geo_attr_name].pop("schematic")

        layer.append(entity_payload)

    entity_type_name = entity._entity_meta.name
    push_layer(f"osrd_{entity_type_name}", infra.id, layer)
