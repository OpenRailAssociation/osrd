from osrd_infra.serializers import InfraSerializer
from osrd_infra.models import Infra, EntityNamespace
from rest_framework.generics import ListCreateAPIView


class InfraView(ListCreateAPIView):
    queryset = Infra.objects.all()
    serializer_class = InfraSerializer

    def perform_create(self, serializer):
        namespace = EntityNamespace()
        namespace.save()
        serializer.save(owner=self.request.user.sub, namespace=namespace)
