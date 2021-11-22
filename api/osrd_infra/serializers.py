from rest_framework import serializers
from rest_framework.serializers import (
    Field,
    ModelSerializer,
    Serializer,
    SerializerMethodField,
)
from rest_framework_gis.fields import GeometryField

from osrd_infra.models import (
    ALL_COMPONENT_TYPES,
    ALL_ENTITY_TYPES,
    ApplicableDirection,
    ApplicableDirectionComponent,
    Component,
    Endpoint,
    Infra,
    Path,
    RollingStock,
    Timetable,
    TrackSectionLinkComponent,
    TrainSchedule,
    TrainScheduleLabel,
    get_component_meta,
    get_entity_meta,
)
from osrd_infra.models.common import EnumSerializer


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


class ComponentSerializer(ModelSerializer):
    registry = {}

    def __init_subclass__(cls, **kwargs):
        model = cls.Meta.model
        assert issubclass(model, Component), f"{model} isn't a subclass of Component"
        cls.registry[cls.Meta.model] = cls
        super().__init_subclass__(**kwargs)

    def __init__(self, *args, omit_entity_id=False, **kwargs):
        # Instantiate the superclass normally
        super().__init__(*args, **kwargs)

        assert "entity" in self.fields
        assert "component_id" in self.fields

        if omit_entity_id:
            self.fields.pop("entity")


def serialize_components(entity):
    entity_meta = get_entity_meta(entity.get_concrete_type())

    res = {}
    for comp_model in entity_meta.components:
        comp_meta = get_component_meta(comp_model)
        comp_serializer = ComponentSerializer.registry[comp_model]
        field = getattr(entity, comp_meta.related_name, None)
        if not field:
            continue
        if comp_meta.unique:
            serialized = comp_serializer(field, omit_entity_id=True).data
        else:
            serialized = [comp_serializer(related, omit_entity_id=True).data for related in field.all()]
        res[comp_meta.name] = serialized
    return res


def serialize_entity(entity):
    return {
        "entity_id": entity.entity_id,
        "entity_type": get_entity_meta(entity.get_concrete_type()).name,
        "components": serialize_components(entity),
    }


class EntitySerializer(ModelSerializer):
    components = SerializerMethodField("get_components")

    def get_components(self, obj):
        return serialize_components(obj)


class InfraSerializer(ModelSerializer):
    class Meta:
        model = Infra
        exclude = ["namespace"]


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


# COMPONENT SERIALIZERS


class TrackSectionLinkComponentSerializer(ComponentSerializer):
    begin_endpoint = EnumSerializer(Endpoint)
    end_endpoint = EnumSerializer(Endpoint)

    class Meta:
        model = TrackSectionLinkComponent
        fields = "__all__"


class ApplicableDirectionComponentSerializer(ComponentSerializer):
    applicable_direction = EnumSerializer(ApplicableDirection)

    class Meta:
        model = ApplicableDirectionComponent
        fields = "__all__"


# generate component serializers which weren't explicitly declared


def generate_serializer(model, parent_class, extra_meta={}):
    meta_attrs = {
        "model": model,
        **extra_meta,
    }
    meta = type("Meta", (), meta_attrs)
    attrs = {"Meta": meta}
    serializer_name = model.__name__ + "Serializer"
    return type(serializer_name, (parent_class,), attrs)


for component_type in ALL_COMPONENT_TYPES.values():
    if component_type in ComponentSerializer.registry:
        continue
    serializer = generate_serializer(component_type, ComponentSerializer, {"fields": "__all__"})
    globals()[serializer.__name__] = serializer


# ENTITY SERIALIZERS

ALL_ENTITY_SERIALIZERS = []

for entity_type in ALL_ENTITY_TYPES.values():
    serializer = generate_serializer(entity_type, EntitySerializer, {"fields": ["entity_id", "components"]})
    ALL_ENTITY_SERIALIZERS.append(serializer)
    globals()[serializer.__name__] = serializer
