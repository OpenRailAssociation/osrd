from osrd_infra.serializers import InfraSerializer
from osrd_infra.models import Infra, EntityNamespace
from rest_framework.viewsets import GenericViewSet
from rest_framework import mixins
from rest_framework.decorators import action
from rest_framework.exceptions import ParseError
from django.contrib.gis.geos import GEOSGeometry

from osrd_infra.views.geojson import geojson_query_infra
from osrd_infra.views.railjson import railjson_serialize_infra
from osrd_infra.views.edit import edit_infra


class InfraView(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    mixins.ListModelMixin,
    GenericViewSet,
):
    queryset = Infra.objects.all()
    serializer_class = InfraSerializer

    def perform_create(self, serializer):
        namespace = EntityNamespace()
        namespace.save()
        serializer.save(owner=self.request.user.sub, namespace=namespace)

    @action(detail=True, methods=["get"])
    def geojson(self, request, pk=None):
        query_string = request.query_params.get("query")
        if query_string is None:
            raise ParseError("missing query parameter")
        query = GEOSGeometry(query_string)

        return geojson_query_infra(self.get_object(), query)

    @action(detail=True, methods=["get"])
    def railjson(self, request, pk=None):
        return railjson_serialize_infra(self.get_object())

    @action(detail=True, methods=["post"])
    def edit(self, request, pk=None):
        return edit_infra(self.get_object(), request.data)
