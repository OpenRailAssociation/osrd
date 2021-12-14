from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponse
from rest_framework import mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from osrd_infra.models import Infra
from osrd_infra.serializers import InfraSerializer
from osrd_infra.views.railjson import railjson_serialize_infra


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

    @action(detail=True, methods=["get"])
    def railjson(self, request, pk=None):
        cache_key = f"osrd.infra.{pk}"
        infra = cache.get(cache_key)
        if infra is not None:
            return HttpResponse(infra, content_type="application/json")
        infra = railjson_serialize_infra(self.get_object())
        cache.set(cache_key, infra, timeout=settings.CACHE_TIMEOUT)
        return HttpResponse(infra, content_type="application/json")

    """TODO: Fix with new models
    @action(detail=True, methods=["post"])
    def edit(self, request, pk=None):
        return edit_infra(self.get_object(), request.data)
    """
