from rest_framework.serializers import (
    ModelSerializer,
    StringRelatedField,
)

from osrd_infra.models import (
    Endpoint,
    Infra,
    # explicitly declared serialiers
    TrackSectionLinkComponent,
    IdentifierComponent,
    # ecs
    Component,
    get_entity_meta,
    ALL_COMPONENT_TYPES,
    ALL_ENTITY_TYPES,
)

from osrd_infra.models.common import EnumSerializer


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

        entity_meta = get_entity_meta(meta.model)
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
            serializer = ComponentSerializer._registry.get(comp, None)
            assert serializer is not None, f"{comp} has no registered serializer"
            attrs[comp_rel_name] = serializer(**field_kwargs)

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


# COMPONENT SERIALIZERS


class IdentifierComponentSerializer(ComponentSerializer):
    database = StringRelatedField()

    class Meta:
        model = IdentifierComponent
        fields = "__all__"


class TrackSectionLinkComponentSerializer(ComponentSerializer):
    begin_endpoint = EnumSerializer(Endpoint)
    end_endpoint = EnumSerializer(Endpoint)

    class Meta:
        model = TrackSectionLinkComponent
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


for component_type in ALL_COMPONENT_TYPES:
    if component_type in ComponentSerializer._registry:
        continue
    serializer = generate_serializer(
        component_type, ComponentSerializer, {"fields": "__all__"}
    )
    globals()[serializer.__name__] = serializer


# ENTITY SERIALIZERS

ALL_ENTITY_SERIALIZERS = []

for entity_type in ALL_ENTITY_TYPES:
    serializer = generate_serializer(entity_type, EntitySerializer)
    ALL_ENTITY_SERIALIZERS.append(serializer)
    globals()[serializer.__name__] = serializer
