from osrd_infra.models.physical_approximations import ElectricalProfilesSet
from osrd_infra.serializers import ElectricalProfileSetSerializer

from rest_framework import mixins
from rest_framework.viewsets import GenericViewSet


class ElectricalProfileSetView(
    mixins.RetrieveModelMixin,
    mixins.ListModelMixin,
    GenericViewSet,
):
    queryset = ElectricalProfilesSet.objects.order_by("id")
    serializer_class = ElectricalProfileSetSerializer
