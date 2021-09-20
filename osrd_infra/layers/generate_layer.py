from typing import Type
from .layer_creator import LayerCreator

from osrd_infra.serializers import serialize_components
from osrd_infra.utils import track_section_range_geom

from osrd_infra.models import (
    Entity,
    GeoAreaLocationComponent,
    GeoLineLocationComponent,
    GeoPointLocationComponent,
    Infra,
    OperationalPointPartEntity,
    SignalEntity,
    SignalingType,
    SpeedSectionPartEntity,
    TrackSectionEntity,
    fetch_entities,
)


def generate_layers(infra: Infra):
    generate_ecs_layer(infra, TrackSectionEntity)
    generate_ecs_layer(infra, SignalEntity)
    generate_speed_layer(infra)
    generate_signaling_type_layer(infra)
    generate_electrification_type_layer(infra)
    generate_operational_point_layer(infra)


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


def generate_signaling_type_layer(infra: Infra):
    with LayerCreator("signaling_type", infra.id) as creator:
        for ts in fetch_entities(TrackSectionEntity, infra.namespace):
            for signaling_type in ts.signaling_type_set.all():
                # Get geometry of the object
                geo, sch = track_section_range_geom(
                    ts, signaling_type.start_offset, signaling_type.end_offset
                )

                # Add entity to layer
                layer_object = creator.create_object(geo, sch)
                s_type = SignalingType(signaling_type.signaling_type).name
                layer_object.add_metadata("signaling_type", s_type)
                layer_object.add_metadata("component_id", signaling_type.component_id)


def generate_electrification_type_layer(infra: Infra):
    with LayerCreator("electrification_type", infra.id) as creator:
        for ts in fetch_entities(TrackSectionEntity, infra.namespace):
            for electrification_type in ts.electrification_type_set.all():
                # Get geometry of the object
                geo, sch = track_section_range_geom(
                    ts,
                    electrification_type.start_offset,
                    electrification_type.end_offset,
                )

                # Add entity to layer
                layer_object = creator.create_object(geo, sch)
                layer_object.add_metadata(
                    "electrification_type", electrification_type.electrification_type
                )
                layer_object.add_metadata(
                    "component_id", electrification_type.component_id
                )


def generate_operational_point_layer(infra: Infra):
    with LayerCreator("operational_point", infra.id) as creator:
        for op_part in fetch_entities(OperationalPointPartEntity, infra.namespace):
            # Get geometry of the object
            geo = op_part.geo_point_location.geographic
            sch = op_part.geo_point_location.schematic

            # Fetch operational point component
            op = op_part.operational_point_part.operational_point
            op_comp = op.operational_point

            # Add entity to layer
            layer_object = creator.create_object(geo, sch)
            layer_object.add_metadata("entity_id", op_part.entity_id)
            layer_object.add_metadata("name", op_comp.name)
            layer_object.add_metadata("ci", op_comp.ci)
            layer_object.add_metadata("ch", op_comp.ch)
            layer_object.add_metadata("ch_short_label", op_comp.ch_short_label)
            layer_object.add_metadata("ch_long_label", op_comp.ch_long_label)
