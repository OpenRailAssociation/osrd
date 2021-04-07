from rest_framework.serializers import ModelSerializer

from infra.models import Infra


class InfraSerializer(ModelSerializer):
    class Meta:
        model = Infra
        fields = ['name', 'owner', 'created', 'modified']
