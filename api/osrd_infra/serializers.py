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
from osrd_infra.schemas.rolling_stock import ComfortType


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
        exclude = ["image"]


class LightRollingStockSerializer(ModelSerializer):
    def to_representation(self, instance):
        """
        Light representation of a rolling stock, removing all effort curves
        """
        ret = super().to_representation(instance)
        for mode in ret["effort_curves"]["modes"].values():
            mode.pop("curves")
            mode.pop("default_curve")
        return ret

    class Meta:
        model = RollingStock
        exclude = ["image"]


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
    steps = serializers.ListField(min_length=2, child=StepInputSerializer())
    rolling_stocks = serializers.ListField(
        child=serializers.PrimaryKeyRelatedField(queryset=RollingStock.objects.all()),
        required=False,
    )


class PathOPInputSerializer(Serializer):
    class StepInputSerializer(Serializer):
        duration = serializers.FloatField()
        op_trigram = serializers.CharField(min_length=1, max_length=3)

    infra = serializers.PrimaryKeyRelatedField(queryset=Infra.objects.all())
    steps = serializers.ListField(min_length=2, child=StepInputSerializer())
    rolling_stocks = serializers.ListField(
        child=serializers.PrimaryKeyRelatedField(queryset=RollingStock.objects.all()),
        required=False,
    )


class PathSerializer(ModelSerializer):
    class Meta:
        model = PathModel
        exclude = ["infra", "payload"]


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


# STDCM


class STDCMInputSerializer(Serializer):
    class WaypointInputSerializer(Serializer):
        track_section = serializers.CharField(max_length=255)
        geo_coordinate = serializers.JSONField(required=False)
        offset = serializers.FloatField(required=False)

    infra = serializers.PrimaryKeyRelatedField(queryset=Infra.objects.all())
    timetable = serializers.PrimaryKeyRelatedField(queryset=Timetable.objects.all())
    start_time = serializers.FloatField(required=False, allow_null=True)
    end_time = serializers.FloatField(required=False, allow_null=True)
    start_points = serializers.ListField(
        min_length=1,
        child=WaypointInputSerializer(),
    )
    end_points = serializers.ListField(
        min_length=1,
        child=WaypointInputSerializer(),
    )
    rolling_stock = serializers.PrimaryKeyRelatedField(queryset=RollingStock.objects.all())
    comfort = serializers.ChoiceField(choices=[(x.value, x.name) for x in ComfortType], default=ComfortType.STANDARD)
    maximum_departure_delay = serializers.FloatField(required=False, allow_null=True)
    maximum_relative_run_time = serializers.FloatField(required=False, allow_null=True)
    speed_limit_composition = serializers.CharField(max_length=255, required=False, allow_null=True)
    margin_before = serializers.FloatField(required=False, allow_null=True)
    margin_after = serializers.FloatField(required=False, allow_null=True)
    standard_allowance = serializers.JSONField(required=False, allow_null=True)
