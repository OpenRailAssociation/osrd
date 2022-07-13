from django.http import HttpResponse
from rest_framework import mixins, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from osrd_infra.models import Infra
from osrd_infra.schemas.infra import RailJsonInfra
from osrd_infra.serializers import InfraSerializer
from osrd_infra.views.railjson import import_infra, serialize_infra


class InfraView(
    mixins.RetrieveModelMixin,
    mixins.ListModelMixin,
    GenericViewSet,
):
    queryset = Infra.objects.order_by("-pk")
    serializer_class = InfraSerializer

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user.sub)

    @action(url_path="railjson", detail=True, methods=["get"])
    def get_railjson(self, request, pk=None):
        railjson = serialize_infra(self.get_object())
        return HttpResponse(railjson, content_type="application/json")

    @action(url_path="railjson", detail=False, methods=["post"])
    def post_railjson(self, request):
        infra_name = request.query_params.get("name", "unknown")
        infra = import_infra(request.data, infra_name)
        return Response({"id": infra.id}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"])
    def schema(self, request):
        return Response(RailJsonInfra.schema())
