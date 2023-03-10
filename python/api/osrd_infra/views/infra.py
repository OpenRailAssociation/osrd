from pathlib import Path

from django.db import connection
from django.http import HttpResponse
from osrd_schemas.infra import RailJsonInfra
from rest_framework import mixins, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from osrd_infra.models import Infra
from osrd_infra.serializers import InfraSerializer
from osrd_infra.views.railjson import import_infra, serialize_infra

CURRENT_DIR = Path(__file__).parent
GET_SPEED_LIMIT_TAGS = open(CURRENT_DIR / "sql/get_speed_limit_tags.sql").read()
GET_VOLTAGES = open(CURRENT_DIR / "sql/get_voltages.sql").read()


class InfraView(
    mixins.RetrieveModelMixin,
    mixins.ListModelMixin,
    GenericViewSet,
):
    queryset = Infra.objects.order_by("-pk")
    serializer_class = InfraSerializer

    @action(url_path="railjson", detail=True, methods=["get"])
    def get_railjson(self, request, pk=None):
        exclude_extensions = request.query_params.get("exclude_extensions", "false").lower() == "true"
        railjson = serialize_infra(self.get_object(), exclude_extensions)
        return HttpResponse(railjson, content_type="application/json")

    @action(url_path="railjson", detail=False, methods=["post"])
    def post_railjson(self, request):
        infra_name = request.query_params.get("name", "unknown")
        infra = import_infra(request.data, infra_name)
        return Response({"id": infra.id}, status=status.HTTP_201_CREATED)

    @action(url_path="schema", detail=False, methods=["get"])
    def get_schema(self, request):
        """Returns infra schema"""
        return Response(RailJsonInfra.schema())

    @action(detail=True, methods=["get"])
    def speed_limit_tags(self, request, pk=None):
        """Returns the set of speed limit tags for a given infra"""
        # Check if infra exists
        self.get_object()

        with connection.cursor() as cursor:
            cursor.execute(GET_SPEED_LIMIT_TAGS, [pk])
            res = [row[0] for row in cursor]
        return Response(res)

    @action(detail=True, methods=["get"])
    def voltages(self, request, pk=None):
        """Returns the set of voltages for a given infra"""
        # Check if infra exists
        self.get_object()

        with connection.cursor() as cursor:
            cursor.execute(GET_VOLTAGES, [pk])
            res = [row[0] for row in cursor]
        return Response(res)
