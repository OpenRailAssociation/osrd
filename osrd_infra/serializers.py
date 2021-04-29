from rest_framework.serializers import (
    ModelSerializer,
    StringRelatedField,
)

from osrd_infra.models import (
    # infra
    Infra,
    IdentifierComponent,
    TrackSectionLocationComponent,
    TrackSectionRangeComponent,
    TrackSectionComponent,
    TrackSectionLinkComponent,
    TrackSectionEntity,
    TrackSectionLinkEntity,
    SwitchEntity,
    OperationalPointEntity,
    SignalEntity,
    # ecs
    Component,
)

from osrd_infra.models.common import Endpoint, EnumSerializer


class ComponentSerializer(ModelSerializer):
    _registry = {}

    def __init_subclass__(cls, **kwargs):
        model = cls.Meta.model
        assert issubclass(model, Component), f"{model} isn't a subclass of Component"
        cls._registry[cls.Meta.model] = cls
        super().__init_subclass__(**kwargs)

    def __init__(self, *args, omit_entity_id=False, **kwargs):
        # Instantiate the superclass normally
        super().__init__(*args, **kwargs)

        assert "entity" in self.fields
        assert "component_id" in self.fields

        if omit_entity_id:
            self.fields.pop("entity")


class EntitySerializerBase(type(ModelSerializer)):
    def __new__(cls, name, bases, attrs, entity_serializer_passthrough=False):
        meta = attrs.get("Meta", None)
        if meta is None or entity_serializer_passthrough:
            return super().__new__(cls, name, bases, attrs)

        model = meta.model
        entity_meta = getattr(model, "_entity_meta", None)
        assert (
            entity_meta is not None
        ), "the model of the EntitySerializer isn't an entity"
        components = entity_meta.components

        if not hasattr(meta, "fields"):
            field_names = ["entity_id"]
            field_names.extend(entity_meta.component_related_names())
            meta.fields = field_names

        # create serializers for all components
        for comp in components:
            comp_meta = comp._component_meta
            comp_rel_name = comp_meta.related_name
            # skip components which already have a serializer
            if comp_rel_name in attrs:
                continue
            field_kwargs = {"read_only": True, "omit_entity_id": True}
            if not comp_meta.unique:
                field_kwargs["many"] = True
            # find the component serializer in the global registry
            attrs[comp_rel_name] = ComponentSerializer._registry[comp](**field_kwargs)

        # call the model serializer superclass
        return super().__new__(cls, name, bases, attrs)


class EntitySerializer(
    ModelSerializer, metaclass=EntitySerializerBase, entity_serializer_passthrough=True
):
    pass


class InfraSerializer(ModelSerializer):
    class Meta:
        model = Infra
        fields = "__all__"


# component serializers


class IdentifierComponentSerializer(ComponentSerializer):
    database = StringRelatedField()

    class Meta:
        model = IdentifierComponent
        fields = "__all__"


class TrackSectionLocationComponentSerializer(ComponentSerializer):
    class Meta:
        model = TrackSectionLocationComponent
        fields = "__all__"


class TrackSectionRangeComponentSerializer(ComponentSerializer):
    class Meta:
        model = TrackSectionRangeComponent
        fields = "__all__"


class TrackSectionComponentSerializer(ComponentSerializer):
    class Meta:
        model = TrackSectionComponent
        fields = "__all__"


class TrackSectionLinkComponentSerializer(ComponentSerializer):
    begin_endpoint = EnumSerializer(Endpoint)
    end_endpoint = EnumSerializer(Endpoint)

    class Meta:
        model = TrackSectionLinkComponent
        fields = "__all__"


class TrackSectionSerializer(EntitySerializer):
    class Meta:
        model = TrackSectionEntity


class TrackSectionLinkSerializer(EntitySerializer):
    class Meta:
        model = TrackSectionLinkEntity


class SwitchSerializer(EntitySerializer):
    class Meta:
        model = SwitchEntity


class OperationalPointSerializer(EntitySerializer):
    class Meta:
        model = OperationalPointEntity


class SignalSerializer(EntitySerializer):
    class Meta:
        model = SignalEntity
