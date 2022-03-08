from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponse
from rest_framework import mixins, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from osrd_infra.models import Infra
from osrd_infra.schemas.infra import RAILJSON_VERSION
from osrd_infra.serializers import InfraSerializer
from osrd_infra.views.railjson import import_infra, serialize_infra


class InfraView(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    mixins.ListModelMixin,
    GenericViewSet,
):
    queryset = Infra.objects.order_by("-modified")
    serializer_class = InfraSerializer

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user.sub)

    @action(url_path="railjson", detail=True, methods=["get"])
    def get_railjson(self, request, pk=None):
        infra = self.get_object()
        # Check version
        if infra.railjson_version != RAILJSON_VERSION:
            return Response(
                f"Invalid infra version expected: '{RAILJSON_VERSION}' got '{infra.railjson_version}'", status=500
            )

        # Check redis cache
        cache_key = f"osrd.infra.{pk}"
        railjson = cache.get(cache_key)
        if railjson is not None:
            return HttpResponse(railjson, content_type="application/json")

        # Serialize infra
        railjson = serialize_infra(infra)
        cache.set(cache_key, railjson, timeout=settings.CACHE_TIMEOUT)
        return HttpResponse(railjson, content_type="application/json")

    @action(url_path="railjson", detail=False, methods=["post"])
    def post_railjson(self, request):
        infra_name = request.query_params.get("name", "unknown")
        infra = import_infra(request.data, infra_name)
        return Response({"id": infra.id}, status=status.HTTP_201_CREATED)
