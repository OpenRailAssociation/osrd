from rest_framework.serializers import ModelSerializer, CharField, FloatField, PrimaryKeyRelatedField

from .models import Infra, TrackSection, Signal, Identifier, TrackSectionLocation, OperationalPoint, OperationalPointPart, TrackSectionRange, Switch

from .models.common import Endpoint, EnumSerializer


class InfraSerializer(ModelSerializer):
    class Meta:
        model = Infra
        fields = '__all__'


class IdentitySerializer(ModelSerializer):
    class Meta:
        model = Identifier
        exclude = ["id", "entity_id"]


class TrackSectionLocationSerializer(ModelSerializer):
    class Meta:
        model = TrackSectionLocation
        exclude = ["id", "entity_id"]


class TrackSectionRangeSerializer(ModelSerializer):
    class Meta:
        model = TrackSectionRange
        exclude = ["id", "entity_id"]


class TrackSectionSerializer(ModelSerializer):
    identity = IdentitySerializer()
    class Meta:
        model = TrackSection
        exclude = ["infra"]


class SwitchSerializer(ModelSerializer):
    base_endpoint = EnumSerializer(enum=Endpoint)
    left_endpoint = EnumSerializer(enum=Endpoint)
    right_endpoint = EnumSerializer(enum=Endpoint)

    identity = IdentitySerializer()

    class Meta:
        model = Switch
        fields = "__all__"


class SignalSerializer(ModelSerializer):
    identity = IdentitySerializer()
    location = TrackSectionLocationSerializer()

    class Meta:
        model = Signal
        fields = "__all__"


class OperationalPointSerializer(ModelSerializer):
    identity = IdentitySerializer()
    parts = PrimaryKeyRelatedField(many=True, read_only=True)

    class Meta:
        model = OperationalPoint
        fields = "__all__"


class OperationalPointPartSerializer(ModelSerializer):
    track_range = TrackSectionRangeSerializer()

    class Meta:
        model = OperationalPointPart
        fields = "__all__"
