from rest_framework.viewsets import ReadOnlyModelViewSet, ModelViewSet

from osrd_infra.models import (
    Infra,
    TrackSectionEntity,
    SwitchEntity,
    SignalEntity,
    OperationalPointEntity,
)
from osrd_infra.serializers import (
    InfraSerializer,
    TrackSectionSerializer,
    SignalSerializer,
    OperationalPointSerializer,
    SwitchSerializer,
)


class InfraViewSet(ModelViewSet):
    serializer_class = InfraSerializer
    queryset = Infra.objects.all()


class TrackSectionViewSet(ModelViewSet):
    serializer_class = TrackSectionSerializer

    def get_queryset(self):
        return TrackSectionEntity.objects.all()


class SwitchViewSet(ModelViewSet):
    serializer_class = SwitchSerializer

    def get_queryset(self):
        return SwitchEntity.objects.all()


class SignalViewSet(ModelViewSet):
    serializer_class = SignalSerializer

    def get_queryset(self):
        return SignalEntity.objects.all()


class OperationalPointViewSet(ModelViewSet):
    serializer_class = OperationalPointSerializer

    def get_queryset(self):
        return OperationalPointEntity.objects.all()


class SwitchViewSet(ModelViewSet):
    serializer_class = SwitchSerializer

    def get_queryset(self):
        return SwitchEntity.objects.all()
