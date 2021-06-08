from rest_framework.response import Response
from rest_framework.views import APIView
from django.apps import apps

from osrd_infra.models import Entity, Component, get_entity_meta, get_component_meta


class SchemaView(APIView):
    def get(self, request, format=None):
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
            components.append({
                'component_name': get_component_meta(model).name,
                'fields': [field.name for field in model._meta.fields],
            })
        return Response({'entities': entities, 'components': components})
