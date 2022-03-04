from rest_framework import serializers
from rest_framework.serializers import ModelSerializer, Serializer
from rest_framework_gis.fields import GeometryField

from osrd_infra.models import (
    Infra,
    PathModel,
    RollingStock,
    Timetable,
    TrainScheduleModel,
)


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
            track_section = serializers.CharField(max_length=255)
            geo_coordinate = serializers.JSONField(required=False)
            offset = serializers.FloatField(required=False)

        duration = serializers.FloatField()
        waypoints = serializers.ListField(child=WaypointInputSerializer(), allow_empty=False)

    infra = serializers.PrimaryKeyRelatedField(queryset=Infra.objects.all())
    steps = serializers.ListField(
        min_length=2,
        child=StepInputSerializer(),
    )


class PathSerializer(ModelSerializer):
    class Meta:
        model = PathModel
        exclude = ["infra", "payload", "slopes", "curves"]


# TIMETABLE / SIMULATION


class TimetableSerializer(ModelSerializer):
    class Meta:
        model = Timetable
        fields = "__all__"


class TrainScheduleSerializer(ModelSerializer):
    class Meta:
        model = TrainScheduleModel
        exclude = [
            "mrsp",
            "base_simulation",
            "eco_simulation",
        ]


class StandaloneSimulationSerializer(Serializer):
    class Schedule(ModelSerializer):
        class Meta:
            model = TrainScheduleModel
            exclude = [
                "timetable",
                "path",
                "mrsp",
                "base_simulation",
                "eco_simulation",
            ]

    timetable = serializers.PrimaryKeyRelatedField(queryset=Timetable.objects.all())
    path = serializers.PrimaryKeyRelatedField(queryset=PathModel.objects.all())
    schedules = serializers.ListField(min_length=1, child=Schedule())

    def validate(self, data):
        path = data["path"]
        timetable = data["timetable"]
        if path.infra != timetable.infra:
            raise serializers.ValidationError("path and timteable doesn't have the same infra")
        return data

    def create(self, validated_data):
        schedules = []
        timetable = validated_data["timetable"]
        path = validated_data["path"]
        for schedule in validated_data["schedules"]:
            schedules.append(TrainScheduleModel(timetable=timetable, path=path, **schedule))
        return schedules
