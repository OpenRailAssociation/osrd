from osrd_infra.serializers import RollingStockSerializer, LightRollingStockSerializer
from osrd_infra.models import RollingStock
from rest_framework.viewsets import GenericViewSet
from rest_framework import mixins
from rest_framework.response import Response
from rest_framework.decorators import action


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
