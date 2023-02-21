from typing import Dict

from osrd_schemas.rolling_stock import ComfortType
from rest_framework import serializers
from rest_framework.serializers import (
    HyperlinkedModelSerializer,
    ModelSerializer,
    Serializer,
)
from rest_framework_gis.fields import GeometryField
from rest_framework_nested.serializers import NestedHyperlinkedModelSerializer

from osrd_infra.models import (
    Infra,
    PathModel,
    Project,
    RollingStock,
    RollingStockCompoundImage,
    RollingStockLivery,
    RollingStockSeparatedImage,
    Scenario,
    Study,
    Timetable,
    TrainScheduleModel,
)
from osrd_infra.models.electrical_profiles import ElectricalProfileSet


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


class RollingStockLiverySerializer(NestedHyperlinkedModelSerializer):
    parent_lookup_kwargs = {
        "rolling_stock_pk": "rolling_stock__pk",
    }

    class Meta:
        model = RollingStockLivery
        fields = ["name", "id"]
        extra_kwargs = {
            "url": {
                "view_name": "rolling_stock_livery-detail",
            }
        }


class RollingStockSerializer(ModelSerializer):
    liveries = RollingStockLiverySerializer(many=True, required=False)

    class Meta:
        model = RollingStock
        exclude = ["image"]
        extra_kwargs = {
            "url": {
                "view_name": "rolling_stock-detail",
            }
        }


class LightRollingStockSerializer(ModelSerializer):
    liveries = RollingStockLiverySerializer(many=True)

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


class CreateRollingStockLiverySerializer(Serializer):
    rolling_stock_id = serializers.IntegerField()
    livery_name = serializers.CharField(max_length=255)
    images = serializers.ListField(min_length=1, child=serializers.FileField())
    compound_image = serializers.FileField()

    def create(self, validated_data):
        rolling_stock = RollingStock.objects.get(pk=validated_data["rolling_stock_id"])
        images = validated_data["images"]
        compound_image = validated_data["compound_image"]

        compound_image = RollingStockCompoundImage(image=compound_image.open(mode="rb").read())
        compound_image.save()

        livery = RollingStockLivery(
            rolling_stock=rolling_stock, name=validated_data["livery_name"], compound_image=compound_image
        )
        livery.save()

        for i in range(len(images)):
            image = images[i]
            RollingStockSeparatedImage(livery=livery, order=i, image=image.open(mode="rb").read()).save()
        return


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
            "modes_and_profiles",
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
                "modes_and_profiles",
            ]

    timetable = serializers.PrimaryKeyRelatedField(queryset=Timetable.objects.all())
    path = serializers.PrimaryKeyRelatedField(queryset=PathModel.objects.all())
    schedules = serializers.ListField(min_length=1, child=Schedule())

    def validate(self, data: Dict) -> Dict:
        path = data["path"]
        timetable = data["timetable"]
        if path.infra != timetable.infra:
            raise serializers.ValidationError("path and timteable doesn't have the same infra")
        return data

    def create(self, validated_data) -> list[TrainScheduleModel]:
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
    speed_limit_tags = serializers.CharField(max_length=255, required=False, allow_null=True)
    margin_before = serializers.FloatField(required=False, allow_null=True)
    margin_after = serializers.FloatField(required=False, allow_null=True)
    standard_allowance = serializers.JSONField(required=False, allow_null=True)


# STUDY


class ScenarioSerializer(NestedHyperlinkedModelSerializer):
    parent_lookup_kwargs = {
        "study_pk": "study__pk",
        "project_pk": "study__project__pk",
    }

    timetable = serializers.PrimaryKeyRelatedField(many=False, read_only=True)
    infra = serializers.PrimaryKeyRelatedField(queryset=Infra.objects.all())
    electrical_profile_set = serializers.PrimaryKeyRelatedField(queryset=ElectricalProfileSet.objects.all())

    trains_count = serializers.SerializerMethodField("count_trains")
    infra_name = serializers.SerializerMethodField("get_infra_name")
    electrical_profile_set_name = serializers.SerializerMethodField("get_electrical_profile_set_name")

    def count_trains(self, scenario: Scenario):
        return len(scenario.timetable.train_schedules.all())

    def get_infra_name(self, scenario: Scenario):
        return scenario.infra.name

    def get_electrical_profile_set_name(self, scenario: Scenario):
        if scenario.electrical_profile_set is None:
            return None
        else:
            return scenario.electrical_profile_set.name

    class Meta:
        model = Scenario
        fields = (
            "id",
            "name",
            "description",
            "timetable",
            "infra",
            "electrical_profile_set",
            "trains_count",
            "creation_date",
            "last_modification",
            "tags",
            "infra_name",
            "electrical_profile_set_name",
        )


class StudySerializer(NestedHyperlinkedModelSerializer):

    scenarios = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    parent_lookup_kwargs = {
        "project_pk": "project__pk",
    }

    class Meta:
        model = Study
        fields = (
            "id",
            "name",
            "description",
            "business_code",
            "service_code",
            "creation_date",
            "last_modification",
            "start_date",
            "expected_end_date",
            "actual_end_date",
            "budget",
            "tags",
            "state",
            "type",
            "scenarios",
        )


class ProjectSerializer(HyperlinkedModelSerializer):

    studies = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    image_url = serializers.SerializerMethodField("get_image_url")

    def get_image_url(self, obj):
        request = self.context.get("request")
        if obj.image and request:
            return request.build_absolute_uri(f"/projects/{obj.pk}/image/")
        return None

    class Meta:
        model = Project
        fields = (
            "image_url",
            "id",
            "name",
            "objectives",
            "description",
            "funders",
            "image",
            "budget",
            "creation_date",
            "last_modification",
            "studies",
            "tags",
        )
        extra_kwargs = {
            "image_url": {
                "view_name": "projects-detail",
            },
            "image": {"write_only": True},
        }
