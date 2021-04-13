from rest_framework.serializers import ModelSerializer, CharField, FloatField, PrimaryKeyRelatedField

from .models import Infra, TrackSection, Signal


class InfraSerializer(ModelSerializer):
    class Meta:
        model = Infra
        fields = '__all__'


class IdentifiedMixin():
    name = CharField()



class TrackSectionSerializer(ModelSerializer, IdentifiedMixin):
    class Meta:
        model = TrackSection
        fields = ["name", "path"]


class SignalSerializer(ModelSerializer, IdentifiedMixin):
    track_section = PrimaryKeyRelatedField(read_only=True)
    offset = FloatField()

    class Meta:
        model = Signal
        fields = ["track_section", "offset", "name"]
