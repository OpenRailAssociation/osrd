from rest_framework.viewsets import ReadOnlyModelViewSet, ModelViewSet

from osrd_infra.models import Infra, TrackSection, Signal, OperationalPoint, Switch
from osrd_infra.serializers import (
    InfraSerializer,
    TrackSectionSerializer,
    SignalSerializer,
    OperationalPointSerializer,
    SwitchSerializer,
)


class InfraViewSet(ModelViewSet):
    serializer_class = InfraSerializer

    def get_queryset(self):
        # return Infra.objects.filter(owner=self.request.user.sub)
        return Infra.objects.all()


class TrackSectionViewSet(ModelViewSet):
    serializer_class = TrackSectionSerializer

    def get_queryset(self):
        # return Infra.objects.filter(owner=self.request.user.sub)
        return TrackSection.objects.all()


class SignalViewSet(ModelViewSet):
    serializer_class = SignalSerializer

    def get_queryset(self):
        # return Infra.objects.filter(owner=self.request.user.sub)
        return Signal.objects.all()


class OperationalPointViewSet(ModelViewSet):
    serializer_class = OperationalPointSerializer

    def get_queryset(self):
        # return Infra.objects.filter(owner=self.request.user.sub)
        return OperationalPoint.objects.all()


class SwitchViewSet(ModelViewSet):
    serializer_class = SwitchSerializer

    def get_queryset(self):
        return Switch.objects.all()
