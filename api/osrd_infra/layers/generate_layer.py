from dataclasses import dataclass
from typing import Type

from django.contrib.gis.geos import LineString

from osrd_infra.models import Infra, TrackSectionModel
from osrd_infra.schemas.infra import TrackSection

from .layer_creator import LayerCreator


@dataclass
class CachedTrackSection:
    track: TrackSection
    geo: LineString
    sch: LineString


def generate_layers(infra: Infra):
    generate_generic_layer(infra, TrackSectionModel)


def generate_generic_layer(infra: Infra, model_type: Type):
    layer_name = model_type._meta.verbose_name_plural.replace(" ", "_")
    with LayerCreator(layer_name, infra.id) as creator:
        for entity in model_type.objects.filter(infra=infra):
            creator.add(entity.data)
