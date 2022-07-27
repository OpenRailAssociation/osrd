from rest_framework import mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from osrd_infra.models import RollingStock
from osrd_infra.serializers import LightRollingStockSerializer, RollingStockSerializer
from osrd_infra.views.pagination import CustomPageNumberPagination


class RollingStockView(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    mixins.UpdateModelMixin,
    mixins.ListModelMixin,
    GenericViewSet,
):
    queryset = RollingStock.objects.order_by("id")
    serializer_class = RollingStockSerializer
    pagination_class = CustomPageNumberPagination

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user.sub)

    @action(detail=True, methods=["get"])
    def railjson(self, request, pk=None):
        return Response(self.get_object().to_railjson())


class LightRollingStockView(
    mixins.RetrieveModelMixin,
    mixins.ListModelMixin,
    GenericViewSet,
):
    queryset = RollingStock.objects.order_by("id")
    serializer_class = LightRollingStockSerializer
    pagination_class = CustomPageNumberPagination
