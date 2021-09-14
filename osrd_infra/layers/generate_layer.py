from typing import Type
from .layer_creator import LayerCreator

from osrd_infra.serializers import serialize_components

from osrd_infra.models import (
    Infra,
    fetch_entities,
    TrackSectionEntity,
    SignalEntity,
    SpeedSectionPartEntity,
    Entity,
    GeoLineLocationComponent,
    GeoPointLocationComponent,
    GeoAreaLocationComponent,
)


def generate_layers(infra: Infra):
    generate_ecs_layer(infra, TrackSectionEntity)
    generate_ecs_layer(infra, SignalEntity)
    generate_speed_layer(infra)


def get_geo_attribute_name(entity_type: Type[Entity]):
    for geo_component in (
        GeoLineLocationComponent,
        GeoPointLocationComponent,
        GeoAreaLocationComponent,
    ):
        if geo_component in entity_type._entity_meta.components:
            return geo_component._component_meta.name
    return None


def generate_ecs_layer(infra: Infra, entity_type: Type[Entity]):
    geo_attr_name = get_geo_attribute_name(entity_type)
    assert geo_attr_name
    entity_type_name = entity_type._entity_meta.name
    with LayerCreator(entity_type_name, infra.id) as creator:
        for entity in fetch_entities(entity_type, infra.namespace):

            # Get all entity components
            components = serialize_components(entity)

            # Get geometry component
            geo_component = getattr(entity, geo_attr_name)
            geom_geo = geo_component.geographic
            geom_sch = geo_component.schematic

            # Add entity to layer
            layer_object = creator.create_object(geom_geo, geom_sch)
            layer_object.add_metadata("entity_id", entity.entity_id)
            layer_object.add_metadata("components", components)

            # avoid duplcate geometry data
            components[geo_attr_name].pop("geographic")
            components[geo_attr_name].pop("schematic")


def generate_speed_layer(infra: Infra):
    with LayerCreator("speed_limit", infra.id) as creator:
        for speed_section in fetch_entities(SpeedSectionPartEntity, infra.namespace):
            # Get geometry of the object
            geo_component = speed_section.geo_line_location
            geom_geo = geo_component.geographic
            geom_sch = geo_component.schematic

            # Add entity to layer
            layer_object = creator.create_object(geom_geo, geom_sch)
            speed = speed_section.speed_section_part.speed_section.speed_section.speed
            layer_object.add_metadata("speed", speed)
            layer_object.add_metadata("entity_id", speed_section.entity_id)
