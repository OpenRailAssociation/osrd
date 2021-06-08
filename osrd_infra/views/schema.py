from rest_framework.response import Response
from rest_framework.views import APIView
from django.apps import apps

from osrd_infra.models import Entity, Component


class SchemaView(APIView):
    def get(self, request, format=None):
        entities = []
        for model in apps.get_app_config("osrd_infra").get_models():
            if Entity not in model.__bases__:
                continue
            entity_meta = model._entity_meta
            entities.append({
                'entity_name': model.__name__,
                'components': list(map(lambda component: component.__name__, entity_meta.components)),
            })
        components = []
        for model in apps.get_app_config("osrd_infra").get_models():
            if Component not in model.__bases__:
                continue
            components.append({
                'component_name': model.__name__,
                'fields': list(map(lambda field: field.name, model._meta.fields)),
            })
        return Response({'entities': entities, 'components': components})
