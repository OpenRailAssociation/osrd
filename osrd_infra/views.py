from rest_framework.viewsets import ReadOnlyModelViewSet

from .models import Infra, TrackSection, Signal
from .serializers import InfraSerializer, TrackSectionSerializer, SignalSerializer


class InfraViewSet(ReadOnlyModelViewSet):
    serializer_class = InfraSerializer

    def get_queryset(self):
        # return Infra.objects.filter(owner=self.request.user.sub)
        return Infra.objects.all()


class TrackSectionViewSet(ReadOnlyModelViewSet):
    serializer_class = TrackSectionSerializer

    def get_queryset(self):
        # return Infra.objects.filter(owner=self.request.user.sub)
        return TrackSection.objects.all()


class SignalViewSet(ReadOnlyModelViewSet):
    serializer_class = SignalSerializer

    def get_queryset(self):
        # return Infra.objects.filter(owner=self.request.user.sub)
        return Signal.objects.all()
