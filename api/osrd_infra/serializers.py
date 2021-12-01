from rest_framework import serializers
from rest_framework.serializers import (
    Field,
    ModelSerializer,
    Serializer,
    SerializerMethodField,
)
from rest_framework_gis.fields import GeometryField

from osrd_infra.models import (
    Infra,
    Path,
    RollingStock,
    Timetable,
    TrainSchedule,
    TrainScheduleLabel,
)
from osrd_infra.models.common import EnumSerializer
from osrd_infra.models.schemas import ApplicableDirections, Endpoint


# monkey patch rest_framework_gis so that it properly converts
# geojson geometries when serializing
def wrap_to_representation(original_to_representation):
    def _wrapper(self, value):
        if value is None or isinstance(value, dict):
            return value
        # geojson only supports this srid
        value = value.transform(4326, clone=True)
        return original_to_representation(self, value)

    return _wrapper


GeometryField.to_representation = wrap_to_representation(GeometryField.to_representation)


class InfraSerializer(ModelSerializer):
    class Meta:
        model = Infra
        fields = "__all__"


class RollingStockSerializer(ModelSerializer):
    class Meta:
        model = RollingStock
        fields = "__all__"


class LightRollingStockSerializer(ModelSerializer):
    class Meta:
        model = RollingStock
        exclude = ["tractive_effort_curves", "rolling_resistance"]


# PATH FINDING


class PathInputSerializer(Serializer):
    class StepInputSerializer(Serializer):
        class WaypointInputSerializer(Serializer):
            track_section = serializers.IntegerField(min_value=0)
            geo_coordinate = serializers.JSONField(required=False)
            offset = serializers.FloatField(required=False)

        stop_time = serializers.FloatField()
        waypoints = serializers.ListField(child=WaypointInputSerializer(), allow_empty=False)

    infra = serializers.PrimaryKeyRelatedField(queryset=Infra.objects.all())
    name = serializers.CharField(max_length=256)
    steps = serializers.ListField(
        min_length=2,
        child=StepInputSerializer(),
    )


class PathSerializer(ModelSerializer):
    class Meta:
        model = Path
        exclude = ["namespace", "payload"]


# TIMETABLE


class TimetableSerializer(ModelSerializer):
    class Meta:
        model = Timetable
        fields = "__all__"


class LabelsField(Field):
    def to_representation(self, value):
        return [label.label for label in value.all()]

    def to_internal_value(self, data):
        return [TrainScheduleLabel.objects.get_or_create(label=label)[0].pk for label in data]


class TrainScheduleSerializer(ModelSerializer):
    labels = LabelsField(default=[])

    class Meta:
        model = TrainSchedule
        exclude = [
            "base_simulation_log",
            "eco_simulation_log",
        ]
