from rest_framework import mixins
from rest_framework.viewsets import GenericViewSet

from osrd_infra.models import RollingStock
from osrd_infra.serializers import LightRollingStockSerializer, RollingStockSerializer
from osrd_infra.views.pagination import CustomPageNumberPagination


class RollingStockView(
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    GenericViewSet,
):
    queryset = RollingStock.objects.order_by("id")
    serializer_class = RollingStockSerializer
    pagination_class = CustomPageNumberPagination


class LightRollingStockView(
    mixins.RetrieveModelMixin,
    mixins.ListModelMixin,
    GenericViewSet,
):
    queryset = RollingStock.objects.order_by("id")
    serializer_class = LightRollingStockSerializer
    pagination_class = CustomPageNumberPagination
