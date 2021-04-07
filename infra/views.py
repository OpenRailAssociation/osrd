from rest_framework.viewsets import ReadOnlyModelViewSet

from infra.models import Infra
from infra.serializers import InfraSerializer


class InfraViewSet(ReadOnlyModelViewSet):
    serializer_class = InfraSerializer

    def get_queryset(self):
        return Infra.objects.filter(owner=self.request.user.sub)
