from django.contrib.gis.db.models import PointField, PolygonField, LineStringField, MultiLineStringField
from django.db.models import BigAutoField, OneToOneField, PositiveSmallIntegerField, ForeignKey, FloatField, \
    CharField, IntegerField, JSONField, BooleanField
from rest_framework.response import Response
from rest_framework.views import APIView
from django.apps import apps

from osrd_infra.models import Component, get_entity_meta, get_component_meta
from osrd_infra.models.ecs import EntityBase, Entity


def get_type(klass):
    if isinstance(klass, BooleanField):
        return 'boolean'
    if isinstance(klass, (BigAutoField, IntegerField)):
        return 'integer'
    if isinstance(klass, PositiveSmallIntegerField):
        return 'positive_integer'
    if isinstance(klass, FloatField):
        return 'float'
    if isinstance(klass, CharField):
        return 'string'
    if isinstance(klass, PointField):
        return 'geom_point'
    if isinstance(klass, PolygonField):
        return 'geom_polygon'
    if isinstance(klass, LineStringField):
        return 'geom_line'
    if isinstance(klass, MultiLineStringField):
        return 'geom_multiline'
    if isinstance(klass, JSONField):
        return 'json'
    if isinstance(klass, (OneToOneField, ForeignKey)):
        entity_meta = getattr(klass.related_model, "_entity_meta", None)
        if entity_meta is not None:
            return entity_meta.name
        if isinstance(klass.related_model, EntityBase):
            return 'entity'
        raise NotImplementedError
    print(type(klass), klass)
    raise NotImplementedError


def get_schema():
    entities = []
    for model in apps.get_app_config("osrd_infra").get_models():
        if Entity not in model.__bases__:
            continue
        entity_meta = get_entity_meta(model)
        entities.append({
            'entity_name': entity_meta.name,
            'components': list(entity_meta.component_names()),
        })
    components = []
    for model in apps.get_app_config("osrd_infra").get_models():
        if Component not in model.__bases__:
            continue
        component_meta = get_component_meta(model)
        components.append({
            'component_name': component_meta.name,
            'unique': component_meta.unique,
            'fields': [{
                'name': field.name,
                'type': get_type(field),
            } for field in model._meta.fields],
        })
    return {'entities': entities, 'components': components}


class SchemaView(APIView):
    def get(self, request, format=None):
        return Response(get_schema())
