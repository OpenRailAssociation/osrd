from typing import Dict, List

from django.conf import settings
from django.contrib.gis.geos import GEOSGeometry
from requests import post

from osrd_infra.models import Infra, TrackSectionEntity, EntityNamespace


def geom_to_geosjon_dict(geom: GEOSGeometry) -> Dict:
    return {'type': geom.__class__.__name__, 'coordinates': geom.coords}


def push_layer(layer_slug: str, version: int, payload: List[Dict]):
    response = post(f'{settings.CHARTIS_URL}push/{layer_slug}/truncate_and_insert/?version={version}',
                    json=payload,
                    headers={"Authorization": "Bearer " + settings.CHARTIS_TOKEN})
    assert response.status_code == 201


def generate_layers(infra: Infra):
    generate_track_section_layer(infra)


def generate_track_section_layer(infra: Infra):
    layer = []
    for track_section in TrackSectionEntity.objects.filter(namespace=infra.namespace):  # type: TrackSectionEntity
        layer.append({
            'entity_id': track_section.entity_id,
            'gaia_id': track_section.identifier_set.first().name,
            'length': track_section.track_section.length,
            'geom_sch': geom_to_geosjon_dict(track_section.geo_line_location.schematic),
            'geom_geo': geom_to_geosjon_dict(track_section.geo_line_location.geographic),
        })
    push_layer('osrd_track_section', infra.id, layer)
