from rest_framework.viewsets import ReadOnlyModelViewSet

from osrd_infra.models import (
    Infra,
    TrackSectionEntity,
    TrackSectionLinkEntity,
    SwitchEntity,
    SignalEntity,
    OperationalPointEntity,
)
from osrd_infra.serializers import (
    InfraSerializer,
    TrackSectionSerializer,
    TrackSectionLinkSerializer,
    SignalSerializer,
    OperationalPointSerializer,
    SwitchSerializer,
)


class InfraViewSet(ReadOnlyModelViewSet):
    serializer_class = InfraSerializer
    queryset = Infra.objects.all()


class TrackSectionViewSet(ReadOnlyModelViewSet):
    serializer_class = TrackSectionSerializer

    def get_queryset(self):
        return TrackSectionEntity.objects.all()


class TrackSectionLinkViewSet(ReadOnlyModelViewSet):
    serializer_class = TrackSectionLinkSerializer

    def get_queryset(self):
        return TrackSectionLinkEntity.objects.all()


class SwitchViewSet(ReadOnlyModelViewSet):
    serializer_class = SwitchSerializer

    def get_queryset(self):
        return SwitchEntity.objects.all()


class SignalViewSet(ReadOnlyModelViewSet):
    serializer_class = SignalSerializer

    def get_queryset(self):
        return SignalEntity.objects.all()


class OperationalPointViewSet(ReadOnlyModelViewSet):
    serializer_class = OperationalPointSerializer

    def get_queryset(self):
        return OperationalPointEntity.objects.all()
